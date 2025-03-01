'use strict';

const { expect } = require('chai');
const {
    createTestConnection,
    setupTestTable,
    cleanupTestTable,
    closeConnection
} = require('./helpers/setup');

describe('MySQL Features Integration Tests', function () {
    // Increase timeout for integration tests
    this.timeout(15000);

    let db;
    const TEST_TABLE = 'test_table';
    const TABLE_SCHEMA = `
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `;

    before(async function () {
        // Initialize the serverless-mysql instance
        db = createTestConnection();

        // Create and set up the test table
        await setupTestTable(db, TEST_TABLE, TABLE_SCHEMA);
    });

    after(async function () {
        try {
            // Clean up the test table
            await cleanupTestTable(db, TEST_TABLE);

            // Close the connection after tests
            if (db) {
                await db.end({ timeout: 5000 }); // Force end with timeout
                await closeConnection(db);
            }
        } catch (err) {
            console.error('Error during cleanup:', err);
        }
    });

    it('should insert and retrieve data', async function () {
        // Insert test data
        const insertResult = await db.query(
            'INSERT INTO test_table (name) VALUES (?), (?), (?)',
            ['Test 1', 'Test 2', 'Test 3']
        );

        expect(insertResult.affectedRows).to.equal(3);

        // Retrieve the data
        const selectResult = await db.query('SELECT * FROM test_table ORDER BY id');

        expect(selectResult).to.be.an('array');
        expect(selectResult).to.have.lengthOf(3);
        expect(selectResult[0].name).to.equal('Test 1');
        expect(selectResult[1].name).to.equal('Test 2');
        expect(selectResult[2].name).to.equal('Test 3');
    });

    it('should handle transactions correctly', async function () {
        // Start a transaction
        const transaction = db.transaction();

        try {
            // Execute queries within the transaction
            await transaction.query('INSERT INTO test_table (name) VALUES (?)', ['Transaction Test 1']);
            await transaction.query('INSERT INTO test_table (name) VALUES (?)', ['Transaction Test 2']);

            // Commit the transaction
            await transaction.commit();

            // Verify the data was inserted
            const result = await db.query('SELECT * FROM test_table WHERE name LIKE ?', ['Transaction Test%']);
            expect(result).to.have.lengthOf(2);
        } catch (error) {
            // Rollback on error (this should not happen in this test)
            await transaction.rollback();
            throw error;
        }
    });

    it('should rollback transactions on error', async function () {
        // Get current row count
        const initialCount = (await db.query('SELECT COUNT(*) as count FROM test_table'))[0].count;

        // Start a transaction
        const transaction = db.transaction();

        try {
            // Execute a valid query
            await transaction.query('INSERT INTO test_table (name) VALUES (?)', ['Should Not Exist']);

            // Execute an invalid query that will cause an error
            await transaction.query('INSERT INTO non_existent_table (name) VALUES (?)', ['Error']);

            // This should not be reached
            await transaction.commit();
            expect.fail('Transaction should have failed');
        } catch (error) {
            // Rollback on error
            await transaction.rollback();

            // Verify no data was inserted (row count should be the same)
            const finalCount = (await db.query('SELECT COUNT(*) as count FROM test_table'))[0].count;
            expect(finalCount).to.equal(initialCount);
        }
    });

    it('should handle connection management', async function () {
        // Run multiple queries in parallel to test connection management
        const promises = [];

        for (let i = 0; i < 5; i++) {
            promises.push(db.query('SELECT SLEEP(0.1) as result'));
        }

        const results = await Promise.all(promises);

        // All queries should complete successfully
        results.forEach(result => {
            expect(result[0].result).to.equal(0);
        });
    });

    it('should support changing database with USE statement', async function () {
        // Create a test database for this test
        const testDbName = 'serverless_mysql_test_db_' + Date.now().toString().slice(-6);

        try {
            // Create a new test database
            await db.query(`CREATE DATABASE IF NOT EXISTS ${testDbName}`);

            // Get current database
            const initialDbResult = await db.query('SELECT DATABASE() AS db');
            const initialDb = initialDbResult[0].db;

            // Change to the new database using USE statement
            await db.query(`USE ${testDbName}`);

            // Verify database was changed
            const newDbResult = await db.query('SELECT DATABASE() AS db');
            const newDb = newDbResult[0].db;

            // Verify the database was changed
            expect(newDb).to.equal(testDbName);
            expect(newDb).to.not.equal(initialDb);

            // Create a test table in the new database
            await db.query(`
                CREATE TABLE IF NOT EXISTS use_test_table (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(50) NOT NULL
                )
            `);

            // Insert data into the test table
            await db.query(`INSERT INTO use_test_table (name) VALUES ('use_test')`);

            // Query the data to verify it works
            const result = await db.query('SELECT * FROM use_test_table');
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(1);
            expect(result[0].name).to.equal('use_test');

            // Change back to the original database
            await db.query(`USE ${initialDb}`);

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