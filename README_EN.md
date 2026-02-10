# 📸 Static Gallery Generator

[中文](./README.md)

Generate static gallery pages based on file system directories.

## 🌏 Live Preview

[https://imcolin.fan/photography/](https://imcolin.fan/photography/)

## 🖼️ Screenshots

- 🖥️ [Desktop Screenshot](./screenshot/screenshot.png)
- 📱 [Mobile Screenshot](./screenshot/screenshot_mobile.png)

## 🚀 Installation and Usage

- 📦 `npm install`
- 📂 Place folders and images into the `generator/photos/` directory.
- ⚙️ Run `npm run build init`. This will generate corresponding `meta.json` and `content.md` files in the `generator/photos/` directory.
- 📝 Modify `meta.json` and `content.md` as needed, or leave them as is.
- 🏗️ Run `npm run build`. This will generate the static page files in the `web/` directory.
- 🌐 Run `npm run dev` to preview the result at `http://localhost:5173`.

## 🔧 Configuration Options

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
