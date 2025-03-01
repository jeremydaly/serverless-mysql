'use strict';

const { expect } = require('chai');
const {
    createTestConnection,
    closeConnection,
    setupTestTable
} = require('./helpers/setup');

describe('MySQL changeUser Integration Tests', function () {
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

    it('should change user successfully if second user credentials are provided', async function () {
        // This test requires a second user to be available in the test database
        const secondUser = process.env.MYSQL_SECOND_USER;
        const secondPassword = process.env.MYSQL_SECOND_PASSWORD;

        if (!secondUser || !secondPassword) {
            console.warn('Skipping full changeUser test - no second user credentials provided');
            console.warn('Set MYSQL_SECOND_USER and MYSQL_SECOND_PASSWORD environment variables to test actual user switching');

            // Instead of skipping, we'll verify the method exists and returns a promise
            const changeUserPromise = db.changeUser({
                user: db.getConfig().user,
                password: db.getConfig().password
            });

            expect(changeUserPromise).to.be.a('promise');
            await changeUserPromise; // This should succeed as we're using the same credentials
            return;
        }

        try {
            // First, verify current user
            const initialUserResult = await db.query('SELECT CURRENT_USER() AS user');
            const initialUser = initialUserResult[0].user;

            // Change user
            await db.changeUser({
                user: secondUser,
                password: secondPassword
            });

            // Verify user was changed
            const newUserResult = await db.query('SELECT CURRENT_USER() AS user');
            const newUser = newUserResult[0].user;

            // The user format is typically 'username@host'
            expect(newUser).to.include(secondUser);
            expect(newUser).to.not.equal(initialUser);

            // Change back to original user for cleanup
            const config = db.getConfig();
            await db.changeUser({
                user: config.user,
                password: config.password
            });
        } catch (error) {
            // If the error is about access denied, provide a helpful message
            if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                console.error('Access denied when changing user. Check that the provided credentials are correct and have proper permissions.');
                console.error('Error details:', error.message);
            }

            throw error; // Always throw the error to fail the test
        }
    });

    it('should handle errors when changing to non-existent user', async function () {
        try {
            // Try to change to a non-existent user
            await db.changeUser({
                user: 'non_existent_user_' + Date.now(), // Add timestamp to ensure it doesn't exist
                password: 'wrong_password'
            });

            // If we get here, the test should fail
            expect.fail('Should have thrown an error');
        } catch (error) {
            // Verify it's an access denied error
            expect(error).to.be.an('error');
            // Different MySQL versions/configurations might return slightly different error codes
            // so we'll check that it contains an error code and message
            expect(error).to.have.property('code');
            // MySQL's error message format is "Access denied for user 'username'@'host'"
            expect(error.message).to.include('Access denied for user', 'Error message should indicate access was denied');
        }
    });

    it('should support changing the database', async function () {
        // Create a test database for this test
        const testDbName = 'serverless_mysql_test_db_' + Date.now().toString().slice(-6);

        try {
            // Create a new test database
            await db.query(`CREATE DATABASE IF NOT EXISTS ${testDbName}`);

            // Get current database
            const initialDbResult = await db.query('SELECT DATABASE() AS db');
            const initialDb = initialDbResult[0].db;

            // Change to the new database
            await db.changeUser({
                user: db.getConfig().user,
                password: db.getConfig().password,
                database: testDbName
            });

            // Verify database was changed
            const newDbResult = await db.query('SELECT DATABASE() AS db');
            const newDb = newDbResult[0].db;

            // Verify the database was changed
            expect(newDb).to.equal(testDbName);
            expect(newDb).to.not.equal(initialDb);

            // Create a test table in the new database
            await db.query(`
                CREATE TABLE IF NOT EXISTS test_table (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(50) NOT NULL
                )
            `);

            // Insert data into the test table
            await db.query(`INSERT INTO test_table (name) VALUES ('test')`);

            // Query the data to verify it works
            const result = await db.query('SELECT * FROM test_table');
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(1);
            expect(result[0].name).to.equal('test');

            // Change back to the original database
            await db.changeUser({
                user: db.getConfig().user,
                password: db.getConfig().password,
                database: initialDb
            });

            // Verify we're back to the original database
            const finalDbResult = await db.query('SELECT DATABASE() AS db');
            expect(finalDbResult[0].db).to.equal(initialDb);

        } catch (error) {
            // Rethrow the error after cleanup
            throw error;
        } finally {
            // Clean up - drop the test database
            try {
                // Make sure we're not using the database we're trying to drop
                await db.query(`USE ${db.getConfig().database}`);
                await db.query(`DROP DATABASE IF EXISTS ${testDbName}`);
            } catch (cleanupError) {
                console.error('Error during cleanup:', cleanupError);
            }
        }
    });
}); 