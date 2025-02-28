# Unit Tests

This directory contains unit tests for the serverless-mysql module. Unit tests focus on testing individual components in isolation, without requiring a database connection.

## Running Unit Tests

```bash
npm run test:unit
```

## Directory Structure

- `*.spec.js` - Unit test files
- `helpers/` - Helper functions and mocks for unit tests

## Writing Unit Tests

When writing unit tests, use the helpers in the `helpers/` directory to mock MySQL connections and other dependencies. This allows you to test the module's functionality without requiring a real database connection.

Example:

```javascript
const { expect } = require('chai');
const sinon = require('sinon');
const { createMockMySQLModule } = require('./helpers/mocks');

describe('My Test Suite', function() {
  it('should do something', function() {
    // Arrange
    const mockMySQL = createMockMySQLModule();
    
    // Act
    // ... test code ...
    
    // Assert
    expect(result).to.equal(expectedValue);
  });
}); 