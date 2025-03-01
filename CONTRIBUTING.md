# Contributing to serverless-mysql

Thank you for considering contributing to serverless-mysql! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up MySQL for testing:
   - Option 1: Install MySQL locally
   - Option 2: Use Docker (recommended):
     ```bash
     docker compose up -d
     ```
4. Run unit tests with `npm run test:unit`
5. Run integration tests with `npm run test:integration` (requires MySQL)
6. Or run all tests with Docker handling MySQL automatically:
   ```bash
   npm run test:docker
   ```

## Running Tests

The project includes both unit tests and integration tests to ensure everything works correctly.

### Unit Tests

Unit tests don't require any external dependencies and can be run with:

```bash
npm run test:unit
```

### Integration Tests

Integration tests require a MySQL database. You can use the included Docker Compose file to start a MySQL instance:

```bash
# Start MySQL container
docker compose up -d

# Run integration tests
npm run test:integration

# Stop MySQL container when done
docker compose down
```

For convenience, you can use the provided script to run the integration tests with Docker:

```bash
# This will start MySQL, run the tests, and stop MySQL automatically
npm run test:integration:docker
```

The script includes a watchdog process that will automatically terminate tests if they run for too long (60 seconds), which helps prevent hanging test processes.

You can also configure the MySQL connection using environment variables:

```bash
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_DATABASE=serverless_mysql_test MYSQL_USER=root MYSQL_PASSWORD=password npm run test:integration
```

### Running All Tests

To run both unit and integration tests:

```bash
npm test
```

**Important:** The `npm test` command requires a running MySQL instance, as it runs both unit and integration tests. If you don't have MySQL running, the tests will fail with connection errors. Use one of these approaches:

1. Start MySQL manually before running tests:
   ```bash
   docker compose up -d
   npm test
   docker compose down
   ```

2. Use the Docker-managed test script instead, which handles MySQL automatically:
   ```bash
   npm run test:docker
   ```

If you want to run all tests with Docker handling the MySQL database:

```bash
npm run test:docker
```

This will run the unit tests first, and if they pass, it will run the integration tests with Docker.

### Test Coverage

To run tests with coverage reporting:

```bash
npm run test-cov
```

This will generate an HTML coverage report in the `coverage` directory.

## Test Structure

- Unit tests are located in `test/unit/*.spec.js`
- Integration tests are located in `test/integration/*.spec.js`
- Test helpers are in:
  - `test/unit/helpers/` - Helpers for unit tests (mocks, etc.)
  - `test/integration/helpers/` - Helpers for integration tests (database setup, etc.)

## Integration Test Environment

The integration tests support multiple MySQL versions in the CI environment to ensure compatibility across different database environments. The GitHub Actions workflow is configured to test against:

- MySQL 5 (latest in the 5.x series)
- MySQL LTS (Long Term Support version)

For local development, the `docker-compose.yml` file includes a single MySQL service using the `mysql:lts` image to ensure we always test against the most recent Long Term Support version. The connection details are:

- Host: 127.0.0.1
- Port: 3306
- Database: serverless_mysql_test
- User: root
- Password: password

```bash
# Start MySQL container
docker compose up -d

# Run integration tests
npm run test:integration

# Stop MySQL container when done
docker compose down
```

The MySQL container is configured with:
- 1000 max connections
- Extended wait timeout (28800 seconds)

The GitHub Actions workflow runs integration tests against both MySQL versions to ensure compatibility.

## Continuous Integration

The project uses GitHub Actions for continuous integration. Two workflows are configured:

1. **Unit Tests** - Runs unit tests and linting on pull requests and pushes to master
2. **Integration Tests** - Runs both unit and integration tests with a MySQL service container

Both workflows run on Node.js versions 18, 20, and 22 to ensure compatibility across supported versions.

## Pull Request Process

1. Ensure your code passes all tests and linting
2. Update documentation if necessary
3. The PR should work in all supported Node.js versions (currently 18, 20, 22)
4. Your PR will be reviewed by maintainers who may request changes

## Coding Standards

- Follow the existing code style
- Write tests for new features
- Keep the code simple and maintainable
- Document public APIs
- Run `npm run lint` to check your code against our ESLint rules

## Connection Management

When working on connection management features, be particularly careful about:
- Properly closing connections to prevent leaks
- Handling timeouts and error conditions
- Testing with concurrent connections
- Ensuring compatibility with serverless environments

## License

By contributing to serverless-mysql, you agree that your contributions will be licensed under the project's MIT License. 