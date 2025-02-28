'use strict';

const mysql = require('../../../index');

/**
 * Creates a MySQL connection for testing
 * @param {Object} options - Additional options for the MySQL connection
 * @returns {Object} The MySQL connection object
 */
function createTestConnection(options = {}) {
    // Connection configuration from environment variables
    const config = {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        database: process.env.MYSQL_DATABASE || 'serverless_mysql_test',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'password',
        port: process.env.MYSQL_PORT || 3306,
        connectTimeout: 30000 // 30 seconds
    };

    // Initialize the serverless-mysql instance with default test settings
    return mysql({
        config,
        // Override with any provided options
        ...options
    });
}

/**
 * Sets up a test table
 * @param {Object} db - The MySQL connection
 * @param {string} tableName - The name of the table to create
 * @param {string} schema - The schema for the table
 * @returns {Promise<void>}
 */
async function setupTestTable(db, tableName, schema) {
    // Create the test table
    await db.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${schema}
    )
  `);

    // Clear the table
    await db.query(`TRUNCATE TABLE ${tableName}`);
}

/**
 * Cleans up a test table
 * @param {Object} db - The MySQL connection
 * @param {string} tableName - The name of the table to drop
 * @returns {Promise<void>}
 */
async function cleanupTestTable(db, tableName) {
    await db.query(`DROP TABLE IF EXISTS ${tableName}`);
}

/**
 * Closes the database connection
 * @param {Object} db - The MySQL connection
 * @returns {Promise<void>}
 */
async function closeConnection(db) {
    if (db) {
        await db.end();
    }
}

module.exports = {
    createTestConnection,
    setupTestTable,
    cleanupTestTable,
    closeConnection
}; 