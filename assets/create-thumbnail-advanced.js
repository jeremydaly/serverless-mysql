#!/usr/bin/env node

/**
 * Serverless MySQL Advanced Thumbnail Generator
 * 
 * This script generates a highly customized thumbnail for releases based on a template SVG.
 * It allows customization of version, features, colors, tagline, and background style.
 * 
 * Usage: node create-thumbnail-advanced.js [options]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
    if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        acc[key] = value;
    }
    return acc;
}, {});

// Default values
const config = {
    // Content
    version: args.version || '2.1.0',
    features: args.features ? args.features.split(',') : [
        'Query Retries with Backoff Strategies',
        'SQL Logging with Parameter Substitution',
        'User Switching for Different Permissions',
        'Comprehensive Integration Tests'
    ],
    tagline: args.tagline || 'Connection Management at Serverless Scale',
    announcement: args.announcement || 'NOW AVAILABLE!',
    title: args.title || 'What\'s New',

    // Colors
    primaryColor: args.primaryColor || '#3D7E9A', // Blue
    secondaryColor: args.secondaryColor || '#F39C12', // Orange
    backgroundColor1: args.backgroundColor1 || '#e6f7ff',
    backgroundColor2: args.backgroundColor2 || '#ffffff',
    textColor: args.textColor || '#000000',
    taglineColor: args.taglineColor || '#555555',
    featureColor: args.featureColor || '#333333',

    // Layout
    backgroundStyle: args.backgroundStyle || 'gradient', // gradient, solid, or pattern

    // Output
    outputPath: args.output || path.join(__dirname, 'thumbnail.png'),
    tempSvgPath: path.join(__dirname, 'temp-thumbnail.svg')
};

// Create SVG template
function generateSvgTemplate() {
    // Generate feature bullet points
    const featureElements = config.features.map((feature, index) => {
        return `        <tspan x="0" y="${index * 60}">• ${feature}</tspan>`;
    }).join('\n');

    // Generate background based on style
    let backgroundDefs = '';
    let backgroundFill = '';

    switch (config.backgroundStyle) {
        case 'gradient':
            backgroundDefs = `
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${config.backgroundColor1}" />
      <stop offset="100%" stop-color="${config.backgroundColor2}" />
    </linearGradient>`;
            backgroundFill = 'url(#bg-gradient)';
            break;
        case 'pattern':
            backgroundDefs = `
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${config.backgroundColor1}" />
      <stop offset="100%" stop-color="${config.backgroundColor2}" />
    </linearGradient>
    <pattern id="dots-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="1.5" fill="${config.primaryColor}" opacity="0.1" />
    </pattern>`;
            backgroundFill = 'url(#bg-gradient)';
            break;
        case 'solid':
        default:
            backgroundFill = config.backgroundColor1;
            break;
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="1200" height="1200" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
  <!-- Background with gradient -->
  <defs>${backgroundDefs}
  </defs>
  
  <!-- Main background -->
  <rect width="1200" height="1200" fill="${backgroundFill}" rx="12" ry="12" />
  ${config.backgroundStyle === 'pattern' ? `<rect width="1200" height="1200" fill="url(#dots-pattern)" opacity="0.5" rx="12" ry="12" />` : ''}
  
  <!-- Version badge -->
  <g transform="translate(1020, 80)">
    <rect x="-80" y="-30" width="160" height="60" rx="30" ry="30" fill="${config.primaryColor}" />
    <text x="0" y="10" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">v${config.version}</text>
  </g>
  
  <!-- Logo -->
  <g transform="translate(600, 400)">
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="120" font-weight="bold" text-anchor="middle">
      <tspan x="0" y="0" fill="${config.textColor}">Serverless</tspan>
      <tspan x="-120" y="120" fill="${config.primaryColor}">My</tspan><tspan dx="25" x="60" y="120" fill="${config.secondaryColor}">SQL</tspan>
    </text>
  </g>
  
  <!-- Tagline -->
  <text x="600" y="580" font-family="Arial, sans-serif" font-size="36" fill="${config.taglineColor}" text-anchor="middle">
    ${config.tagline}
  </text>
  
  <!-- What's New Title -->
  <g transform="translate(600, 680)">
    <rect x="-320" y="-50" width="640" height="70" rx="10" ry="10" fill="rgba(${hexToRgb(config.primaryColor)}, 0.1)" />
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="${config.primaryColor}" text-anchor="middle">
      ✨ ${config.title}
    </text>
  </g>
  
  <!-- Features as bullet points -->
  <g transform="translate(300, 750)">
    <g>
      <text x="0" y="0" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="${config.featureColor}">
${featureElements}
      </text>
    </g>
  </g>
  
  <!-- Announcement banner -->
  <g transform="translate(600, 1100)">
    <rect x="-180" y="-40" width="360" height="80" rx="40" ry="40" fill="rgba(${hexToRgb(config.secondaryColor)}, 0.9)" />
    <text x="0" y="12" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${config.announcement}</text>
  </g>
</svg>`;
}

// Helper function to convert hex to rgb
function hexToRgb(hex) {
    // Remove the hash
    hex = hex.replace(/^#/, '');

    // Parse the hex values
    let bigint = parseInt(hex, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;

    return `${r}, ${g}, ${b}`;
}

// Main function to generate thumbnail
async function generateThumbnail() {
    try {
        console.log('Generating thumbnail with the following configuration:');
        console.log(`- Version: ${config.version}`);
        console.log(`- Features: ${config.features.join(', ')}`);
        console.log(`- Tagline: ${config.tagline}`);
        console.log(`- Background Style: ${config.backgroundStyle}`);
        console.log(`- Primary Color: ${config.primaryColor}`);
        console.log(`- Secondary Color: ${config.secondaryColor}`);
        console.log(`- Output: ${config.outputPath}`);

        // Generate SVG content
        const svgContent = generateSvgTemplate();

        // Write temporary SVG file
        fs.writeFileSync(config.tempSvgPath, svgContent);
        console.log(`SVG template created at: ${config.tempSvgPath}`);

        // Convert SVG to PNG using Sharp
        console.log('Converting SVG to PNG...');

        // Create a simple conversion script
        const conversionScript = `
    const fs = require('fs');
    const sharp = require('sharp');
    
    async function convert() {
      try {
        // Install sharp if not already installed
        try {
          require.resolve('sharp');
          console.log('Sharp is already installed.');
        } catch (e) {
          console.log('Installing sharp package...');
          require('child_process').execSync('npm install sharp --no-save', { stdio: 'inherit' });
        }
        
        const svgBuffer = fs.readFileSync('${config.tempSvgPath}');
        
        await sharp(svgBuffer)
          .resize(1200, 1200)
          .png()
          .toFile('${config.outputPath}');
          
        const stats = await sharp('${config.outputPath}').metadata();
        const fileSize = fs.statSync('${config.outputPath}').size;
        
        console.log('Successfully converted SVG to PNG!');
        console.log(\`PNG saved to: ${config.outputPath}\`);
        console.log('Image info:', stats);
        console.log(\`File size: \${(fileSize / 1024).toFixed(2)} KB\`);
        
        // Clean up temporary SVG file
        fs.unlinkSync('${config.tempSvgPath}');
        console.log('Temporary SVG file removed.');
      } catch (error) {
        console.error('Error converting SVG to PNG:', error);
      }
    }
    
    convert();
    `;

        // Write and execute the conversion script
        const tempScriptPath = path.join(__dirname, 'temp-convert.js');
        fs.writeFileSync(tempScriptPath, conversionScript);

        execSync(`node ${tempScriptPath}`, { stdio: 'inherit' });

        // Clean up temporary script
        fs.unlinkSync(tempScriptPath);
        console.log('Thumbnail generation completed successfully!');

    } catch (error) {
        console.error('Error generating thumbnail:', error);
    }
}

// Display help if requested
if (args.help || args.h) {
    console.log(`
Serverless MySQL Advanced Thumbnail Generator

Usage: node create-thumbnail-advanced.js [options]

Options:
  --version=X.X.X           Set the version number (default: 2.1.0)
  --features="F1,F2,F3,F4"  Set comma-separated features list
  --tagline="Text"          Set the tagline text
  --title="Text"            Set the title for the "What's New" section
  --announcement="Text"     Set the announcement banner text
  --primaryColor=#RRGGBB    Set the primary color (default: #3D7E9A)
  --secondaryColor=#RRGGBB  Set the secondary color (default: #F39C12)
  --backgroundColor1=#RRGGBB Set the first background color (default: #e6f7ff)
  --backgroundColor2=#RRGGBB Set the second background color (default: #ffffff)
  --textColor=#RRGGBB       Set the main text color (default: #000000)
  --taglineColor=#RRGGBB    Set the tagline text color (default: #555555)
  --featureColor=#RRGGBB    Set the feature text color (default: #333333)
  --backgroundStyle=TYPE    Set background style: gradient, solid, or pattern (default: gradient)
  --output=PATH             Set the output file path
  --help, -h                Display this help message
  `);
} else {
    // Run the generator
    generateThumbnail();
} 