# Tests

This directory contains tests for the serverless-mysql module. The tests are organized into two main categories:

- **Unit Tests** - Tests that focus on individual components in isolation
- **Integration Tests** - Tests that verify the module works correctly with a real MySQL database

## Running Tests

```bash
# Run unit tests only
npm run test:unit

# Run integration tests only (requires MySQL)
npm run test:integration

# Run integration tests with Docker
npm run test:integration:docker

# Run all tests (requires MySQL)
npm test

# Run all tests with Docker
npm run test:docker
```

## Directory Structure

```
test/
├── README.md                 # This file
├── unit/                     # Unit tests
│   ├── README.md             # Unit tests documentation
│   ├── *.spec.js             # Unit test files
│   └── helpers/              # Helper functions for unit tests
│       └── mocks.js          # Mock objects for unit tests
└── integration/              # Integration tests
    ├── README.md             # Integration tests documentation
    ├── *.spec.js             # Integration test files
    └── helpers/              # Helper functions for integration tests
        └── setup.js          # Database setup helpers
```

## Writing Tests

See the README.md files in the respective directories for more information on writing unit and integration tests.

For more information on contributing to the project, including testing guidelines, see [CONTRIBUTING.md](../CONTRIBUTING.md). 