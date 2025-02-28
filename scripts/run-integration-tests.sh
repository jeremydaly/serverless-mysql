#!/bin/bash

# Script to run integration tests locally

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker to run the integration tests."
    exit 1
fi

# Check if Docker Compose is installed
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "Docker Compose is not installed. Please install Docker Compose to run the integration tests."
    exit 1
fi

# Start MySQL container
echo "Starting MySQL container..."
$DOCKER_COMPOSE up -d

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
for i in {1..30}; do
    if $DOCKER_COMPOSE exec -T mysql mysqladmin ping -h localhost -u root -ppassword &> /dev/null; then
        echo "MySQL is ready!"
        break
    fi
    echo "Waiting for MySQL to start... ($i/30)"
    sleep 1
    if [ $i -eq 30 ]; then
        echo "MySQL failed to start within 30 seconds."
        $DOCKER_COMPOSE down
        exit 1
    fi
done

# Run the integration tests
echo "Running integration tests..."
# Use the root user for tests to ensure we have all necessary permissions
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_DATABASE=test MYSQL_USER=root MYSQL_PASSWORD=password npm run test:integration

# Capture the exit code
EXIT_CODE=$?

# Stop the MySQL container
echo "Stopping MySQL container..."
$DOCKER_COMPOSE down

# Exit with the same code as the tests
exit $EXIT_CODE 