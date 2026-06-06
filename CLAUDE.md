# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run index    # Initialize: scan photos, extract EXIF, generate data.json
npm run build    # Build: process images, generate static HTML pages
npm run preview  # Preview site at http://localhost:3000 (serves web/ directory)
npm run clear    # Delete web/ output directory
```

## Architecture

Two-phase static site generation:

**Phase 1 - Init (`npm run index`)**
- Scans photos directory (configured in `generator/config.json` → `photosDir`)
- Extracts EXIF metadata from images
- Generates `generator/.temp/data.json` as the single source of truth for album data

**Phase 2 - Build (`npm run build`)**
- Loads data.json
- Processes images: generates thumbnails (800px) and large images (max 3000px) using Sharp
- Renders EJS templates to static HTML

**Core Modules (`generator/lib/`):**
- `data-manager.js` - Album scanning, EXIF extraction, content.md handling
- `image-processor.js` - Image resizing, EXIF parsing with exifreader
- `html-generator.js` - EJS template rendering
- `font-manager.js` - Font subsetting for optimized Chinese typography
- `config.js` - Loads config.json, resolves paths

**Templates (`generator/templates/`):**
- `template.html` / `template_magazine.html` - Album page templates
- `index_template.html` - Homepage album listing
- `partials/` - Shared head, nav, footer components

## Configuration

Edit `generator/config.json`:
- `photosDir` - Source photo directory (relative to generator/)
- `template` - "default" or "magazine"
- `thumbnail` / `large` - Image processing settings
- `website` - Site metadata, logo, font configuration

## Photo Directory Structure

```
photos/
├── album-name/
│   ├── content.md          # Album description (markdown)
│   ├── image1.jpg
│   ├── image2.jpg
│   └── subgroup/           # Optional subdirectory for grouped images
│       └── image3.jpg
```

Album IDs are auto-generated from directory names (pinyin conversion for Chinese).

## Output

Generated to `web/`:
- `index.html` - Album listing
- `{album-id}.html` - Individual album pages
- `images/` - Processed images (thumb_*, large_*)
- `fonts/` - Subset fonts
- `assets/` - Static assets

## Project Structure

```
|- web/          # Generated static pages (output)
|- generator/    # Static site generator (Node.js)
|- photos/       # Source photo directory
```

## Coding Guidelines

From `.trae/rules/coding-guidelines.md`:

**Core Principles:**
- **No Build Step**: Frontend code is static HTML, no compilation or transpilation
- **CDN Dependencies**: Load libraries via `<script>` tags (e.g., TailwindCSS CDN)
- **Global Scope**: Use global variables from CDN libraries (e.g., `axios`, `_`, `Vue` mounted on `window`)
- **Native API**: Prefer browser-native ES6+ APIs, no module system

**Forbidden Patterns:**
```javascript
import axios from "axios";  // ❌ Error
const _ = require("lodash"); // ❌ Error
```

## UI/UX Guidelines

From `.trae/rules/ui-and-ux.md`:

**Tech Stack:**
- **TailwindCSS Only**: Must use TailwindCSS as the sole styling solution
- **Utility-First**: Use utility classes directly on HTML tags, avoid custom CSS files
- **Static HTML**: Build semantic, accessible HTML structure

**Design Style:**
- **Minimal Modern**: Clean visual style with ample whitespace
- **Responsive First**: Mobile-first design, use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`)
- **Smooth Interactions**: Use simple CSS transitions for hover/focus effects

**详细设计规范**: See [docs/design-guide.md](docs/design-guide.md) for color system, typography, layout, animations, and component styles.