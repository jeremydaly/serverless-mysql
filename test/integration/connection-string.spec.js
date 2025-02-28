'use strict';

const { expect } = require('chai');
const mysql = require('../../index');
const { closeConnection, createTestConnection, createTestConnectionString } = require('./helpers/setup');

describe('Connection String Integration Tests', function () {
    this.timeout(10000);

    let db;

    afterEach(async function () {
        try {
            if (db) {
                await db.end({ timeout: 5000 });
                await closeConnection(db);
                db = null;
            }
        } catch (err) {
            console.error('Error closing connection:', err);
        }
    });

    it('should connect using a valid connection string', async function () {
        const connectionString = createTestConnectionString();
        db = createTestConnection(connectionString);

        try {
            const result = await db.query('SELECT 1 AS value');
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(1);
            expect(result[0]).to.have.property('value', 1);
        } catch (error) {
            console.error('Connection error:', error);
            throw error;
        }
    });

    it('should connect using a connection string with additional parameters', async function () {
        const connectionString = createTestConnectionString({
            connectTimeout: 10000,
            dateStrings: 'true'
        });

        db = createTestConnection(connectionString);

        try {
            const result = await db.query('SELECT 1 AS value');
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(1);
            expect(result[0]).to.have.property('value', 1);
        } catch (error) {
            console.error('Connection error:', error);
            throw error;
        }
    });
}); 