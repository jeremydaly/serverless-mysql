'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const {
    createTestConnection,
    setupTestTable,
    cleanupTestTable,
    closeConnection
} = require('./helpers/setup');

describe('Query Retries Integration Tests', function () {
    this.timeout(15000);

    let db;
    let originalQuery;
    let queryStub;
    let onQueryRetrySpy;
    const TEST_TABLE = 'retry_test_table';
    const TABLE_SCHEMA = `
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `;

    beforeEach(async function () {
        onQueryRetrySpy = sinon.spy();

        db = createTestConnection({
            maxQueryRetries: 3,
            onQueryRetry: onQueryRetrySpy
        });

        await setupTestTable(db, TEST_TABLE, TABLE_SCHEMA);

        // Store the original query method
        originalQuery = db.getClient().query;
    });

    afterEach(async function () {
        // Restore the original query method if it was stubbed
        if (queryStub && queryStub.restore) {
            queryStub.restore();
        }

        try {
            await cleanupTestTable(db, TEST_TABLE);

            if (db) {
                await db.end({ timeout: 5000 });
                await closeConnection(db);
            }
        } catch (err) {
            console.error('Error during cleanup:', err);
        }
    });

    it('should retry queries that fail with retryable errors', async function () {
        // Create a counter to track the number of query attempts
        let attempts = 0;

        // Stub the client's query method to simulate a deadlock error on first attempt
        queryStub = sinon.stub(db.getClient(), 'query').callsFake(function (sql, values, callback) {
            attempts++;

            // If this is the first or second attempt, simulate a deadlock error
            if (attempts <= 2) {
                const error = new Error('Deadlock found when trying to get lock');
                error.code = 'ER_LOCK_DEADLOCK';

                // Call the callback with the error
                if (typeof values === 'function') {
                    values(error);
                } else {
                    callback(error);
                }

                // Return a mock query object
                return { sql: typeof sql === 'string' ? sql : sql.sql };
            }

            // On the third attempt, succeed
            return originalQuery.apply(this, arguments);
        });

        // Execute a query that should be retried
        await db.query('INSERT INTO retry_test_table (name) VALUES (?)', ['Test Retry']);

        // Verify the query was attempted multiple times
        expect(attempts).to.be.at.least(3);

        // Verify the onQueryRetry callback was called
        expect(onQueryRetrySpy.callCount).to.equal(2);

        // Verify the data was actually inserted
        const result = await db.query('SELECT * FROM retry_test_table WHERE name = ?', ['Test Retry']);
        expect(result).to.have.lengthOf(1);
        expect(result[0].name).to.equal('Test Retry');
    });

    it('should give up after maxQueryRetries attempts', async function () {
        // Create a counter to track the number of query attempts
        let attempts = 0;

        // Stub the client's query method to always fail with a retryable error
        queryStub = sinon.stub(db.getClient(), 'query').callsFake(function (sql, values, callback) {
            attempts++;

            const error = new Error('Lock wait timeout exceeded');
            error.code = 'ER_LOCK_WAIT_TIMEOUT';

            // Call the callback with the error
            if (typeof values === 'function') {
                values(error);
            } else {
                callback(error);
            }

            // Return a mock query object
            return { sql: typeof sql === 'string' ? sql : sql.sql };
        });

        // Execute a query that should be retried but eventually fail
        try {
            await db.query('INSERT INTO retry_test_table (name) VALUES (?)', ['Should Fail']);
            expect.fail('Query should have failed after max retries');
        } catch (error) {
            // Verify the error is the expected one
            expect(error.code).to.equal('ER_LOCK_WAIT_TIMEOUT');

            // Verify the query was attempted the maximum number of times (initial + retries)
            expect(attempts).to.equal(4); // 1 initial + 3 retries

            // Verify the onQueryRetry callback was called the expected number of times
            expect(onQueryRetrySpy.callCount).to.equal(3);
        }
    });
}); 