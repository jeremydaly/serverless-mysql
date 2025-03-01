#!/bin/bash

# Serverless MySQL Release Thumbnail Generator Script
# This script generates thumbnails for multiple versions using both basic and advanced generators

# Set the base directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create output directory if it doesn't exist
mkdir -p releases

# Function to display usage information
show_usage() {
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  -v, --versions VERSION1,VERSION2,...  Comma-separated list of versions to generate thumbnails for"
  echo "  -f, --features FILE                   Path to a JSON file containing features for each version"
  echo "  -h, --help                            Display this help message"
  echo ""
  echo "Example:"
  echo "  $0 --versions 2.0.0,2.1.0,2.2.0"
  echo "  $0 --versions 2.0.0,2.1.0 --features features.json"
}

# Parse command line arguments
VERSIONS="2.1.0"
FEATURES_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--versions)
      VERSIONS="$2"
      shift 2
      ;;
    -f|--features)
      FEATURES_FILE="$2"
      shift 2
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_usage
      exit 1
      ;;
  esac
done

# Convert comma-separated versions to array
IFS=',' read -ra VERSION_ARRAY <<< "$VERSIONS"

# Function to get features for a version from JSON file
get_features() {
  local version="$1"
  local file="$2"
  
  if [[ -f "$file" ]]; then
    # Extract features for the given version using jq if available
    if command -v jq &> /dev/null; then
      jq -r ".[\"$version\"] | join(\",\")" "$file" 2>/dev/null
    else
      echo "Warning: jq not found. Using default features."
      echo ""
    fi
  else
    echo ""
  fi
}

echo "Generating thumbnails for versions: ${VERSIONS}"
echo "----------------------------------------"

# Generate thumbnails for each version
for version in "${VERSION_ARRAY[@]}"; do
  echo "Generating thumbnails for version $version..."
  
  # Get features for this version if features file is provided
  features=""
  if [[ -n "$FEATURES_FILE" ]]; then
    features=$(get_features "$version" "$FEATURES_FILE")
  fi
  
  # Set features parameter if features were found
  features_param=""
  if [[ -n "$features" && "$features" != "null" ]]; then
    features_param="--features=\"$features\""
  fi
  
  # Generate basic thumbnail
  echo "  Creating basic thumbnail..."
  cmd="./create-thumbnail.js --version=$version $features_param --output=./releases/v${version}-thumbnail.png"
  eval "$cmd"
  
  # Generate pattern background thumbnail
  echo "  Creating pattern background thumbnail..."
  cmd="./create-thumbnail-advanced.js --version=$version $features_param --backgroundStyle=pattern --output=./releases/v${version}-pattern-thumbnail.png"
  eval "$cmd"
  
  # Generate solid background thumbnail
  echo "  Creating solid background thumbnail..."
  cmd="./create-thumbnail-advanced.js --version=$version $features_param --backgroundStyle=solid --backgroundColor1=#f0f8ff --output=./releases/v${version}-solid-thumbnail.png"
  eval "$cmd"
  
  echo "  Done with version $version"
  echo "----------------------------------------"
done

echo "All thumbnails generated successfully!"
echo "Thumbnails are available in the 'releases' directory." 