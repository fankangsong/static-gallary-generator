# 📸 Static Gallery Generator

[English](./README_EN.md)

基于文件系统目录生成静态相册页面。

## 🌏 Live Preview

[https://imcolin.fan/photography/](https://imcolin.fan/photography/)

## 🖼️ 截图

- 🖥️ [Desktop Screenshot](./screenshot/screenshot.png)
- 📱 [Mobile Screenshot](./screenshot/screenshot_mobile.png)

## 🚀 如何安装与使用

- 📦 `npm install`
- 📂 把文件夹和图片存放到 `generator/photos/` 目录下
- ⚙️ 执行 `npm run build init` 后，会在 `generator/photos/` 目录下生成对应的 `meta.json` 文件和 `content.md` 文件
- 📝 根据自定义需求，修改 `meta.json` 文件和 `content.md` 文件，也可不修改。
- 🏗️ 执行 `npm run build` 后，会在 `web/` 目录下生成对应的静态页面文件。
- 🌐 执行 `npm run dev` 后，会在 `http://localhost:5173` 预览效果。
