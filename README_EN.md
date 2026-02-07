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
