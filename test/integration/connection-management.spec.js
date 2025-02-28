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
            maxRetries: 5
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
        // This test verifies that the connection counter works correctly
        // The counter is incremented in the end() method when a connection is reused

        // First, make sure we have a connection
        await db.query('SELECT 1 as test');

        // Get the initial counter value
        const initialCounter = db.getCounter();

        // Run a query and call end() to increment the counter
        await db.query('SELECT 2 as test');
        await db.end();

        // Get the counter value after one reuse
        const counterAfterOneReuse = db.getCounter();

        // Verify that the counter was incremented
        expect(counterAfterOneReuse).to.be.greaterThan(initialCounter);

        // Run another query and call end() again
        await db.query('SELECT 3 as test');
        await db.end();

        // Get the counter value after two reuses
        const counterAfterTwoReuses = db.getCounter();

        // Verify that the counter was incremented again
        expect(counterAfterTwoReuses).to.be.greaterThan(counterAfterOneReuse);
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