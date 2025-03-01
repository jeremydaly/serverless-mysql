# Serverless MySQL Release Thumbnail Generator

This directory contains tools for generating release thumbnails for the Serverless MySQL project.

## Summary of Tools

| Tool | Description |
|------|-------------|
| `create-thumbnail.js` | Basic thumbnail generator with version, features, and announcement customization |
| `create-thumbnail-advanced.js` | Advanced generator with additional customization for colors, background styles, and text |
| `generate-release-thumbnails.sh` | Batch generator for creating thumbnails for multiple versions at once |
| `features.json` | Sample JSON file with features for different versions |
| `thumbnail-cli.js` | Unified command-line interface for all thumbnail generation tools |

All tools generate PNG images with dimensions of 1200x1200 pixels, suitable for social media posts and release announcements.

## Unified CLI

The `thumbnail-cli.js` script provides a unified command-line interface for all thumbnail generation tools.

```bash
# Display help
./thumbnail-cli.js help

# Generate a basic thumbnail
./thumbnail-cli.js basic --version=2.2.0

# Generate an advanced thumbnail with pattern background
./thumbnail-cli.js advanced --version=2.2.0 --backgroundStyle=pattern

# Generate thumbnails for multiple versions
./thumbnail-cli.js batch --versions=2.0.0,2.1.0,2.2.0 --features=features.json
```

See `./thumbnail-cli.js help` for a complete list of available options.

## Basic Thumbnail Generator

The `create-thumbnail.js` script allows you to generate customized release thumbnails with different versions, features, and announcements.

### Prerequisites

- Node.js installed
- The script will automatically install the required `sharp` package if not already installed

### Usage

```bash
# Basic usage with default values
./create-thumbnail.js

# Customize version
./create-thumbnail.js --version=2.2.0

# Customize features (comma-separated list)
./create-thumbnail.js --features="Enhanced Query Retries,Improved SQL Logging,Better Connection Management,New Event Handlers"

# Customize announcement text
./create-thumbnail.js --announcement="JUST RELEASED!"

# Customize output path
./create-thumbnail.js --output=./my-custom-thumbnail.png

# Combine multiple options
./create-thumbnail.js --version=2.2.0 --features="Feature 1,Feature 2,Feature 3,Feature 4" --announcement="NEW VERSION!" --output=./v2.2.0-thumbnail.png
```

### Default Values

If not specified, the script uses these default values:
- Version: `2.1.0`
- Features:
  - Query Retries with Backoff Strategies
  - SQL Logging with Parameter Substitution
  - User Switching for Different Permissions
  - Comprehensive Integration Tests
- Announcement: `NOW AVAILABLE!`
- Output path: `./thumbnail.png` (in the assets directory)

## Advanced Thumbnail Generator

The `create-thumbnail-advanced.js` script provides more customization options, including colors, background styles, and text content.

### Usage

```bash
# Basic usage with default values
./create-thumbnail-advanced.js

# Display help with all available options
./create-thumbnail-advanced.js --help

# Change colors
./create-thumbnail-advanced.js --primaryColor=#336699 --secondaryColor=#FF9900

# Change background style
./create-thumbnail-advanced.js --backgroundStyle=pattern
./create-thumbnail-advanced.js --backgroundStyle=solid --backgroundColor1=#f0f8ff

# Customize text content
./create-thumbnail-advanced.js --tagline="A Better MySQL Client for Serverless" --title="New Features"

# Full customization example
./create-thumbnail-advanced.js \
  --version=2.2.0 \
  --features="Feature 1,Feature 2,Feature 3,Feature 4" \
  --tagline="Custom Tagline" \
  --title="Release Highlights" \
  --announcement="NEW RELEASE!" \
  --primaryColor=#336699 \
  --secondaryColor=#FF9900 \
  --backgroundColor1=#f0f8ff \
  --backgroundColor2=#ffffff \
  --backgroundStyle=pattern \
  --output=./custom-thumbnail.png
```

### Additional Options

The advanced script supports all options from the basic script plus:
- `--tagline` - Custom tagline text
- `--title` - Custom title for the "What's New" section
- `--primaryColor` - Primary brand color (default: #3D7E9A)
- `--secondaryColor` - Secondary brand color (default: #F39C12)
- `--backgroundColor1` - First background color (default: #e6f7ff)
- `--backgroundColor2` - Second background color (default: #ffffff)
- `--textColor` - Main text color (default: #000000)
- `--taglineColor` - Tagline text color (default: #555555)
- `--featureColor` - Feature text color (default: #333333)
- `--backgroundStyle` - Background style: gradient, solid, or pattern (default: gradient)

## Output

Both scripts generate PNG images with dimensions of 1200x1200 pixels, suitable for social media posts and release announcements.

## Examples

### Basic Thumbnail
![Basic Thumbnail](thumbnail.png)

### Pattern Background Thumbnail
![Pattern Thumbnail](pattern-thumbnail.png)

## Customization

If you need to customize the design further (layout, fonts, etc.), you can modify the `generateSvgTemplate()` function in either script.

## Batch Thumbnail Generation

The `generate-release-thumbnails.sh` script allows you to generate thumbnails for multiple versions at once, using both the basic and advanced generators.

### Usage

```bash
# Generate thumbnails for default version (2.1.0)
./generate-release-thumbnails.sh

# Generate thumbnails for specific versions
./generate-release-thumbnails.sh --versions 2.0.0,2.1.0,2.2.0

# Generate thumbnails with custom features from a JSON file
./generate-release-thumbnails.sh --versions 2.0.0,2.1.0,2.2.0 --features features.json

# Display help
./generate-release-thumbnails.sh --help
```

### Features JSON Format

The `features.json` file allows you to specify different features for each version. The file should have the following format:

```json
{
  "2.0.0": [
    "Feature 1 for version 2.0.0",
    "Feature 2 for version 2.0.0",
    "Feature 3 for version 2.0.0",
    "Feature 4 for version 2.0.0"
  ],
  "2.1.0": [
    "Feature 1 for version 2.1.0",
    "Feature 2 for version 2.1.0",
    "Feature 3 for version 2.1.0",
    "Feature 4 for version 2.1.0"
  ]
}
```

### Output

The script creates a `releases` directory and generates three thumbnails for each version:
- `v{VERSION}-thumbnail.png` - Basic thumbnail
- `v{VERSION}-pattern-thumbnail.png` - Thumbnail with pattern background
- `v{VERSION}-solid-thumbnail.png` - Thumbnail with solid background 