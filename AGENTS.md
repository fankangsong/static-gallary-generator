# 仓库指南

本项目是一个静态站点生成器，用于构建个人摄影相册与博客站点。它读取配置和模板，处理图片，并将静态 HTML/CSS/JS 输出到 `web/` 目录。

## 项目结构与模块组织

| 路径 | 用途 |
|---|---|
| `core/main.js` | CLI 入口；分发 `index:gallary`、`build:gallary`、`build:site`（别名 `build:blog`）、`clear` 命令 |
| `core/gallery/` | 相册生成：扫描照片、通过 Sharp 生成缩略图、渲染相册索引页 |
| `core/site/` | 站点页面生成：以 EJS 渲染模板，通过 Marked 处理博客文章 |
| `core/common/` | 共享工具函数、常量与类库 |
| `templates/` | HTML 模板（EJS）及共享资源（CSS、JS、字体） |
| `config.json` | 站点全局配置：标题、导航、页面定义、图片处理参数 |
| `docs/` | 项目文档（`design-guide.md`） |
| `data-source/` | 预留的源数据目录（当前为空） |
| `web/` | **生成产物** — 静态站点文件（已被 git 忽略；请勿直接编辑） |
| `vite.config.js` | Vite 开发服务器配置；在 3000 端口服务 `web/` 目录 |

## 构建、测试与开发命令

| 命令 | 说明 |
|---|---|
| `pnpm preview` | 启动 Vite 开发服务器于 `http://localhost:3000`，预览生成结果 |
| `pnpm build` | 完整构建流水线：生成相册索引 → 构建相册页面 → 构建站点页面。**注意：** 末尾的 `upload` 步骤执行 `upload.sh`，该脚本不在仓库中 — 流水线当前会在该步骤失败 |
| `pnpm build:blog` | `build:site` 的 CLI 别名（通过 `node core/main.js build:blog` 调用；未定义 npm script） |
| `pnpm index:gallary` | 仅生成相册索引页 |
| `pnpm build:gallary` | 处理照片并生成相册 HTML 页面 |
| `pnpm build:site` | 从 EJS 模板渲染站点页面（首页、博客、旅行、404） |
| `pnpm clear` | 移除生成的 `web/` 和 `core/.temp/` 目录 |

完整重建请运行 `pnpm build`。构建后使用 `pnpm preview` 在本地检查输出结果。

## 代码风格与命名规范

- **缩进**：2 空格（JavaScript 与 HTML）
- **语言**：Node.js（CommonJS `require`）、EJS 模板、原生 HTML/CSS/JS
- **文件命名**：模板文件使用 `snake_case` 或 `kebab-case`；JavaScript 模块使用 `camelCase`
- **入口模块**：`core/gallery/` 与 `core/site/` 各自有 `main.js` 入口；`core/common/` 是共享工具库，无入口文件
- **包管理器**：仅使用 pnpm；`pnpm-lock.yaml` 是唯一权威锁文件 — 请勿使用 npm/yarn
- **运行时**：Node.js 22，通过 `package.json` 中的 `volta` 锁定
- **配置**：所有站点设置统一放在 [`config.json`](config.json)；避免在模板或脚本中硬编码
- 未配置 linter 或格式化工具；编辑时请与现有风格保持一致

## 测试指南

测试是仓库根目录下的独立 Node.js 脚本：

- [`test-template-renderer.js`](test-template-renderer.js) — 测试 EJS 模板渲染流水线
- [`test-comprehensive.js`](test-comprehensive.js) — 构建系统的综合性集成测试

直接运行：

```bash
node test-template-renderer.js
node test-comprehensive.js
```

修改模板渲染或核心构建逻辑时，请以同级脚本的形式新增测试。

## 提交与 Pull Request 规范

### 提交信息

使用 [Conventional Commits](https://www.conventionalcommits.org/) 带作用域的类型：

```
feat(blog): 为博客文章页面添加代码高亮功能
refactor(site): 重构页面生成机制并统一导航配置
fix: resolve thumbnail generation for WebP images
chore: 为构建脚本添加上传步骤
```

支持的类型：`feat`、`fix`、`refactor`、`chore`、`perf`、`style`、`docs`。当变更针对特定子系统（`blog`、`site`、`gallery`、`template`、`font`）时，请在括号中注明作用域。

历史提交早于本规范，不完全合规；所有新提交必须遵循上述规范。

### Pull Request

- 描述变更内容及其对构建产物的影响
- 涉及相册或站点页面的可见变更时，请附上截图
- 关联相关 issue
- 合并前运行完整构建（`pnpm build`）并检查 `web/` 输出
