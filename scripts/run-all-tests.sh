#!/bin/bash

# Script to run all tests (unit and integration) locally

# First run unit tests
echo "Running unit tests..."
npm run test:unit

# Capture the unit tests exit code
UNIT_EXIT_CODE=$?

if [ $UNIT_EXIT_CODE -ne 0 ]; then
    echo "Unit tests failed with exit code $UNIT_EXIT_CODE"
    exit $UNIT_EXIT_CODE
fi

# Then run integration tests with Docker
echo "Running integration tests with Docker..."
./scripts/run-integration-tests.sh

# Capture the integration tests exit code
INTEGRATION_EXIT_CODE=$?

# Exit with the integration tests exit code
exit $INTEGRATION_EXIT_CODE 