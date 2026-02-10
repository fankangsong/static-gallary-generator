# 📸 Static Gallery Generator

[中文](./README.md)

Generate static gallery pages based on file system directories.

## 🌏 Live Preview

[https://imcolin.fan/photography/](https://imcolin.fan/photography/)

## 🖼️ Screenshots

- 🖥️ [Desktop Screenshot](./screenshot/screenshot.png)
- 📱 [Mobile Screenshot](./screenshot/screenshot_mobile.png)

## 🚀 Installation and Usage

Install dependencies: `npm install`

### Project Configuration

Modify `generator/config.json` file to configure the image source directory.

### Initialization

- `npm run index`: Initialize the project, generating `generator/.temp/data.json`.
- `npm run build`: Generate the `web/` directory containing static page files.
- `npm run dev`: Preview at `http://localhost:3000`.

## Configuration Options

| Option                 | Description                               | Default Value                        |
| ---------------------- | ----------------------------------------- | ------------------------------------ |
| `quality`              | Image compression quality, range 0-100    | `60`                                 |
| `fit`                  | Image scaling mode, `inside` or `outside` | `inside`                             |
| `supportedExtensions`  | Supported image file extensions           | `[".jpg", ".jpeg", ".png", ".webp"]` |
| `defaultAuthor`        | Default author                            | `Fan Kangsong(Colin)`                |
| `template`             | Template name, `default` or `magazine`    | `default`                            |
| `website.url`          | Website URL                               | `imcolin.fan`                        |
| `website.navBrand`     | Navigation brand                          | `COLIN PHOTO`                        |
| `website.logo.enabled` | Whether to enable logo                    | `true`                               |
| `website.logo.src`     | Logo path                                 | `assets/logo.svg`                    |
| `website.logo.width`   | Logo width                                | `180px`                              |
