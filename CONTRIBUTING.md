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
3. Run tests with `npm test`

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
docker-compose up -d

# Run integration tests
npm run test:integration

# Stop MySQL container when done
docker-compose down
```

For convenience, you can use the provided script to run the integration tests with Docker:

```bash
# This will start MySQL, run the tests, and stop MySQL automatically
npm run test:integration:docker
```

You can also configure the MySQL connection using environment variables:

```bash
MYSQL_HOST=localhost MYSQL_PORT=3306 MYSQL_DATABASE=test MYSQL_USER=root MYSQL_PASSWORD=password npm run test:integration
```

### Running All Tests

To run both unit and integration tests:

```bash
npm test
```

If you want to run all tests with Docker handling the MySQL database:

```bash
npm run test:docker
```

This will run the unit tests first, and if they pass, it will run the integration tests with Docker.

## Test Structure

- Unit tests are located in `test/unit/*.spec.js`
- Integration tests are located in `test/integration/*.spec.js`
- Test helpers are in:
  - `test/unit/helpers/` - Helpers for unit tests (mocks, etc.)
  - `test/integration/helpers/` - Helpers for integration tests (database setup, etc.)

## Integration Test Environment

The integration tests use a MySQL 8.0 container with the following configuration:

- Host: localhost
- Port: 3306
- Database: test
- User: root
- Password: password

This is configured in the `docker-compose.yml` file and used by the GitHub Actions workflow for CI.

## Continuous Integration

The project uses GitHub Actions for continuous integration. Two workflows are configured:

1. **CI** - Runs unit tests on pull requests and pushes to master
2. **Integration Tests** - Runs both unit and integration tests with a MySQL service container

## Pull Request Process

1. Ensure your code passes all tests
2. Update documentation if necessary
3. The PR should work in all supported Node.js versions (currently 18, 20, 22)
4. Your PR will be reviewed by maintainers who may request changes

## Coding Standards

- Follow the existing code style
- Write tests for new features
- Keep the code simple and maintainable
- Document public APIs

## License

By contributing to serverless-mysql, you agree that your contributions will be licensed under the project's MIT License. 