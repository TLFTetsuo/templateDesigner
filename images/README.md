# Images Folder

This folder is used to store image assets for ESL (Electronic Shelf Label) templates.

## Purpose

Store image files that will be referenced in your ESL templates:
- Logos
- Product images
- Icons
- Brand graphics

## Supported Formats

- **BMP** (recommended for ESL displays) - `.bmp`
- **PNG** - `.png`
- **JPG/JPEG** - `.jpg`, `.jpeg`

## Usage

1. Place your image files in this folder
2. When adding an image element to your template, reference the filename
3. For ESL displays, ensure images are in the correct format and color depth (typically BMP with limited colors)

## Naming Convention

- Use descriptive filenames (e.g., `company-logo-bwry.bmp`)
- Include color mode in filename when relevant (e.g., `_bw` for black/white, `_bwry` for black/white/red/yellow)
- Avoid spaces in filenames (use hyphens or underscores instead)

## Example

```yaml
- type: image
  filename: company-logo-bwry.bmp
  size_x: 60
  size_y: 30
  x_pos: 190
  y_pos: 90
```
