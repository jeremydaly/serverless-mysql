'use strict';

const { expect } = require('chai');
const {
    createTestConnection,
    setupTestTable,
    cleanupTestTable,
    closeConnection
} = require('./helpers/setup');

describe('Transaction JavaScript Error Tests', function () {
    this.timeout(15000);

    let db;
    const TEST_TABLE = 'test_transaction_js_error';
    const TABLE_SCHEMA = `
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at DATETIME,
        description VARCHAR(255)
    `;

    before(async function () {
        // Initialize the database connection
        db = createTestConnection({ manageConns: false });
        await setupTestTable(db, TEST_TABLE, TABLE_SCHEMA);
    });

    after(async function () {
        try {
            await cleanupTestTable(db, TEST_TABLE);
        } finally {
            await closeConnection(db);
        }
    });

    beforeEach(async function () {
        // Clear the table before each test
        await db.query(`TRUNCATE TABLE ${TEST_TABLE}`);
    });

    it('should not execute stale queries when a JavaScript error is thrown in a transaction', async function () {
        const firstDate = new Date(2023, 0, 1); // January 1, 2023

        // First transaction attempt with a JavaScript error
        try {
            await db
                .transaction()
                .query(() => [`INSERT INTO ${TEST_TABLE} (created_at, description) VALUES(?, ?)`, [firstDate, 'First transaction']])
                .query(() => {
                    throw new Error('Abort transaction');
                })
                .commit();

            // Should not reach here
            expect.fail('Transaction should have failed');
        } catch (error) {
            expect(error.message).to.equal('Abort transaction');
        }

        // Check that no records were inserted from the failed transaction
        const result1 = await db.query(`SELECT COUNT(*) as count FROM ${TEST_TABLE}`);
        expect(result1[0].count).to.equal(0, 'No records should be inserted after the failed transaction');

        // Second transaction - this one should succeed
        const secondDate = new Date(2023, 1, 1); // February 1, 2023
        await db
            .transaction()
            .query(() => [`INSERT INTO ${TEST_TABLE} (created_at, description) VALUES(?, ?)`, [secondDate, 'Second transaction']])
            .commit();

        // Check that only the second transaction's records were inserted
        const result2 = await db.query(`SELECT * FROM ${TEST_TABLE} ORDER BY created_at`);
        expect(result2.length).to.equal(1, 'Only one record should be inserted');
        expect(result2[0].description).to.equal('Second transaction', 'Only the second transaction should be committed');

        // The key test: Make sure the first transaction's query wasn't executed
        const firstTransactionRecords = await db.query(
            `SELECT COUNT(*) as count FROM ${TEST_TABLE} WHERE description = ?`,
            ['First transaction']
        );
        expect(firstTransactionRecords[0].count).to.equal(0, 'First transaction should not have been executed');
    });
});
