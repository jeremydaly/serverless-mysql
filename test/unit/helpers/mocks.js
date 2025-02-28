'use strict';

const sinon = require('sinon');

/**
 * Mock MySQL connection for unit tests
 * @returns {Object} Mock MySQL connection object
 */
function createMockConnection() {
    return {
        connect: sinon.stub().resolves({}),
        query: sinon.stub().resolves([{ value: 1 }]),
        end: sinon.stub().resolves({}),
        destroy: sinon.stub(),
        on: sinon.stub(),
        escape: sinon.stub().callsFake(value => `'${value}'`),
        format: sinon.stub().callsFake((sql, values) => {
            if (!values) return sql;
            const vals = [...values]; // Create a copy to avoid modifying the original
            return sql.replace(/\?/g, () => {
                if (!vals.length) return '?';
                return `'${vals.shift()}'`;
            });
        })
    };
}

/**
 * Mock MySQL module for unit tests
 * @returns {Object} Mock MySQL module
 */
function createMockMySQLModule() {
    const mockConnection = createMockConnection();

    return {
        createConnection: sinon.stub().returns(mockConnection),
        createPool: sinon.stub().returns({
            getConnection: sinon.stub().resolves(mockConnection),
            end: sinon.stub().resolves({})
        }),
        format: mockConnection.format,
        escape: mockConnection.escape
    };
}

module.exports = {
    createMockConnection,
    createMockMySQLModule
}; 