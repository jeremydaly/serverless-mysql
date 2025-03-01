#!/usr/bin/env node

/**
 * Serverless MySQL Thumbnail CLI
 * 
 * A unified command-line interface for all thumbnail generation tools.
 * 
 * Usage: node thumbnail-cli.js [command] [options]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define commands
const COMMANDS = {
    BASIC: 'basic',
    ADVANCED: 'advanced',
    BATCH: 'batch',
    HELP: 'help'
};

// Parse command line arguments
const args = process.argv.slice(2);
const command = args.length > 0 ? args[0].toLowerCase() : COMMANDS.HELP;
const options = args.slice(1).reduce((acc, arg) => {
    if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        acc[key] = value;
    }
    return acc;
}, {});

// Display help information
function showHelp() {
    console.log(`
Serverless MySQL Thumbnail CLI

Usage: node thumbnail-cli.js [command] [options]

Commands:
  basic     Generate a basic thumbnail
  advanced  Generate an advanced thumbnail with more customization options
  batch     Generate multiple thumbnails for different versions
  help      Display this help message

Basic Options:
  --version=X.X.X           Set the version number (default: 2.1.0)
  --features="F1,F2,F3,F4"  Set comma-separated features list
  --announcement="Text"     Set the announcement banner text
  --output=PATH             Set the output file path

Advanced Options (includes all Basic Options plus):
  --tagline="Text"          Set the tagline text
  --title="Text"            Set the title for the "What's New" section
  --primaryColor=#RRGGBB    Set the primary color (default: #3D7E9A)
  --secondaryColor=#RRGGBB  Set the secondary color (default: #F39C12)
  --backgroundColor1=#RRGGBB Set the first background color (default: #e6f7ff)
  --backgroundColor2=#RRGGBB Set the second background color (default: #ffffff)
  --textColor=#RRGGBB       Set the main text color (default: #000000)
  --taglineColor=#RRGGBB    Set the tagline text color (default: #555555)
  --featureColor=#RRGGBB    Set the feature text color (default: #333333)
  --backgroundStyle=TYPE    Set background style: gradient, solid, or pattern (default: gradient)

Batch Options:
  --versions=V1,V2,V3       Comma-separated list of versions (default: 2.1.0)
  --features=PATH           Path to a JSON file with features for each version
  --output-dir=PATH         Directory to save thumbnails (default: ./releases)

Examples:
  node thumbnail-cli.js basic --version=2.2.0
  node thumbnail-cli.js advanced --version=2.2.0 --backgroundStyle=pattern
  node thumbnail-cli.js batch --versions=2.0.0,2.1.0,2.2.0 --features=features.json
  `);
}

// Execute a command with the given script and options
function executeCommand(script, cmdOptions) {
    const optionsString = Object.entries(cmdOptions)
        .map(([key, value]) => `--${key}=${value}`)
        .join(' ');

    const command = `${script} ${optionsString}`;
    console.log(`Executing: ${command}`);

    try {
        execSync(command, { stdio: 'inherit' });
        console.log('Command completed successfully!');
    } catch (error) {
        console.error('Error executing command:', error.message);
        process.exit(1);
    }
}

// Main function to handle commands
function main() {
    const scriptDir = path.dirname(process.argv[1]);

    switch (command) {
        case COMMANDS.BASIC:
            executeCommand(
                path.join(scriptDir, 'create-thumbnail.js'),
                options
            );
            break;

        case COMMANDS.ADVANCED:
            executeCommand(
                path.join(scriptDir, 'create-thumbnail-advanced.js'),
                options
            );
            break;

        case COMMANDS.BATCH:
            // Prepare options for the batch script
            const batchOptions = Object.assign({}, options);

            // Handle output directory
            if (batchOptions['output-dir']) {
                // The shell script expects the output directory to be handled internally
                delete batchOptions['output-dir'];
            }

            executeCommand(
                path.join(scriptDir, 'generate-release-thumbnails.sh'),
                batchOptions
            );
            break;

        case COMMANDS.HELP:
        default:
            showHelp();
            break;
    }
}

// Run the CLI
main(); 