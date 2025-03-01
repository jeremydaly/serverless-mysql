# Converting the SVG Thumbnail to PNG

To convert the SVG thumbnail to a PNG image for use with your LinkedIn post, you can use one of the following methods:

## Method 1: Using a Web Browser

1. Open the SVG file (`assets/thumbnail.svg`) in a web browser like Chrome or Firefox
2. Right-click on the image and select "Save Image As..."
3. Choose PNG as the file format and save it to your desired location

## Method 2: Using Command Line Tools

If you have Inkscape installed:

```bash
inkscape --export-filename=thumbnail.png --export-dpi=300 assets/thumbnail.svg
```

If you have ImageMagick installed:

```bash
convert -density 300 assets/thumbnail.svg thumbnail.png
```

## Method 3: Using Online Converters

You can use online SVG to PNG converters such as:
- [Convertio](https://convertio.co/svg-png/)
- [CloudConvert](https://cloudconvert.com/svg-to-png)
- [SVG2PNG](https://svgtopng.com/)

Simply upload the SVG file and download the converted PNG.

## Recommended Settings

- Resolution: 1200x1200 pixels
- DPI: 300 (for high quality)
- Format: PNG with transparency

The resulting PNG image will be ready to use as a thumbnail for your LinkedIn post about Serverless MySQL v2.1.0. 