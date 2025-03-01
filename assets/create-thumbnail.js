#!/usr/bin/env node

/**
 * Serverless MySQL Thumbnail Generator
 * 
 * This script generates a customized thumbnail for releases based on a template SVG.
 * It allows customization of version number, features list, and other elements.
 * 
 * Usage: node create-thumbnail.js --version=2.1.0 --features="Feature 1,Feature 2,Feature 3,Feature 4"
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
    version: args.version || '2.1.0',
    features: args.features ? args.features.split(',') : [
        'Query Retries with Backoff Strategies',
        'SQL Logging with Parameter Substitution',
        'User Switching for Different Permissions',
        'Comprehensive Integration Tests'
    ],
    outputPath: args.output || path.join(__dirname, 'thumbnail.png'),
    tempSvgPath: path.join(__dirname, 'temp-thumbnail.svg'),
    announcement: args.announcement || 'NOW AVAILABLE!'
};

// Create SVG template
function generateSvgTemplate() {
    // Generate feature bullet points
    const featureElements = config.features.map((feature, index) => {
        return `        <tspan x="0" y="${index * 60}">• ${feature}</tspan>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="1200" height="1200" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
  <!-- Background with gradient -->
  <defs>
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e6f7ff" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
  </defs>
  
  <!-- Main background -->
  <rect width="1200" height="1200" fill="url(#bg-gradient)" rx="12" ry="12" />
  
  <!-- Version badge -->
  <g transform="translate(1020, 80)">
    <rect x="-80" y="-30" width="160" height="60" rx="30" ry="30" fill="#3D7E9A" />
    <text x="0" y="10" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">v${config.version}</text>
  </g>
  
  <!-- Logo -->
  <g transform="translate(600, 400)">
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="120" font-weight="bold" text-anchor="middle">
      <tspan x="0" y="0" fill="#000000">Serverless</tspan>
      <tspan x="-120" y="120" fill="#3D7E9A">My</tspan><tspan dx="25" x="60" y="120" fill="#F39C12">SQL</tspan>
    </text>
  </g>
  
  <!-- Tagline -->
  <text x="600" y="580" font-family="Arial, sans-serif" font-size="36" fill="#555555" text-anchor="middle">
    Connection Management at Serverless Scale
  </text>
  
  <!-- What's New Title -->
  <g transform="translate(600, 680)">
    <rect x="-320" y="-50" width="640" height="70" rx="10" ry="10" fill="rgba(61, 126, 154, 0.1)" />
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="#3D7E9A" text-anchor="middle">
      ✨ What's New
    </text>
  </g>
  
  <!-- Features as bullet points -->
  <g transform="translate(300, 750)">
    <g>
      <text x="0" y="0" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#333333">
${featureElements}
      </text>
    </g>
  </g>
  
  <!-- Announcement banner -->
  <g transform="translate(600, 1100)">
    <rect x="-180" y="-40" width="360" height="80" rx="40" ry="40" fill="rgba(243, 156, 18, 0.9)" />
    <text x="0" y="12" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${config.announcement}</text>
  </g>
</svg>`;
}

// Main function to generate thumbnail
async function generateThumbnail() {
    try {
        console.log('Generating thumbnail with the following configuration:');
        console.log(`- Version: ${config.version}`);
        console.log(`- Features: ${config.features.join(', ')}`);
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
        
        console.log('Successfully converted SVG to PNG!');
        console.log(\`PNG saved to: ${config.outputPath}\`);
        console.log('Image info:', stats);
        
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

// Run the generator
generateThumbnail(); 