#!/bin/bash

# Script to run integration tests locally

# Check if debug mode is enabled
DEBUG_ENV=""
if [ "$1" = "debug" ]; then
    DEBUG_ENV="NODE_DEBUG=mysql,net,stream"
    echo "Debug mode enabled. Debug logs will be displayed."
fi

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

# Add a more robust check to ensure MySQL is fully ready for connections
echo "Verifying MySQL connection stability..."
connection_success=false
for i in {1..5}; do
    echo "Connection test $i/5..."
    if ! $DOCKER_COMPOSE exec -T mysql mysql -uroot -ppassword -e "SELECT 1;" &> /dev/null; then
        echo "MySQL connection test failed. Waiting a bit longer..."
        sleep 2
    else
        echo "Connection test successful."
        connection_success=true
        break
    fi
done

if [ "$connection_success" = false ]; then
    echo "Warning: All connection tests failed. Proceeding anyway, but tests might fail."
fi

# Final stabilization delay
echo "Waiting for MySQL to stabilize..."
sleep 5

# Show MySQL configuration for debugging
if [ "$1" = "debug" ]; then
    echo "MySQL configuration:"
    $DOCKER_COMPOSE exec -T mysql mysql -uroot -ppassword -e "SHOW VARIABLES LIKE '%timeout%';"
    $DOCKER_COMPOSE exec -T mysql mysql -uroot -ppassword -e "SHOW VARIABLES LIKE '%max_connections%';"
    $DOCKER_COMPOSE exec -T mysql mysql -uroot -ppassword -e "SHOW VARIABLES LIKE '%max_allowed_packet%';"
fi

# Prepare the database for tests
echo "Preparing test database..."
$DOCKER_COMPOSE exec -T mysql mysql -uroot -ppassword -e "DROP DATABASE IF EXISTS serverless_mysql_test; CREATE DATABASE serverless_mysql_test;"

# Run the integration tests
echo "Running integration tests..."
(
    (
        sleep 90  # Increased timeout for tests
        echo "Tests are taking too long, killing process..."
        pkill -P $$ || true
        for pid in $(ps -o pid= --ppid $$); do
            echo "Killing process $pid"
            kill -9 $pid 2>/dev/null || true
        done
    ) &
    WATCHDOG_PID=$!
    
    if [ "$1" = "debug" ]; then
        echo "Starting tests with process ID: $$"
    fi
    
    # Add connection retry parameters to MySQL connection
    MYSQL_HOST=127.0.0.1 \
    MYSQL_PORT=3306 \
    MYSQL_DATABASE=serverless_mysql_test \
    MYSQL_USER=root \
    MYSQL_PASSWORD=password \
    MYSQL_CONNECT_TIMEOUT=10000 \
    MYSQL_RETRY_COUNT=3 \
    env $DEBUG_ENV npm run test:integration
    
    TEST_EXIT_CODE=$?
    
    echo "Tests completed with exit code: $TEST_EXIT_CODE"
    
    if [ "$1" = "debug" ]; then
        echo "Killing watchdog process: $WATCHDOG_PID"
    fi
    
    kill $WATCHDOG_PID 2>/dev/null || true
    
    exit $TEST_EXIT_CODE
) || true

# Ensure we clean up regardless of test result
echo "Cleaning up..."
$DOCKER_COMPOSE down

# Make sure no node processes are left hanging
if [ "$1" = "debug" ]; then
    echo "Checking for hanging Node.js processes..."
    ps aux | grep node | grep -v grep || true
fi

exit 0 