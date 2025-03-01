'use strict';

const { expect } = require('chai');
const {
    createTestConnection,
    setupTestTable,
    cleanupTestTable,
    closeConnection
} = require('./helpers/setup');

describe('Return Final SQL Query Integration Tests', function () {
    // Increase timeout for integration tests
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
            // Initialize the serverless-mysql instance with returnFinalSqlQuery enabled
            db = createTestConnection({ returnFinalSqlQuery: true });

            // Initialize another instance without returnFinalSqlQuery
            dbWithoutLogging = createTestConnection({ returnFinalSqlQuery: false });

            // Create and set up the test table
            await setupTestTable(db, TEST_TABLE, TABLE_SCHEMA);
        } catch (err) {
            console.log('Setup error:', err);
            // Skip tests if we can't connect to the database
            this.skip();
        }
    });

    after(async function () {
        try {
            // Clean up the test table
            await cleanupTestTable(db, TEST_TABLE);

            // Close the connections after tests
            if (db) {
                await db.end();
                await closeConnection(db);
            }
            if (dbWithoutLogging) {
                await dbWithoutLogging.end();
                await closeConnection(dbWithoutLogging);
            }
        } catch (err) {
            console.error('Error during cleanup:', err);
        }
    });

    // Test that verifies SQL logging with basic parameter substitution
    it('should include SQL with substituted parameters when returnFinalSqlQuery is enabled', async function () {
        // Insert a record and check the SQL property
        const insertResult = await db.query(
            'INSERT INTO ?? (name, active) VALUES (?, ?)',
            [TEST_TABLE, 'Test User', true]
        );

        // Verify the SQL property exists and contains the correct SQL
        expect(insertResult).to.have.property('sql');
        const expectedInsertSql = `INSERT INTO \`${TEST_TABLE}\` (name, active) VALUES ('Test User', true)`;
        expect(insertResult.sql).to.equal(expectedInsertSql);
        console.log('Insert SQL:', insertResult.sql);

        // Retrieve the inserted record and check the SQL property
        const selectResult = await db.query(
            'SELECT * FROM ?? WHERE name = ? AND active = ?',
            [TEST_TABLE, 'Test User', true]
        );

        // Verify the SQL property exists and contains the correct SQL
        expect(selectResult).to.have.property('sql');
        const expectedSelectSql = `SELECT * FROM \`${TEST_TABLE}\` WHERE name = 'Test User' AND active = true`;
        expect(selectResult.sql).to.equal(expectedSelectSql);
        console.log('Select SQL:', selectResult.sql);
    });

    // Test that verifies SQL is not logged when returnFinalSqlQuery is disabled
    it('should not include SQL when returnFinalSqlQuery is disabled', async function () {
        // Insert a record using the connection without logging
        const insertResult = await dbWithoutLogging.query(
            'INSERT INTO ?? (name, active) VALUES (?, ?)',
            [TEST_TABLE, 'No Log User', true]
        );

        // Verify the SQL property does not exist
        expect(insertResult).to.not.have.property('sql');

        // Retrieve the inserted record using the connection without logging
        const selectResult = await dbWithoutLogging.query(
            'SELECT * FROM ?? WHERE name = ? AND active = ?',
            [TEST_TABLE, 'No Log User', true]
        );

        // Verify the SQL property does not exist
        expect(selectResult).to.not.have.property('sql');
    });

    // Test with complex parameters
    it('should include SQL with complex parameter types correctly', async function () {
        // Create a date object for consistent testing
        const testDate = new Date('2020-01-01T00:00:00Z');

        // Insert a record with a date parameter
        const insertResult = await db.query(
            'INSERT INTO ?? (name, active, created_at) VALUES (?, ?, ?)',
            [TEST_TABLE, 'Date User', true, testDate]
        );

        // Verify the SQL property exists
        expect(insertResult).to.have.property('sql');

        // Log the SQL for debugging
        console.log('Insert with date SQL:', insertResult.sql);

        // The date format might vary, so we'll check the parts we can be certain about
        expect(insertResult.sql).to.include(`INSERT INTO \`${TEST_TABLE}\``);
        expect(insertResult.sql).to.include(`'Date User'`);
        expect(insertResult.sql).to.include(`true`);

        // Check that the date is included in some format - we'll be more flexible with the format
        expect(insertResult.sql).to.include('2020-01-01');

        // Retrieve the inserted record
        const selectResult = await db.query(
            'SELECT * FROM ?? WHERE name = ?',
            [TEST_TABLE, 'Date User']
        );

        // Verify the SQL property exists
        expect(selectResult).to.have.property('sql');
        const expectedSelectSql = `SELECT * FROM \`${TEST_TABLE}\` WHERE name = 'Date User'`;
        expect(selectResult.sql).to.equal(expectedSelectSql);

        console.log('Select with date SQL:', selectResult.sql);
    });

    // Test with object parameters
    it('should include SQL with object parameters correctly', async function () {
        // Create an object with the data to insert
        const userData = {
            name: 'Object User',
            active: false
        };

        // Insert using object parameters
        const insertResult = await db.query(
            'INSERT INTO ?? SET ?',
            [TEST_TABLE, userData]
        );

        // Verify the SQL property exists and contains the correct SQL
        expect(insertResult).to.have.property('sql');

        // The order of properties in the SET clause might vary, so we'll check each part separately
        expect(insertResult.sql).to.include(`INSERT INTO \`${TEST_TABLE}\` SET`);
        expect(insertResult.sql).to.include(`\`name\` = 'Object User'`);
        expect(insertResult.sql).to.include(`\`active\` = false`);

        console.log('Insert with object SQL:', insertResult.sql);

        // Retrieve the inserted record
        const selectResult = await db.query(
            'SELECT * FROM ?? WHERE name = ? AND active = ?',
            [TEST_TABLE, 'Object User', false]
        );

        // Verify the SQL property exists and contains the correct SQL
        expect(selectResult).to.have.property('sql');
        const expectedSelectSql = `SELECT * FROM \`${TEST_TABLE}\` WHERE name = 'Object User' AND active = false`;
        expect(selectResult.sql).to.equal(expectedSelectSql);

        console.log('Select with object SQL:', selectResult.sql);
    });

    // Test that verifies SQL is attached to error objects
    it('should include SQL in error objects when a query fails', async function () {
        try {
            // Execute a query with a syntax error
            await db.query(
                'SELECT * FROM ?? WHERE nonexistent_column = ?',
                [TEST_TABLE, 'Test Value']
            );

            // If we reach here, the test should fail
            expect.fail('Query should have thrown an error');
        } catch (error) {
            // Verify the error object has the SQL property
            expect(error).to.have.property('sql');

            // Verify the SQL contains the query with substituted parameters
            const expectedSql = `SELECT * FROM \`${TEST_TABLE}\` WHERE nonexistent_column = 'Test Value'`;
            expect(error.sql).to.equal(expectedSql);

            console.log('Error SQL:', error.sql);
            console.log('Error message:', error.message);

            // Verify it's actually a MySQL error
            expect(error).to.have.property('code');
            expect(error.code).to.match(/^ER_/); // MySQL error codes typically start with ER_
        }
    });
}); 