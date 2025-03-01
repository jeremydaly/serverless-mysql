'use strict';

const { expect } = require('chai');
const {
    createTestConnection,
    closeConnection,
    setupTestTable
} = require('./helpers/setup');

describe('MySQL changeUser Integration Tests', function () {
    this.timeout(10000);

    let db;

    before(function () {
        db = createTestConnection();
    });

    after(async function () {
        try {
            if (db) {
                await db.end({ timeout: 5000 });
                await closeConnection(db);
            }
        } catch (err) {
            console.error('Error closing connection:', err);
        }
    });

    it('should change user successfully if second user credentials are provided', async function () {
        const secondUser = process.env.MYSQL_SECOND_USER;
        const secondPassword = process.env.MYSQL_SECOND_PASSWORD;

        if (!secondUser || !secondPassword) {
            console.warn('Skipping full changeUser test - no second user credentials provided');
            console.warn('Set MYSQL_SECOND_USER and MYSQL_SECOND_PASSWORD environment variables to test actual user switching');

            const changeUserPromise = db.changeUser({
                user: db.getConfig().user,
                password: db.getConfig().password
            });

            expect(changeUserPromise).to.be.a('promise');
            await changeUserPromise;
            return;
        }

        try {
            const initialUserResult = await db.query('SELECT CURRENT_USER() AS user');
            const initialUser = initialUserResult[0].user;

            await db.changeUser({
                user: secondUser,
                password: secondPassword
            });

            const newUserResult = await db.query('SELECT CURRENT_USER() AS user');
            const newUser = newUserResult[0].user;

            expect(newUser).to.include(secondUser);
            expect(newUser).to.not.equal(initialUser);

            const config = db.getConfig();
            await db.changeUser({
                user: config.user,
                password: config.password
            });
        } catch (error) {
            if (error.code === 'ER_ACCESS_DENIED_ERROR') {
                console.error('Access denied when changing user. Check that the provided credentials are correct and have proper permissions.');
                console.error('Error details:', error.message);
            }

            throw error;
        }
    });

    it('should handle errors when changing to non-existent user', async function () {
        try {
            const nonExistentUser = 'non_existent_user_' + Date.now();
            await db.changeUser({
                user: nonExistentUser,
                password: 'wrong_password'
            });

            expect.fail('Should have thrown an error');
        } catch (error) {
            expect(error).to.be.an('error');

            // In MySQL 8.4+ (LTS), the mysql_native_password plugin is not loaded by default
            // In older MySQL versions, we get an access denied error
            expect(error.code).to.be.oneOf([
                'ER_ACCESS_DENIED_ERROR',  // Older MySQL versions
                'ER_PLUGIN_IS_NOT_LOADED'  // MySQL 8.4+ (LTS)
            ]);

            if (error.code === 'ER_PLUGIN_IS_NOT_LOADED') {
                expect(error.message).to.include('Plugin');
                expect(error.message).to.include('mysql_native_password');
                expect(error.message).to.include('not loaded');
            } else {
                expect(error.message).to.include('Access denied for user');
            }
        }
    });

    it('should support changing the database', async function () {
        const testDbName = 'serverless_mysql_test_db_' + Date.now().toString().slice(-6);

        try {
            await db.query(`CREATE DATABASE IF NOT EXISTS ${testDbName}`);

            const initialDbResult = await db.query('SELECT DATABASE() AS db');
            const initialDb = initialDbResult[0].db;

            await db.changeUser({
                user: db.getConfig().user,
                password: db.getConfig().password,
                database: testDbName
            });

            const newDbResult = await db.query('SELECT DATABASE() AS db');
            const newDb = newDbResult[0].db;

            expect(newDb).to.equal(testDbName);
            expect(newDb).to.not.equal(initialDb);

            await db.query(`
                CREATE TABLE IF NOT EXISTS test_table (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(50) NOT NULL
                )
            `);

            await db.query(`INSERT INTO test_table (name) VALUES ('test')`);

            const result = await db.query('SELECT * FROM test_table');
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(1);
            expect(result[0].name).to.equal('test');

            await db.changeUser({
                user: db.getConfig().user,
                password: db.getConfig().password,
                database: initialDb
            });

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

    it('should support changing the database with only database parameter', async function () {
        const testDbName = 'serverless_mysql_test_db_' + Date.now().toString().slice(-6);

        try {
            await db.query(`CREATE DATABASE IF NOT EXISTS ${testDbName}`);

            const initialDbResult = await db.query('SELECT DATABASE() AS db');
            const initialDb = initialDbResult[0].db;

            await db.changeUser({
                database: testDbName
            });

            const newDbResult = await db.query('SELECT DATABASE() AS db');
            const newDb = newDbResult[0].db;

            expect(newDb).to.equal(testDbName);
            expect(newDb).to.not.equal(initialDb);

            await db.query(`
                CREATE TABLE IF NOT EXISTS test_table_db_only (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(50) NOT NULL
                )
            `);

            await db.query(`INSERT INTO test_table_db_only (name) VALUES ('db_only_test')`);

            const result = await db.query('SELECT * FROM test_table_db_only');
            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(1);
            expect(result[0].name).to.equal('db_only_test');

            const userResult = await db.query('SELECT CURRENT_USER() AS user');
            const currentUser = userResult[0].user;

            const configUser = db.getConfig().user;
            expect(currentUser).to.include(configUser.split('@')[0]);

            await db.changeUser({
                database: initialDb
            });

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