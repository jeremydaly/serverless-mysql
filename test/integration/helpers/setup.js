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
        try {
            // First try to end gracefully with a short timeout
            const endPromise = new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.log('Connection end timed out, forcing destroy');
                    resolve();
                }, 1000);

                db.end()
                    .then(() => {
                        clearTimeout(timeout);
                        resolve();
                    })
                    .catch((err) => {
                        console.error('Error ending connection:', err);
                        clearTimeout(timeout);
                        resolve();
                    });
            });

            await endPromise;

            // Force destroy the internal connection and socket
            if (db._conn) {
                // Destroy the connection
                db._conn.destroy();

                // If there's a socket, destroy it too
                if (db._conn.connection && db._conn.connection.stream) {
                    db._conn.connection.stream.destroy();
                }
            }

            // Reset internal state
            if (typeof db._reset === 'function') {
                db._reset();
            }
        } catch (err) {
            console.error('Error in closeConnection:', err);
            // Last resort - try to destroy everything we can find
            try {
                if (db._conn) {
                    db._conn.destroy();
                    if (db._conn.connection && db._conn.connection.stream) {
                        db._conn.connection.stream.destroy();
                    }
                }
            } catch (destroyErr) {
                console.error('Error destroying connection:', destroyErr);
            }
        }
    }
}

module.exports = {
    createTestConnection,
    setupTestTable,
    cleanupTestTable,
    closeConnection
}; 