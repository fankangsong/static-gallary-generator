# 📸 Static Gallery Generator

[中文](./README.md)

Generate static gallery and blog pages based on file system directories.

## 🌏 Live Preview

[https://imcolin.fan/photography/](https://imcolin.fan/photography/)

## 🖼️ Screenshots

- 🖥️ [Desktop Screenshot](./screenshot/screenshot.png)
- 📱 [Mobile Screenshot](./screenshot/screenshot_mobile.png)

## 📁 Project Structure

```
|- web/          # Generated static pages (output)
|- generator/    # Static site generator (Node.js)
|- photos/       # Source photo directory
|- docs/         # Documentation
```

## 🚀 Installation and Usage

### 1. Install Dependencies

```bash
npm install
```

Modify `generator/config.json` to configure the photo source directory.

### Two-Phase Generation

This project uses a two-phase generation architecture:

**Phase 1 - Init (`npm run index`)**

- Scan photo directory, extract EXIF metadata
- Generate `generator/.temp/data.json` as data source

**Phase 2 - Build (`npm run build`)**

- Load data.json
- Process images: generate thumbnails and large images
- Render EJS templates to static HTML

### Commands

```bash
npm run index    # Initialize: scan photos, extract EXIF, generate data.json
npm run build    # Build: process images, generate static HTML pages
npm run preview  # Preview: start dev server at http://localhost:3000
npm run clear    # Clear: delete web/ output directory
```

## 📂 Photo Directory Structure

```
photos/
├── album-name/
│   ├── content.md          # Album description (Markdown)
│   ├── image1.jpg
│   ├── image2.jpg
│   └── subgroup/           # Subdirectory grouping
│       └── image3.jpg
```

Album IDs are auto-generated from directory names (Chinese names are converted to pinyin).

## ⚙️ Configuration Options

| Option                 | Description                     | Default Value                        |
| ---------------------- | ------------------------------- | ------------------------------------ |
| `thumbnail.width`      | Thumbnail width                 | `800`                                |
| `thumbnail.height`     | Thumbnail height                | `800`                                |
| `thumbnail.quality`    | Thumbnail compression quality   | `80`                                 |
| `large.maxSize`        | Large image max size            | `3000`                               |
| `large.quality`        | Large image compression quality | `60`                                 |
| `supportedExtensions`  | Supported image extensions      | `[".jpg", ".jpeg", ".png", ".webp"]` |
| `defaultAuthor`        | Default author                  | `Fan Kangsong(Colin)`                |
| `photosDir`            | Photo source directory          | `./photos`                           |
| `template`             | Template name                   | `default` or `magazine`              |
| `website.url`          | Website URL                     | `imcolin.fan`                        |
| `website.navBrand`     | Navigation brand                | `COLIN PHOTO`                        |
| `website.logo.enabled` | Enable logo                     | `true`                               |
| `website.logo.src`     | Logo path                       | `assets/logo.svg`                    |
| `website.logo.width`   | Logo width                      | `180px`                              |
| `website.font`         | Custom font configuration       | See config.json                      |

## 🎨 Templates

Two template styles available:

| Template   | Features                                                                     |
| ---------- | ---------------------------------------------------------------------------- |
| `default`  | Full-screen hero background, dark navbar, image hover effects                |
| `magazine` | Warm paper-like background, centered text, magazine layout, visible captions |

## 📖 Documentation

- [CLAUDE.md](./CLAUDE.md) - Project architecture and development guide
- [docs/design-guide.md](./docs/design-guide.md) - Visual and style design specifications

## 📦 Output

Generated to `web/` directory:

- `index.html` - Album listing page
- `{album-id}.html` - Album detail pages
- `images/` - Processed images (thumbnails `thumb_*`, large `large_*`)
- `fonts/` - Subsetted font files
- `assets/` - Static assets (logo, favicon)
- `config/` - Navigation configuration

## 🛠️ Tech Stack

**Generator (Node.js):**

- Sharp - Image processing
- ExifReader - EXIF metadata extraction
- EJS - Template rendering
- Fontmin - Font subsetting

**Frontend (Static HTML):**

- TailwindCSS (CDN)
- PhotoSwipe - Image viewer
- No build step, deploy directly
