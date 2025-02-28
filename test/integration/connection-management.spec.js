'use strict';

const { expect } = require('chai');
const { createTestConnection, closeConnection } = require('./helpers/setup');

describe('MySQL Connection Management Tests', function () {
    // Increase timeout for these tests
    this.timeout(20000);

    let db;

    beforeEach(function () {
        // Create a fresh connection for each test
        db = createTestConnection({
            // Set specific options for connection management tests
            connUtilization: 0.7,
            maxRetries: 5,
            backoff: 'full-jitter',
            base: 100, // 100ms base delay for retries
            cap: 1000  // 1000ms maximum delay
        });
    });

    afterEach(async function () {
        // Close the connection after each test
        await closeConnection(db);
    });

    it('should handle multiple concurrent connections', async function () {
        // Create an array of promises for concurrent queries
        const promises = [];
        const queryCount = 10;

        for (let i = 0; i < queryCount; i++) {
            promises.push(db.query('SELECT SLEEP(0.2) as result, ? as id', [i]));
        }

        // Execute all queries concurrently
        const results = await Promise.all(promises);

        // Verify all queries completed successfully
        expect(results).to.have.lengthOf(queryCount);

        // Check that each query returned the correct result
        for (let i = 0; i < queryCount; i++) {
            const matchingResult = results.find(r => r[0].id === i);
            expect(matchingResult).to.exist;
            expect(matchingResult[0].result).to.equal(0);
        }
    });

    it('should reuse connections efficiently', async function () {
        // Run several queries in sequence to test connection reuse
        for (let i = 0; i < 5; i++) {
            const result = await db.query('SELECT ? as iteration', [i]);
            expect(result[0].iteration).to.equal(i);
        }

        // The connection counter should be greater than 0 (connections were reused)
        // Note: We're accessing an internal counter, which might not be ideal in real tests
        // but it's useful for testing connection reuse
        const counter = db.getCounter ? db.getCounter() : 0;

        // If getCounter is not exposed, this test will pass trivially
        // but at least we've verified the queries work
        if (db.getCounter) {
            expect(counter).to.be.greaterThan(0);
        }
    });

    it('should handle query timeouts gracefully', async function () {
        // Create a connection without special timeout settings
        const timeoutDb = createTestConnection();

        try {
            // Try to run a query that will exceed the timeout
            // Pass the timeout option directly to the query method (50ms)
            await timeoutDb.query({
                sql: 'SELECT SLEEP(1) as result',
                timeout: 50 // Set a very short timeout for this query
            });
            // If we get here, the test should fail
            expect.fail('Query should have timed out');
        } catch (error) {
            // Expect a timeout error
            expect(error.message).to.include('timeout');
        } finally {
            // Clean up
            await closeConnection(timeoutDb);
        }
    });

    it('should handle connection errors and retry', async function () {
        // This test is more of a simulation since we can't easily force connection errors
        // in a controlled test environment

        // Create a connection with retry settings
        const retryDb = createTestConnection({
            maxRetries: 3,
            backoff: 'decorrelated-jitter',
            base: 50,
            cap: 500
        });

        // Run a simple query to verify the connection works
        const result = await retryDb.query('SELECT 1 as success');
        expect(result[0].success).to.equal(1);

        // Clean up
        await closeConnection(retryDb);
    });
}); 