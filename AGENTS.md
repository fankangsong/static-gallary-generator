# Repository Guidelines

This project is a static site generator that builds a personal photography gallery and blog site. It reads configuration and templates, processes images, and outputs static HTML/CSS/JS to the `web/` directory.

## Project Structure & Module Organization

| Path | Purpose |
|---|---|
| `core/main.js` | CLI entry point; dispatches `index:gallary`, `build:gallary`, `build:site`, `clear` commands |
| `core/gallery/` | Gallery generation: scans photos, generates thumbnails via Sharp, renders gallery index |
| `core/site/` | Site page generation: renders templates with EJS, processes blog posts via Marked |
| `core/common/` | Shared utilities, constants, and libraries |
| `templates/` | HTML templates (EJS) and shared assets (CSS, JS, fonts) |
| `config.json` | Site-wide configuration: titles, navigation, page definitions, image processing settings |
| `web/` | **Generated output** — static site files (git-ignored; do not edit directly) |
| `vite.config.js` | Vite dev server config; serves `web/` on port 3000 |

## Build, Test, and Development Commands

| Command | Description |
|---|---|
| `pnpm preview` | Start Vite dev server at `http://localhost:3000` to preview generated output |
| `pnpm build` | Full build pipeline: generate gallery index, build gallery pages, build site pages, then upload |
| `pnpm index:gallary` | Generate gallery index page only |
| `pnpm build:gallary` | Process photos and generate gallery HTML pages |
| `pnpm build:site` | Render site pages (home, blog, travel, 404) from EJS templates |
| `pnpm clear` | Remove generated `web/` and `core/.temp/` directories |

Run `pnpm build` for a complete rebuild. Use `pnpm preview` to inspect output locally after building.

## Coding Style & Naming Conventions

- **Indentation**: 2 spaces (JavaScript and HTML)
- **Language**: Node.js (CommonJS `require`), EJS templates, vanilla HTML/CSS/JS
- **File naming**: `snake_case` or `kebab-case` for template files; `camelCase` for JavaScript modules
- **Entry modules**: Each subdirectory under `core/` has a `main.js` as its entry point
- **Configuration**: All site settings live in [`config.json`](config.json); avoid hardcoding values in templates or scripts
- No linter or formatter is configured; match existing style when editing

## Testing Guidelines

Tests are standalone Node.js scripts in the repository root:

- [`test-template-renderer.js`](test-template-renderer.js) — tests the EJS template rendering pipeline
- [`test-comprehensive.js`](test-comprehensive.js) — broader integration tests for the build system

Run tests directly:

```bash
node test-template-renderer.js
node test-comprehensive.js
```

Add new tests as sibling scripts when modifying template rendering or core build logic.

## Commit & Pull Request Guidelines

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with scoped types:

```
feat(blog): 为博客文章页面添加代码高亮功能
refactor(site): 重构页面生成机制并统一导航配置
fix: resolve thumbnail generation for WebP images
chore: 为构建脚本添加上传步骤
```

Supported types: `feat`, `fix`, `refactor`, `chore`, `perf`, `style`, `docs`. Include a scope in parentheses when changes target a specific subsystem (`blog`, `site`, `gallery`, `template`, `font`).

### Pull Requests

- Describe the change and its impact on the build output
- Include screenshots for visible changes to gallery or site pages
- Link any related issues
- Run the full build (`pnpm build`) and verify `web/` output before merging
