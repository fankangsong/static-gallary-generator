# Gallery App

**100% vibe coding 产物**

这是一个基于静态文件生成的相册展示应用。项目分为两部分：静态网页展示端 (`web/`) 和 静态资源生成器 (`generator/`)。

## 核心原则

- **No Build Step**: Web 端代码不经过打包，直接部署。
- **Dependencies**: 通过 CDN 引入 TailwindCSS、PhotoSwipe 等库。
- **Native Support**: 使用原生 ES6+ JavaScript，不使用模块化导入语法。

## 目录结构

```
|- generator/          # 相册生成器
|  |- photos/          # 原始图片存放目录（按相册文件夹分类）
|  |- generate.js      # 生成脚本
|  |- template.html    # 页面生成的 EJS 模板
|- web/                # 静态网站根目录
|  |- data/            # 生成的相册数据 JSON
|  |- images/          # 生成的压缩图片（thumb/large）
|  |- js/              # 公共逻辑代码
|  |- *.html           # 生成的相册页面
```

## 快速开始

### 1. 安装依赖

主要用于 `generator` 目录下的图片处理和页面生成脚本。

```bash
npm install
```

### 2. 添加新相册

1. 在 `generator/photos/` 目录下创建一个新文件夹，例如 `my-trip`。
2. 将照片（`.jpg`, `.png` 等）放入该文件夹。
3. 在该文件夹中创建一个 `meta.json` 文件，配置相册元数据：

```json
{
  "id": "my-trip",
  "title": "My Trip",
  "author": "Your Name",
  "description": "这是相册的描述信息",
  "cover": "cover.jpg" // 可选，指定封面图文件名
}
```

### 3. 生成静态页面

运行生成脚本。脚本会递归扫描 `generator/photos` 目录，处理图片并生成对应的 HTML 和 JSON 文件。

```bash
node generator/generate.js
```

脚本执行的操作：

- 压缩图片：生成 300x300 的缩略图和最大边长 3000px 的大图。
- 生成数据：在 `web/data/` 下生成对应的 `json` 数据文件。
- 生成页面：基于 `generator/template.html` 在 `web/` 下生成对应的 `.html` 文件。

### 4. 本地预览

使用 Vite 启动本地开发服务器预览效果。

```bash
npm run dev
```

访问 `http://localhost:5173` 查看效果。

## 技术栈

- **生成器**: Node.js, Sharp (图片处理), EJS (模板渲染)
- **前端**: HTML5, TailwindCSS (样式), PhotoSwipe (图片查看器), Axios (数据请求)

## 常用命令

- `npm run dev`: 启动开发服务器
- `node generator/generate.js`: 执行相册生成任务
