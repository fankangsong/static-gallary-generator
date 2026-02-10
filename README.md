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

## 配置项目

| 项目                   | 描述                                | 默认值                               |
| ---------------------- | ----------------------------------- | ------------------------------------ |
| `quality`              | 图片压缩质量，范围 0-100            | `60`                                 |
| `fit`                  | 图片缩放模式，`inside` 或 `outside` | `inside`                             |
| `supportedExtensions`  | 支持的图片文件扩展名                | `[".jpg", ".jpeg", ".png", ".webp"]` |
| `defaultAuthor`        | 默认作者                            | `Fan Kangsong(Colin)`                |
| `template`             | 模板名称，`default` 或 `magazine`   | `default`                            |
| `website.url`          | 网站 URL                            | `imcolin.fan`                        |
| `website.navBrand`     | 导航品牌                            | `COLIN PHOTO`                        |
| `website.logo.enabled` | 是否启用 logo                       | `true`                               |
| `website.logo.src`     | logo 路径                           | `assets/logo.svg`                    |
| `website.logo.width`   | logo 宽度                           | `180px`                              |
