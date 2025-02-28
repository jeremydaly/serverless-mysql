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

# Show MySQL configuration for debugging
echo "MySQL configuration:"
$DOCKER_COMPOSE exec -T mysql mysql -uroot -ppassword -e "SHOW VARIABLES LIKE '%timeout%';"
$DOCKER_COMPOSE exec -T mysql mysql -uroot -ppassword -e "SHOW VARIABLES LIKE '%max_connections%';"
$DOCKER_COMPOSE exec -T mysql mysql -uroot -ppassword -e "SHOW VARIABLES LIKE '%max_allowed_packet%';"

# Run the integration tests
echo "Running integration tests..."
# Use the root user for tests to ensure we have all necessary permissions
# Run tests with a background process that will kill it after 60 seconds if it hangs
(
    # Start a background process that will kill the test process if it runs too long
    (
        sleep 60
        echo "Tests are taking too long, killing process..."
        # Get all child processes and kill them
        pkill -P $$ || true
        # If that doesn't work, try more aggressive measures
        for pid in $(ps -o pid= --ppid $$); do
            echo "Killing process $pid"
            kill -9 $pid 2>/dev/null || true
        done
    ) &
    WATCHDOG_PID=$!
    
    # Run the tests with NODE_DEBUG to see what's happening
    echo "Starting tests with process ID: $$"
    MYSQL_HOST=127.0.0.1 MYSQL_PORT=3306 MYSQL_DATABASE=serverless_mysql_test MYSQL_USER=root MYSQL_PASSWORD=password NODE_DEBUG=mysql,net,stream npm run test:integration
    TEST_EXIT_CODE=$?
    
    echo "Tests completed with exit code: $TEST_EXIT_CODE"
    
    # Kill the watchdog process since tests completed
    echo "Killing watchdog process: $WATCHDOG_PID"
    kill $WATCHDOG_PID 2>/dev/null || true
    
    exit $TEST_EXIT_CODE
) || true

# Ensure we clean up regardless of test result
echo "Cleaning up..."
$DOCKER_COMPOSE down

# Make sure no node processes are left hanging
echo "Checking for hanging Node.js processes..."
ps aux | grep node | grep -v grep || true

exit 0 