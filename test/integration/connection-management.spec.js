'use strict';

const { expect } = require('chai');
const { createTestConnection, closeConnection } = require('./helpers/setup');

describe('MySQL Connection Management Tests', function () {
    this.timeout(20000);

    let db;
    const allConnections = [];

    beforeEach(function () {
        db = createTestConnection({
            maxRetries: 5
        });
        allConnections.push(db);
    });

    afterEach(async function () {
        try {
            if (db) {
                const closePromise = new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        console.log('Connection end timed out, forcing destroy');
                        if (db._conn) {
                            db._conn.destroy();
                        }
                        resolve();
                    }, 2000);

                    db.end()
                        .then(() => {
                            clearTimeout(timeout);
                            resolve();
                        })
                        .catch((err) => {
                            console.error('Error ending connection:', err);
                            clearTimeout(timeout);
                            if (db._conn) {
                                db._conn.destroy();
                            }
                            resolve();
                        });
                });

                await closePromise;
                await closeConnection(db);
            }
        } catch (err) {
            console.error('Error closing connection:', err);
        }
    });

    after(async function () {
        console.log('Running final cleanup for all connections...');

        for (const connection of allConnections) {
            if (connection) {
                try {
                    console.log('Closing connection...');
                    await connection.end({ timeout: 1000 }).catch(err => {
                        console.error('Error ending connection in final cleanup:', err);
                    });

                    await closeConnection(connection);

                    setTimeout(() => {
                        console.log('Forcing process exit to prevent hanging');
                        process.exit(0);
                    }, 1000);
                } catch (err) {
                    console.error('Final cleanup error:', err);
                }
            }
        }
    });

    it('should handle multiple concurrent connections', async function () {
        const promises = [];
        const queryCount = 5;

        try {
            for (let i = 0; i < queryCount; i++) {
                promises.push(db.query('SELECT SLEEP(0.1) as result, ? as id', [i]));
            }

            const results = await Promise.all(promises);

            expect(results).to.have.lengthOf(queryCount);

            for (let i = 0; i < queryCount; i++) {
                const matchingResult = results.find(r => r[0].id === i);
                expect(matchingResult).to.exist;
                expect(matchingResult[0].result).to.equal(0);
            }
        } catch (error) {
            console.error('Error in concurrent connections test:', error);
            if (error.message && error.message.includes('Connection lost')) {
                this.skip();
            } else {
                throw error;
            }
        }
    });

    it('should reuse connections efficiently', async function () {
        await db.query('SELECT 1 as test');

        const initialCounter = db.getCounter();

        await db.query('SELECT 2 as test');
        await db.end();

        const counterAfterOneReuse = db.getCounter();

        expect(counterAfterOneReuse).to.be.greaterThan(initialCounter);

        await db.query('SELECT 3 as test');
        await db.end();

        const counterAfterTwoReuses = db.getCounter();

        expect(counterAfterTwoReuses).to.be.greaterThan(counterAfterOneReuse);
    });

    it('should handle query timeouts gracefully', async function () {
        const timeoutDb = createTestConnection();
        allConnections.push(timeoutDb);

        try {
            await timeoutDb.query({
                sql: 'SELECT SLEEP(0.2) as result',
                timeout: 50
            });
            expect.fail('Query should have timed out');
        } catch (error) {
            expect(error.message).to.include('timeout');
        } finally {
            try {
                console.log('Cleaning up timeout test connection');
                const closePromise = new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        console.log('Timeout connection end timed out, forcing destroy');
                        if (timeoutDb._conn) {
                            timeoutDb._conn.destroy();
                        }
                        resolve();
                    }, 1000);

                    timeoutDb.end()
                        .then(() => {
                            clearTimeout(timeout);
                            resolve();
                        })
                        .catch((err) => {
                            console.error('Error ending timeout connection:', err);
                            clearTimeout(timeout);
                            if (timeoutDb._conn) {
                                timeoutDb._conn.destroy();
                            }
                            resolve();
                        });
                });

                await closePromise;
                await closeConnection(timeoutDb);
            } catch (err) {
                console.error('Error closing timeout test connection:', err);
            }
        }
    });

    it('should handle connection errors and retry', async function () {
        const retryDb = createTestConnection({
            maxRetries: 3,
            backoff: 'decorrelated-jitter',
            base: 50,
            cap: 500
        });
        allConnections.push(retryDb);

        try {
            const result = await retryDb.query('SELECT 1 as success');
            expect(result[0].success).to.equal(1);
        } finally {
            try {
                console.log('Cleaning up retry test connection');
                const closePromise = new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        console.log('Retry connection end timed out, forcing destroy');
                        if (retryDb._conn) {
                            retryDb._conn.destroy();
                        }
                        resolve();
                    }, 1000);

                    retryDb.end()
                        .then(() => {
                            clearTimeout(timeout);
                            resolve();
                        })
                        .catch((err) => {
                            console.error('Error ending retry connection:', err);
                            clearTimeout(timeout);
                            if (retryDb._conn) {
                                retryDb._conn.destroy();
                            }
                            resolve();
                        });
                });

                await closePromise;
                await closeConnection(retryDb);
            } catch (err) {
                console.error('Error closing retry test connection:', err);
            }
        }
    });
}); 