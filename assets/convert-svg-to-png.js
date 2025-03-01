const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to the SVG file
const svgPath = path.join(__dirname, 'thumbnail.svg');
const pngPath = path.join(__dirname, 'thumbnail.png');

console.log('Installing sharp package...');
try {
    execSync('npm install sharp --no-save', { stdio: 'inherit' });

    console.log('Converting SVG to PNG...');
    const sharp = require('sharp');

    // Read the SVG file
    const svgBuffer = fs.readFileSync(svgPath);

    // Convert to PNG using promises
    sharp(svgBuffer)
        .resize(1200, 1200)
        .png()
        .toFile(pngPath)
        .then(info => {
            console.log('Successfully converted SVG to PNG!');
            console.log(`PNG saved to: ${pngPath}`);
            console.log('Image info:', info);
        })
        .catch(err => {
            console.error('Error converting SVG to PNG:', err);
        });
} catch (error) {
    console.error('Error:', error.message);
} 