# Integration Tests

This directory contains integration tests for the serverless-mysql module. Integration tests verify that the module works correctly with a real MySQL database.

## Running Integration Tests

```bash
# With a local MySQL instance
npm run test:integration

# With Docker (recommended)
npm run test:integration:docker
```

## Directory Structure

- `*.spec.js` - Integration test files
- `helpers/` - Helper functions for integration tests (database setup, connection management, etc.)

## Writing Integration Tests

When writing integration tests, use the helpers in the `helpers/` directory to set up the database and manage connections. This makes the tests more consistent and easier to maintain.

Example:

```javascript
const { expect } = require('chai');
const { 
  createTestConnection, 
  setupTestTable,
  cleanupTestTable,
  closeConnection 
} = require('./helpers/setup');

describe('My Integration Test Suite', function() {
  let db;
  const TEST_TABLE = 'test_table';
  const TABLE_SCHEMA = `
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
  `;

  before(async function() {
    // Initialize the serverless-mysql instance
    db = createTestConnection();

    // Create and set up the test table
    await setupTestTable(db, TEST_TABLE, TABLE_SCHEMA);
  });

  after(async function() {
    // Clean up the test table
    await cleanupTestTable(db, TEST_TABLE);
    
    // Close the connection after tests
    await closeConnection(db);
  });

  it('should do something with the database', async function() {
    // Test code that interacts with the database
    const result = await db.query('SELECT 1 AS value');
    expect(result[0].value).to.equal(1);
  });
}); 