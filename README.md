# 📸 静态相册生成器

[English](./README_EN.md)

基于文件系统目录生成静态相册和博客页面。

## 🌏 在线预览

[https://imcolin.fan/photography/](https://imcolin.fan/photography/)

## 🖼️ 截图

- 🖥️ [桌面端截图](./screenshot/screenshot.png)
- 📱 [移动端截图](./screenshot/screenshot_mobile.png)

## 📁 项目结构

```
|- web/          # 生成的静态页面（输出）
|- generator/    # 静态站点生成器（Node.js）
|- photos/       # 源图片目录
|- docs/         # 文档
```

## 🚀 安装与使用

### 1. 安装依赖

```bash
npm install
```

### 2. 配置

### 两阶段生成

本项目采用两阶段生成架构：

**阶段 1 - 初始化 (`npm run index`)**

- 扫描图片目录，提取 EXIF 元数据
- 生成 `generator/.temp/data.json` 作为数据源

**阶段 2 - 构建 (`npm run build`)**

- 加载 data.json
- 处理图片：生成缩略图和大图
- 渲染 EJS 模板生成静态 HTML

### 命令

```bash
npm run index    # 初始化：扫描图片，提取 EXIF，生成 data.json
npm run build    # 构建：处理图片，生成静态 HTML 页面
npm run preview  # 预览：在 http://localhost:3000 启动开发服务器
npm run clear    # 清理：删除 web/ 输出目录
```

## 📂 图片目录结构

```
photos/
├── album-name/
│   ├── content.md          # 相册描述（Markdown）
│   ├── image1.jpg
│   ├── image2.jpg
│   └── subgroup/           # 子目录分组
│       └── image3.jpg
```

相册 ID 自动从目录名生成（中文目录名会转换为拼音）。

## ⚙️ 配置选项

| 选项                   | 描述             | 默认值                               |
| ---------------------- | ---------------- | ------------------------------------ |
| `thumbnail.width`      | 缩略图宽度       | `800`                                |
| `thumbnail.height`     | 缩略图高度       | `800`                                |
| `thumbnail.quality`    | 缩略图压缩质量   | `80`                                 |
| `large.maxSize`        | 大图最大尺寸     | `3000`                               |
| `large.quality`        | 大图压缩质量     | `60`                                 |
| `supportedExtensions`  | 支持的图片扩展名 | `[".jpg", ".jpeg", ".png", ".webp"]` |
| `defaultAuthor`        | 默认作者         | `Fan Kangsong(Colin)`                |
| `photosDir`            | 图片源目录       | `./photos`                           |
| `template`             | 模板名称         | `default` 或 `magazine`              |
| `website.url`          | 网站 URL         | `imcolin.fan`                        |
| `website.navBrand`     | 导航品牌         | `COLIN PHOTO`                        |
| `website.logo.enabled` | 是否启用 logo    | `true`                               |
| `website.logo.src`     | logo 路径        | `assets/logo.svg`                    |
| `website.logo.width`   | logo 宽度        | `180px`                              |
| `website.font`         | 自定义字体配置   | 见 config.json                       |

## 🎨 模板

提供两种模板风格：

| 模板       | 特点                                               |
| ---------- | -------------------------------------------------- |
| `default`  | 全屏 Hero 背景、深色导航栏、图片 hover 效果        |
| `magazine` | 暖色纸张背景、文字居中、杂志排版风格、常驻 Caption |

## 📖 文档

- [CLAUDE.md](./CLAUDE.md) - 项目架构与开发指南
- [docs/design-guide.md](./docs/design-guide.md) - 视觉与样式设计规范

## 📦 输出

生成到 `web/` 目录：

- `index.html` - 相册列表页
- `{album-id}.html` - 相册详情页
- `images/` - 处理后的图片（缩略图 thumb*\*、大图 large*\*）
- `fonts/` - 字体子集化文件
- `assets/` - 静态资源（logo、favicon）
- `config/` - 导航配置

## 🛠️ 技术栈

**生成器（Node.js）：**

- Sharp - 图片处理
- ExifReader - EXIF 元数据提取
- EJS - 模板渲染
- Fontmin - 字体子集化

**前端（静态 HTML）：**

- TailwindCSS (CDN)
- PhotoSwipe - 图片浏览
- 无构建步骤，直接部署
