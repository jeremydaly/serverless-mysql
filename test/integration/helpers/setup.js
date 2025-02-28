'use strict';

const mysql = require('../../../index');

/**
 * Creates a MySQL connection for testing
 * @param {Object} options - Additional options for the MySQL connection
 * @returns {Object} The MySQL connection object
 */
function createTestConnection(options = {}) {
    const config = {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        database: process.env.MYSQL_DATABASE || 'serverless_mysql_test',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || 'password',
        port: process.env.MYSQL_PORT || 3306,
        connectTimeout: 30000
    };

    return mysql({
        config,
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
    await db.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${schema}
    )
  `);

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

            if (db._conn) {
                db._conn.destroy();

                if (db._conn.connection && db._conn.connection.stream) {
                    db._conn.connection.stream.destroy();
                }
            }

            if (typeof db._reset === 'function') {
                db._reset();
            }
        } catch (err) {
            console.error('Error in closeConnection:', err);
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