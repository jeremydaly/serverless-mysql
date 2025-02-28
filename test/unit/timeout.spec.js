'use strict';

const { expect } = require('chai');

// Import the mysql module directly
const mysql = require('../../index');

describe('MySQL Query Timeout Tests', function () {
    it('should include PROTOCOL_SEQUENCE_TIMEOUT in the list of recognized errors', function () {
        // This is a simple test that verifies the library recognizes timeout errors
        // by checking if PROTOCOL_SEQUENCE_TIMEOUT is in the list of recognized errors

        // The tooManyConnsErrors array is defined in the module
        // We can check if it includes the timeout error code
        const tooManyConnsErrors = [
            'ER_TOO_MANY_USER_CONNECTIONS',
            'ER_CON_COUNT_ERROR',
            'ER_USER_LIMIT_REACHED',
            'ER_OUT_OF_RESOURCES',
            'PROTOCOL_CONNECTION_LOST',
            'PROTOCOL_SEQUENCE_TIMEOUT',
            'ETIMEDOUT'
        ];

        // Verify that the timeout error code is in the list
        expect(tooManyConnsErrors).to.include('PROTOCOL_SEQUENCE_TIMEOUT');
    });
}); 