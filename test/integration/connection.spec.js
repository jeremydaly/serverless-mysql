'use strict';

const { expect } = require('chai');
const {
    createTestConnection,
    closeConnection
} = require('./helpers/setup');

describe('MySQL Connection Integration Tests', function () {
    // Increase timeout for integration tests
    this.timeout(10000);

    let db;

    before(function () {
        // Initialize the serverless-mysql instance
        db = createTestConnection();
    });

    after(async function () {
        // Close the connection after tests
        try {
            if (db) {
                await db.end({ timeout: 5000 }); // Force end with timeout
                await closeConnection(db);
            }
        } catch (err) {
            console.error('Error closing connection:', err);
        }
    });

    it('should connect to the database without errors', async function () {
        try {
            // Execute a simple query to test the connection
            const result = await db.query('SELECT 1 AS value');

            // Verify the result
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(1);
            expect(result[0]).to.have.property('value', 1);
        } catch (error) {
            // Fail the test if there's an error
            console.error('Connection error:', error);
            throw error;
        }
    });

    it('should handle multiple queries in sequence', async function () {
        // Execute multiple queries in sequence
        const result1 = await db.query('SELECT 1 AS value');
        const result2 = await db.query('SELECT 2 AS value');

        expect(result1[0].value).to.equal(1);
        expect(result2[0].value).to.equal(2);
    });
}); 