'use strict';

const { expect } = require('chai');
const {
    createTestConnection,
    setupTestTable,
    cleanupTestTable,
    closeConnection
} = require('./helpers/setup');

describe('MySQL Features Integration Tests', function () {
    this.timeout(15000);

    let db;
    const TEST_TABLE = 'test_table';
    const TABLE_SCHEMA = `
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `;

    before(async function () {
        db = createTestConnection();
        await setupTestTable(db, TEST_TABLE, TABLE_SCHEMA);
    });

    after(async function () {
        try {
            await cleanupTestTable(db, TEST_TABLE);

            if (db) {
                await db.end({ timeout: 5000 });
                await closeConnection(db);
            }
        } catch (err) {
            console.error('Error during cleanup:', err);
        }
    });

    it('should insert and retrieve data', async function () {
        const insertResult = await db.query(
            'INSERT INTO test_table (name) VALUES (?), (?), (?)',
            ['Test 1', 'Test 2', 'Test 3']
        );

        expect(insertResult.affectedRows).to.equal(3);

        const selectResult = await db.query('SELECT * FROM test_table ORDER BY id');

        expect(selectResult).to.be.an('array');
        expect(selectResult).to.have.lengthOf(3);
        expect(selectResult[0].name).to.equal('Test 1');
        expect(selectResult[1].name).to.equal('Test 2');
        expect(selectResult[2].name).to.equal('Test 3');
    });

    it('should handle transactions correctly', async function () {
        const transaction = db.transaction();

        try {
            await transaction.query('INSERT INTO test_table (name) VALUES (?)', ['Transaction Test 1']);
            await transaction.query('INSERT INTO test_table (name) VALUES (?)', ['Transaction Test 2']);

            await transaction.commit();

            const result = await db.query('SELECT * FROM test_table WHERE name LIKE ?', ['Transaction Test%']);
            expect(result).to.have.lengthOf(2);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    });

    it('should rollback transactions on error', async function () {
        const initialCount = (await db.query('SELECT COUNT(*) as count FROM test_table'))[0].count;

        const transaction = db.transaction();

        try {
            await transaction.query('INSERT INTO test_table (name) VALUES (?)', ['Should Not Exist']);
            await transaction.query('INSERT INTO non_existent_table (name) VALUES (?)', ['Error']);

            await transaction.commit();
            expect.fail('Transaction should have failed');
        } catch (error) {
            await transaction.rollback();

            const finalCount = (await db.query('SELECT COUNT(*) as count FROM test_table'))[0].count;
            expect(finalCount).to.equal(initialCount);
        }
    });

    it('should handle connection management', async function () {
        const promises = [];

        for (let i = 0; i < 5; i++) {
            promises.push(db.query('SELECT SLEEP(0.1) as result'));
        }

        const results = await Promise.all(promises);

        results.forEach(result => {
            expect(result[0].result).to.equal(0);
        });
    });

    it('should support changing database with USE statement', async function () {
        const testDbName = 'serverless_mysql_test_db_' + Date.now().toString().slice(-6);

        try {
            await db.query(`CREATE DATABASE IF NOT EXISTS ${testDbName}`);

            const initialDbResult = await db.query('SELECT DATABASE() AS db');
            const initialDb = initialDbResult[0].db;

            await db.query(`USE ${testDbName}`);

            const newDbResult = await db.query('SELECT DATABASE() AS db');
            const newDb = newDbResult[0].db;

            expect(newDb).to.equal(testDbName);
            expect(newDb).to.not.equal(initialDb);

            await db.query(`
                CREATE TABLE IF NOT EXISTS use_test_table (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(50) NOT NULL
                )
            `);

            await db.query(`INSERT INTO use_test_table (name) VALUES ('use_test')`);

            const result = await db.query('SELECT * FROM use_test_table');
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(1);
            expect(result[0].name).to.equal('use_test');

            await db.query(`USE ${initialDb}`);

            const finalDbResult = await db.query('SELECT DATABASE() AS db');
            expect(finalDbResult[0].db).to.equal(initialDb);

        } catch (error) {
            throw error;
        } finally {
            try {
                await db.query(`USE ${db.getConfig().database}`);
                await db.query(`DROP DATABASE IF EXISTS ${testDbName}`);
            } catch (cleanupError) {
                console.error('Error during cleanup:', cleanupError);
            }
        }
    });
}); 