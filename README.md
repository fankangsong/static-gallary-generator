# 📸 Static Gallery Generator

[English](./README_EN.md)

基于文件系统目录生成静态相册和博客页面。

## 🌏 在线预览

[https://imcolin.fan/photography/](https://imcolin.fan/photography/)

## 🖼️ 截图

- 🖥️ [桌面端截图](./screenshot/screenshot.png)
- 📱 [移动端截图](./screenshot/screenshot_mobile.png)

## 🚀 安装与使用

### 1. 安装依赖

```bash
npm install
```

### 2. 配置

修改 `config.json` 文件以自定义站点设置。

### 3. 构建与运行

- **初始化与索引照片**:

  ```bash
  npm run index:gallary
  ```

  扫描 `config.json` 中定义的照片目录并生成元数据。

- **构建相册页面**:

  ```bash
  npm run build:gallary
  ```

  生成相册部分的静态 HTML 页面。

- **构建站点页面**:

  ```bash
  npm run build:site
  ```

  生成其他静态页面（首页、博客、旅行等）。

- **构建所有**:

  ```bash
  npm run build
  ```

  执行相册和站点的构建流程。

- **预览**:
  ```bash
  npm run preview
  ```
  启动本地服务器 (Vite) 预览生成的站点。

## ⚙️ 配置选项 (`config.json`)

配置分为三个主要部分：`common`（通用）、`gallery`（相册）和 `site`（站点）。

### 通用设置 (`common`)

应用于整个网站的通用设置。

| 选项               | 描述           | 示例                                          |
| :----------------- | :------------- | :-------------------------------------------- |
| `site.title`       | 网站标题       | `"imcolin.fan"`                               |
| `site.description` | 网站元描述     | `""`                                          |
| `site.url`         | 网站域名 URL   | `"imcolin.fan"`                               |
| `site.font`        | 自定义字体配置 | `{"name": "KingHwaOldSong", "source": "..."}` |
| `defaultAuthor`    | 默认作者姓名   | `"Fan Kangsong"`                              |

### 相册设置 (`gallery`)

摄影相册的特定配置。

| 选项                  | 描述                                    | 示例                                                            |
| :-------------------- | :-------------------------------------- | :-------------------------------------------------------------- |
| `navBrand`            | 导航栏显示的文本                        | `"COLIN PHOTO"`                                                 |
| `brandDescription`    | 品牌描述文本                            | `"摄影于我的意义是回忆和美。"`                                  |
| `logo`                | Logo 配置对象                           | `{"enabled": true, "src": "...", "width": "180px"}`             |
| `photosDir`           | 照片源目录的相对路径                    | `"../photography"`                                              |
| `template`            | 相册布局模板（`default` 或 `magazine`） | `"magazine"`                                                    |
| `supportedExtensions` | 支持的图片文件扩展名列表                | `[".jpg", ".jpeg", ".png", ".webp"]`                            |
| `thumbnail`           | 缩略图生成设置                          | `{"width": 800, "height": 800, "quality": 80, "fit": "inside"}` |
| `large`               | 大图生成设置                            | `{"maxSize": 3000, "quality": 60, "fit": "inside"}`             |

### 站点设置 (`site`)

站点其他部分的配置。

| 选项           | 描述                 | 示例                                                    |
| :------------- | :------------------- | :------------------------------------------------------ |
| `index.links`  | 导航链接数组         | `[{"text": "首页", "url": "/"}, ...]`                   |
| `index.quotes` | 首页显示的引用语数组 | `["Quote 1", "Quote 2"]`                                |
| `blog`         | 博客部分配置         | `{"dir": "../blog-post", "template": "blog_post", ...}` |
| `travel`       | 旅行部分配置         | `{"title": "旅行", "description": "Travel Map"}`        |
