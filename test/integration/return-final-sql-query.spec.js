'use strict';

const { expect } = require('chai');
const {
    createTestConnection,
    setupTestTable,
    cleanupTestTable,
    closeConnection
} = require('./helpers/setup');

describe('Return Final SQL Query Integration Tests', function () {
    this.timeout(15000);

    let db, dbWithoutLogging;
    const TEST_TABLE = 'final_sql_query_test_table';
    const TABLE_SCHEMA = `
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `;

    before(async function () {
        try {
            db = createTestConnection({ returnFinalSqlQuery: true });
            dbWithoutLogging = createTestConnection({ returnFinalSqlQuery: false });
            await setupTestTable(db, TEST_TABLE, TABLE_SCHEMA);
        } catch (err) {
            this.skip();
        }
    });

    after(async function () {
        try {
            await cleanupTestTable(db, TEST_TABLE);

            if (db) {
                await db.end();
                await closeConnection(db);
            }
            if (dbWithoutLogging) {
                await dbWithoutLogging.end();
                await closeConnection(dbWithoutLogging);
            }
        } catch (err) {
        }
    });

    it('should include SQL with substituted parameters when returnFinalSqlQuery is enabled', async function () {
        const insertResult = await db.query(
            'INSERT INTO ?? (name, active) VALUES (?, ?)',
            [TEST_TABLE, 'Test User', true]
        );

        expect(insertResult).to.have.property('sql');
        const expectedInsertSql = `INSERT INTO \`${TEST_TABLE}\` (name, active) VALUES ('Test User', true)`;
        expect(insertResult.sql).to.equal(expectedInsertSql);

        const selectResult = await db.query(
            'SELECT * FROM ?? WHERE name = ? AND active = ?',
            [TEST_TABLE, 'Test User', true]
        );

        expect(selectResult).to.have.property('sql');
        const expectedSelectSql = `SELECT * FROM \`${TEST_TABLE}\` WHERE name = 'Test User' AND active = true`;
        expect(selectResult.sql).to.equal(expectedSelectSql);
    });

    it('should not include SQL when returnFinalSqlQuery is disabled', async function () {
        const insertResult = await dbWithoutLogging.query(
            'INSERT INTO ?? (name, active) VALUES (?, ?)',
            [TEST_TABLE, 'No Log User', true]
        );

        expect(insertResult).to.not.have.property('sql');

        const selectResult = await dbWithoutLogging.query(
            'SELECT * FROM ?? WHERE name = ? AND active = ?',
            [TEST_TABLE, 'No Log User', true]
        );

        expect(selectResult).to.not.have.property('sql');
    });

    it('should include SQL with complex parameter types correctly', async function () {
        const testDate = new Date('2020-01-01T00:00:00Z');

        const insertResult = await db.query(
            'INSERT INTO ?? (name, active, created_at) VALUES (?, ?, ?)',
            [TEST_TABLE, 'Date User', true, testDate]
        );

        expect(insertResult).to.have.property('sql');
        const expectedInsertSql = `INSERT INTO \`${TEST_TABLE}\` (name, active, created_at) VALUES ('Date User', true, '2020-01-01 00:00:00.000')`;
        expect(insertResult.sql).to.equal(expectedInsertSql);

        const selectResult = await db.query(
            'SELECT * FROM ?? WHERE name = ?',
            [TEST_TABLE, 'Date User']
        );

        expect(selectResult).to.have.property('sql');
        const expectedSelectSql = `SELECT * FROM \`${TEST_TABLE}\` WHERE name = 'Date User'`;
        expect(selectResult.sql).to.equal(expectedSelectSql);
    });

    it('should include SQL with object parameters correctly', async function () {
        const userData = {
            name: 'Object User',
            active: false
        };

        const insertResult = await db.query(
            'INSERT INTO ?? SET ?',
            [TEST_TABLE, userData]
        );

        expect(insertResult).to.have.property('sql');
        const expectedInsertSql = `INSERT INTO \`${TEST_TABLE}\` SET \`name\` = 'Object User', \`active\` = false`;
        expect(insertResult.sql).to.equal(expectedInsertSql);

        const selectResult = await db.query(
            'SELECT * FROM ?? WHERE name = ? AND active = ?',
            [TEST_TABLE, 'Object User', false]
        );

        expect(selectResult).to.have.property('sql');
        const expectedSelectSql = `SELECT * FROM \`${TEST_TABLE}\` WHERE name = 'Object User' AND active = false`;
        expect(selectResult.sql).to.equal(expectedSelectSql);
    });

    it('should include SQL in error objects when a query fails', async function () {
        try {
            await db.query(
                'SELECT * FROM ?? WHERE nonexistent_column = ?',
                [TEST_TABLE, 'Test Value']
            );

            expect.fail('Query should have thrown an error');
        } catch (error) {
            expect(error).to.have.property('sql');
            const expectedSql = `SELECT * FROM \`${TEST_TABLE}\` WHERE nonexistent_column = 'Test Value'`;
            expect(error.sql).to.equal(expectedSql);
            expect(error).to.have.property('code');
            expect(error.code).to.match(/^ER_/);
        }
    });
}); 