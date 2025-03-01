#!/bin/bash

# Script to run all tests (unit and integration) locally

# Check if debug mode is enabled
DEBUG_ENV=""
DEBUG_PARAM=""
if [ "$1" = "debug" ]; then
    DEBUG_ENV="NODE_DEBUG=mysql,net,stream"
    DEBUG_PARAM="debug"
    echo "Debug mode enabled. Debug logs will be displayed."
fi

# Set max retry count for integration tests
MAX_RETRIES=2
RETRY_COUNT=0

# First run unit tests
echo "Running unit tests..."
env $DEBUG_ENV npm run test:unit

# Capture the unit tests exit code
UNIT_EXIT_CODE=$?

if [ $UNIT_EXIT_CODE -ne 0 ]; then
    echo "Unit tests failed with exit code $UNIT_EXIT_CODE"
    if [ "$1" = "debug" ]; then
        echo "Debug information: Unit tests exited with code $UNIT_EXIT_CODE"
    fi
    exit $UNIT_EXIT_CODE
fi

# Then run integration tests with Docker, with retry logic
echo "Running integration tests with Docker..."

run_integration_tests() {
    ./scripts/run-integration-tests.sh $DEBUG_PARAM
    return $?
}

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    run_integration_tests
    INTEGRATION_EXIT_CODE=$?
    
    if [ $INTEGRATION_EXIT_CODE -eq 0 ]; then
        # Tests passed, exit the loop
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "Integration tests failed with exit code $INTEGRATION_EXIT_CODE. Retrying ($RETRY_COUNT/$MAX_RETRIES)..."
            # Wait a bit before retrying
            sleep 5
        else
            echo "Integration tests failed after $MAX_RETRIES attempts."
            if [ "$1" = "debug" ]; then
                echo "Debug information: Integration tests exited with code $INTEGRATION_EXIT_CODE"
            fi
        fi
    fi
done

# Exit with the integration tests exit code
exit $INTEGRATION_EXIT_CODE 