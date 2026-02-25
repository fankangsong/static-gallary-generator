# 📸 Static Gallery Generator

[中文](./README.md)

Generate static gallery and blog pages based on file system directories.

## 🌏 Live Preview

[https://imcolin.fan/photography/](https://imcolin.fan/photography/)

## 🖼️ Screenshots

- 🖥️ [Desktop Screenshot](./screenshot/screenshot.png)
- 📱 [Mobile Screenshot](./screenshot/screenshot_mobile.png)

## 🚀 Installation and Usage

### 1. Install Dependencies

```bash
npm install
```

### 2. Configuration

Modify `config.json` to customize the site settings.

### 3. Build & Run

- **Initialize & Index Photos**:

  ```bash
  npm run index:gallary
  ```

  Scans the photo directory defined in `config.json` and generates metadata.

- **Build Gallery Pages**:

  ```bash
  npm run build:gallary
  ```

  Generates static HTML pages for the gallery section.

- **Build Site Pages**:

  ```bash
  npm run build:site
  ```

  Generates other static pages (Index, Blog, Travel, etc.).

- **Build All**:

  ```bash
  npm run build
  ```

  Executes both gallery and site build processes.

- **Preview**:
  ```bash
  npm run preview
  ```
  Starts a local server (Vite) to preview the generated site.

## ⚙️ Configuration Options (`config.json`)

The configuration is structured into three main sections: `common`, `gallery`, and `site`.

### Common Settings (`common`)

General settings applied across the website.

| Option             | Description               | Example                                       |
| :----------------- | :------------------------ | :-------------------------------------------- |
| `site.title`       | Website title             | `"imcolin.fan"`                               |
| `site.description` | Website meta description  | `""`                                          |
| `site.url`         | Website domain URL        | `"imcolin.fan"`                               |
| `site.font`        | Custom font configuration | `{"name": "KingHwaOldSong", "source": "..."}` |
| `defaultAuthor`    | Default author name       | `"Fan Kangsong"`                              |

### Gallery Settings (`gallery`)

Configuration specific to the photography gallery.

| Option                | Description                                       | Example                                                         |
| :-------------------- | :------------------------------------------------ | :-------------------------------------------------------------- |
| `navBrand`            | Text displayed in the navigation bar              | `"COLIN PHOTO"`                                                 |
| `brandDescription`    | Description text for the brand                    | `"摄影于我的意义是回忆和美。"`                                  |
| `logo`                | Logo configuration object                         | `{"enabled": true, "src": "...", "width": "180px"}`             |
| `photosDir`           | Relative path to the photo source directory       | `"../photography"`                                              |
| `template`            | Gallery layout template (`default` or `magazine`) | `"magazine"`                                                    |
| `supportedExtensions` | List of supported image file extensions           | `[".jpg", ".jpeg", ".png", ".webp"]`                            |
| `thumbnail`           | Thumbnail generation settings                     | `{"width": 800, "height": 800, "quality": 80, "fit": "inside"}` |
| `large`               | Large image generation settings                   | `{"maxSize": 3000, "quality": 60, "fit": "inside"}`             |

### Site Settings (`site`)

Configuration for other sections of the site.

| Option         | Description                                 | Example                                                 |
| :------------- | :------------------------------------------ | :------------------------------------------------------ |
| `index.links`  | Navigation links array                      | `[{"text": "首页", "url": "/"}, ...]`                   |
| `index.quotes` | Array of quotes displayed on the index page | `["Quote 1", "Quote 2"]`                                |
| `blog`         | Blog section configuration                  | `{"dir": "../blog-post", "template": "blog_post", ...}` |
| `travel`       | Travel section configuration                | `{"title": "旅行", "description": "Travel Map"}`        |
