# 项目优化分析报告

> 生成日期：2026-09-07
> 状态：待分期实施
> 说明：本文档为静态站点生成器的全面优化分析，按影响程度分级，文末附分期实施路线。所有问题均附文件路径与行号。

---

## 一、高影响问题（性能 / 数据丢失 / 构建可靠性）

### H1. 33MB 完整源字体被原样拷贝进 web/ 产物

- **位置**：`core/common/lib/resource-manager.js:35`（`resources = [{ src: ASSETS_DIR, dest: web/assets }]` 无任何排除规则，`copyRecursive` 递归拷贝全部）
- **现状**：`web/assets/fonts/京華老宋体v3.0.ttf` = 33,259,644 字节（33MB）被原样发布上线；`web/` 总体积 63MB 中该文件占一半
- **问题**：该源字体只是 fontmin 子集化的**输入**，不应出现在产物中
- **建议**：
  - 拷贝时排除 `fonts/京華老宋体*.ttf`
  - 顺带把子集输出转为 woff2（Fontmin 支持 ttf2woff2 插件），体积可再省约 50%

### H2. 生产页面使用 Tailwind Play CDN（运行时 JIT 编译）

- **位置**：
  - `templates/gallary/partials/head.ejs:9`
  - `templates/site/partials/head.ejs:9`
- **现状**：`templates/assets/js/vendor/tailwindcss.js` 实测 499KB，是 Tailwind 的浏览器内编译器。所有相册页、站点页都在加载它，运行时才生成样式
- **危害**：首屏 FOUC、500KB 无效 JS、无法被浏览器缓存优化，Tailwind 官方明确禁止生产环境使用 Play CDN
- **建议**：改用 Tailwind CLI / 构建期扫描模板生成静态 CSS（站点模板中已有大量 prose-\* 类，可配合 `@tailwindcss/typography`）

### H3. data.json 历史加载逻辑被注释 → 手工元数据丢失 + EXIF 重复全量扫描

- **位置**：`core/gallery/lib/data-manager.js:71-79`

```js
let existingData = [];
// Force refresh: Do not load existing data
// if (fs.existsSync(DATA_JSON_PATH)) { ... }
```

- **后果一（性能）**：`scanAlbums()`（第 84-268 行）对每个相册每个文件无条件重跑 `imageProcessor.getExif()`（第 139、161 行），图片越多 `index:gallary` 越慢，EXIF 结果完全没有按文件（mtime/哈希）缓存
- **后果二（数据丢失 bug）**：`existingData` 恒为 `[]`，第 89 行 `existingData.find(...)` 永远 miss，`albumEntry` 每次都被全新创建——用户在 `data.json` 里手工修改过的 `description`、`date`、`cover`、`author` 在下一次 `index:gallary` 时**全部被静默覆盖**（第 106-114、181-265 行重新推导）
- **建议**：恢复增量加载 + 按 `filename + mtime` 缓存 EXIF

### H4. Sharp 图片处理完全串行 + 冗余调用

- **位置**：
  - `core/gallery/lib/image-processor.js:141-152`（`for...of` + `await processFile`，逐张处理）
  - `core/gallery/main.js:57`（相册与相册之间也是串行）
  - `core/pictures/lib/image-processor.js:33-54`（绘本缩略图同样串行）
- **问题**：单张图片处理链冗余，`processFile` 内最多 4 次 Sharp 调用——thumbnail 一次（第 80-86 行）、large 的 `metadata()` 一次（第 94 行）、large 写出一次（第 100/109 行）、**再对输出文件重新 `sharp(largePath).metadata()` 读尺寸**（第 118 行）。最后一步完全可以用 resize 后的返回值/计算值代替
- **缓存现状**：缩略图/large 图有 `fs.existsSync` 增量跳过（第 79、92 行），这点是好的；但增量判断只看文件是否存在，源图更新后不会重新生成（脏缓存问题）
- **建议**：
  - 用 `p-limit`（并发 4-8，libvips 自身已多线程，文件级并发 4 足够）并行化
  - 合并 metadata 读取
  - 缓存 key 加入源图 mtime

### H5. 构建流水线末尾必然失败的 upload 步骤 + 失败时退出码为 0

- **位置**：
  - `package.json:13`：`"build": "... && pnpm update:travel && pnpm upload"`，而 `upload.sh` 不存在于仓库，且 `.gitignore` 里有 `*.sh` 规则（`upload.sh` 即使存在也无法提交）
  - `core/main.js:55`：`main().catch((err) => logger.error(err))` —— 捕获后**不设置 `process.exitCode`**，任何构建内部异常最终进程退出码都是 0，CI/脚本无法感知失败。对比 `core/travel/main.js:62` 是正确做法（`process.exitCode = 1`）
- **建议**：upload 改为可选独立脚本；`main().catch` 中设 `process.exitCode = 1`

### H6. 每篇博客文章各生成一份字体子集

- **位置**：`core/site/lib/blog-manager.js:93-109`（`processPost` 内对每篇文章调用 `fontManager.generateSubset`，输出到 `web/blog/<date>/fonts/`）
- **危害**：N 篇文章 = N 次 fontmin 全流程（fontmin 本身较慢）+ N 份高度重复的 ttf 文件；文章内容相近时子集重复度极高
- **建议**：全站合并为一份共享子集（博客索引页已经在做这件事，见 `core/site/lib/html-generator.js:104-115`），post 页复用即可；至少换成 woff2

### H7. 所有 preload 声明的类型与实际文件不符（preload 全部无效）

- **位置**（7 处，`type="font/woff2"` 但实际输出是 `.ttf`）：
  - `templates/gallary/template.html:6`
  - `templates/gallary/template_magazine.html:6`
  - `templates/gallary/index_template.html:6`
  - `templates/site/index.html:6`
  - `templates/site/404.html:6`
  - `templates/site/blog/post.html:10`
  - `templates/site/blog/index.html:6`
  - `templates/site/travel/index.html:6`
- **危害**：浏览器会因 MIME 不匹配拒绝使用 preload 资源并告警，`<link rel=preload>` 完全白做（还可能造成字体二次下载）
- **建议**：统一改为 `type="font/ttf"`，或直接输出 woff2

### H8. 前端大资源未优化

- **位置与问题**：
  - `templates/assets/js/travel/globe.gl.min.js` = 1.88MB，travel 页全量加载（`templates/site/travel/index.html:125`），无按需/无 code-split
  - `templates/assets/data/travel/countries.geojson` 440KB（web 侧实测）随首屏 fetch（`travel/index.html:170`）
  - `templates/assets/js/vendor/highlight.min.js` 121KB，每篇博文整包加载（`templates/site/blog/post.html:63`），未按注册语言裁剪
  - 相册封面直接用 large 原图（700KB+）：`core/gallery/lib/data-manager.js:264`（cover 指向 `large_*.jpg`），在 `templates/gallary/index_template.html:61` 的相册索引网格中渲染——首页一屏会拉多张 700KB 大图，且无 `loading="lazy"`、无 `srcset`
  - 博客索引封面无 lazy：`templates/site/blog/index.html:58`
  - 相册内页网格图有 `loading="lazy"`（`template.html:131`、`template_magazine.html:213`），这点是好的
- **建议**：cover 改用 `thumb_` 或新增中等尺寸档位；补 `loading="lazy"` + `width/height` 防 CLS

---

## 二、中影响问题（重复代码 / 一致性 / 架构）

### M1. 两套并存的 KML 解析与抓取实现（明显重复）

- `core/travel/lib/kml-parser.js`（`decodeEntities`/`extractTag`/`parseKml`/`extractNetworkLinkHref`）
- `core/site/lib/travel-data-builder.js:20-81`（`decodeXmlEntities`/`extractTag`/`parseKml` —— 又一份实现，行为还略有差异：一个用 `fromCharCode`+`&nbsp;`，一个用 `fromCodePoint`；正则也不一致）
- 抓取逻辑同样重复：`core/travel/main.js:12-42`（fetch + NetworkLink 跟进）与 `core/site/lib/travel-data-builder.js:86-189`（代理 CONNECT + 直连 fetch + 快照回退）
- 两个命令（`update:travel` 与 `build:site` 内嵌调用）输出同名 `assets/travel/markers.json`，但一个 pretty-print（`travel/main.js:57`）、一个 compact（`travel-data-builder.js:236`）
- **建议**：合并为 `core/travel` 单一实现，`build:site` 只复用其产物

### M2. 其他重复代码

- 拼音 slug 逻辑两份：`core/gallery/lib/data-manager.js:94-104` 与 `core/common/lib/utils.js:22-41`（`slugifyDirName`，pictures 已用后者，gallery 未复用）
- 两个 image-processor：`core/gallery/lib/image-processor.js` 与 `core/pictures/lib/image-processor.js`（缩略图逻辑几乎一致，配置项命名却不同：`config.gallery.thumbnail` vs `config.pictures.thumbnail`）
- 两个 head partial 近乎相同：`templates/gallary/partials/head.ejs` vs `templates/site/partials/head.ejs`
- `@font-face` + preload 片段在 8 个模板里内联重复（见 H7 列表），应抽成一个 partial

### M3. 博客正文未做 sanitize（与相册不一致）

- `core/site/lib/blog-manager.js:60`：`htmlContent = marked.parse(mdContent)` 直接输出；而相册的 `content.md` 走了 `sanitizeHtml`（`core/gallery/lib/data-manager.js:29-41`）。同一仓库两种安全策略，容易踩坑
- **建议**：统一走 sanitizeHtml

### M4. 构建器会修改源目录（副作用）

- `core/gallery/lib/data-manager.js:48`：相册缺 `content.md` 时直接在**用户的照片源目录**写文件。构建工具静默改源数据是坏味道
- **建议**：改为仅在生成目录写，或提示用户手动创建

### M5. web/config/data.json 公网暴露但运行时未使用

- `core/common/lib/resource-manager.js:44-53` 把 `.temp/data.json`（含全部图片清单、EXIF、作者信息）拷到 `web/config/data.json`（实测 12KB）。相册页全部是构建期渲染（EJS），前端只有 `gallery.js:44` fetch `nav.json` 被用到；data.json 属于多余的隐私面
- 另外 `core/site/lib/blog-builder.js:27-29` 的 nav.json 生成被注释，但第 21-25 行仍构建 `navItems` 后丢弃——死代码
- **建议**：停止拷贝 data.json 到产物；清理 blog-builder 死代码

### M6. 遗留死代码 / 硬编码

- `templates/assets/js/gallery.js:56,62-65`：硬编码 `"nature.html"`（本项目不存在该页面），active 态判断逻辑已失效
- `gallery.js:37`：fetch 失败时 `document.body.innerHTML = ...` 整页替换，过于粗暴
- `core/common/lib/constants.js:15`：`IMAGES_DIR` 注释自己说明已过时（"actual images go into album folders"），但 `core/gallery/main.js:23,36` 仍在 mkdir 它
- `core/site/main.js:31`：`const initialText = ""` 传入 `buildBlog`，返回的 `allText` 被解构丢弃（只取 `posts`）——`core/site/lib/blog-builder.js:16-17,31-33` 的 allText 拼接全是死代码
- `core/site/lib/page-generator.js:26-80`：`extractTextFromHtml` 内约 40 行自我讨论式注释（"Wait, ... The user said ..."），应清理

### M7. 模板细节问题

- `templates/site/404.html:19`：文案 bug「页面**不要再**或已移除」（应为「已删除或已移除」）
- `templates/common/partials/footer.ejs:5`：`<a>` 标签上非法的 `alt` 属性；且 `http://imcolin.fan` 硬编码（应为 `https://` + 读 config）
- `templates/site/index.html:10`：`font-family: 'KingHwaOldSong'` 硬编码，而第 11 行 src 用了 `<%= WEBSITE_FONT.name %>` —— 同一声明块内两种写法
- `templates/seed.html:10`：EJS 表达式引号损坏（`<%= "/assets/fonts/ + WEBSITE_FONT.name + ".ttf" %>`），一旦渲染必抛法错误；作为种子模板也从未被任何流水线引用
- `templates/gallary/template.html:5` / `template_magazine.html:5`：`include('/partials/head')` 使用绝对根路径，依赖 `root` 数组顺序（`html-generator.js:54` 只给了两个 root，`page-generator` 场景给的是另一组），模板可移植性弱

---

## 三、低影响问题（工程卫生）

### L1. 测试覆盖严重不足且有副作用

- `test-template-renderer.js`、`test-comprehensive.js`：仅覆盖 `templateRenderer`，全部用 `console.log` 判断、**无断言、失败不改变退出码**
- 直接往 `web/` 写产物——实测 `web/test-404.html`、`web/batch-test-2.html` 残留在生成目录中污染产物
- 核心模块（image-processor、data-manager、两个 kml-parser、sitemap、blog-manager）零测试。kml-parser 是纯函数，最适合先补单测
- **建议**：测试改造为带断言 + 隔离输出目录（写 `.temp` 而非 `web/`）

### L2. package.json 问题

- `name: "gallary-app"` 拼写错误（gallary ≠ gallery），且仓库内 `templates/gallary/` 与常量 `GALLERY_TEMPLATES_DIR`（`core/common/lib/constants.js:21`）混用两种拼写
- `"main": "index.js"` 指向不存在的文件
- `devDependencies.download`（第 20 行）全仓库无引用，可删除
- `vite ^4.5.14` 仅用作静态目录预览（`vite.config.js` 只配了 root/server），用 Vite 4 偏重，升级到 Vite 5/7 或换 `serve`/`http-server` 皆可
- volta 钉的 `22.22.0` 与 AGENTS.md 声明的 22.23.1 不一致
- `license: "ISC"` + 空 `author/description`

### L3. 全同步 IO

- 构建代码全部使用 `fs.readFileSync/readdirSync/copyFileSync/statSync`（如 `resource-manager.js:31` 逐文件同步拷贝整个 assets 目录、`data-manager.js`、`blog-manager.js` 等）。对个人站点规模可接受，但资源拷贝与目录扫描是大头，若图库增大建议 `fs.promises` + 并发拷贝

### L4. 配置层

- `core/common/lib/config.js:6-38`：无任何 schema 校验，`rawConfig.common.site` 缺键即 undefined 向下传播；`config.blog` 别名指向 `rawConfig.site.blog`（第 21 行）与 `config.site` 对象部分重叠，结构有歧义
- `config.json:61,68,78`：`site.pages` 每页独立 `fontOutput`（index/travel/error 各一份字体子集），三份子集高度重复，可合并共享
- `config.json:5`：`description: ""` 为空，`site/index.html` 的 meta description 也为空——SEO 基础项缺失

### L5. 其他小项

- `core/common/lib/utils.js:50`：只有日期没有设备时描述前缀仍是 `📷`（应为 `📆`），小 bug
- `core/gallery/lib/image-processor.js:108-113`：图片小于 `maxSize` 时仍强制重编码 JPEG q60（二次有损压缩），可直接拷贝原图；且 `toFormat("jpeg")` 未配 `flatten({background})`，带透明通道的 PNG 转 JPEG 可能出现黑底
- `.gitignore` 中 `*.sh` 会把 `build.sh` 一并忽略（本地存在、仓库无），与 `pnpm build` 引用 `upload.sh` 的问题互相纠缠
- `web/` 中残留测试产物（`test-404.html`、`batch-test-2.html`，见 L1），且 `clear` 命令才清理——测试应写 `.temp`

---

## 四、做得不错的点（可保持）

- 缩略图/large 图按文件存在性增量跳过（`gallery/lib/image-processor.js:79,92`、`pictures/lib/image-processor.js:39`），避免重复生成
- travel 数据有本地快照回退（`travel-data-builder.js:217-225`）、代理 CONNECT 零依赖实现
- 相册内片有 `loading="lazy"`（`template.html:131`、`template_magazine.html:213`）
- 零依赖的 KML 正则解析器（`core/travel/lib/kml-parser.js`）思路合理（虽然与另一份重复）
- 单测脚本、Conventional Commits、AGENTS.md 文档齐全

---

## 五、分期实施路线

### 第一期：立即可做、收益最大（产物瘦身 & 构建可靠性）

| 项  | 内容                                     | 涉及文件                                                          | 状态                    |
| --- | ---------------------------------------- | ----------------------------------------------------------------- | ----------------------- |
| H1  | 排除源字体拷贝                           | `core/common/lib/resource-manager.js`                             | ✅ 已完成（2026-09-07） |
| H7  | preload 类型修正（或配合 woff2）         | 8 个模板文件                                                      | ✅ 已完成（2026-09-07） |
| H5  | 删除 build 中的 upload 步骤 + 修复退出码 | `package.json`、`core/main.js`                                    |
| M7  | 404 文案 bug、footer 非法属性            | `templates/site/404.html`、`templates/common/partials/footer.ejs` |

**预期收益**：产物 -33MB，preload 生效，构建不再必然失败，CI 可感知错误

### 第二期：构建性能（并行化 & 缓存）

| 项  | 内容                                                     | 涉及文件                                 |
| --- | -------------------------------------------------------- | ---------------------------------------- |
| H4  | 图片并行化（p-limit）+ 合并 metadata 读取 + 缓存加 mtime | `core/gallery/lib/image-processor.js` 等 |
| H3  | data.json 增量恢复 + EXIF 按 mtime 缓存                  | `core/gallery/lib/data-manager.js`       |
| H6  | 博客字体子集合并为共享一份                               | `core/site/lib/blog-manager.js`          |

**预期收益**：构建速度大幅提升，手工元数据不再丢失

### 第三期：前端体验

| 项      | 内容                                                      | 涉及文件                          |
| ------- | --------------------------------------------------------- | --------------------------------- |
| H2      | 替换 Tailwind Play CDN 为构建期 CSS                       | 2 个 head.ejs + 新增构建步骤      |
| H8      | 封面改用缩略图 + lazy + CLS 防护；highlight.js 按语言裁剪 | `data-manager.js`、多个模板       |
| H1 补充 | 字体子集输出转 woff2                                      | `core/common/lib/font-manager.js` |

**预期收益**：首屏体验显著改善，FOUC 消除

### 第四期：工程健康（重构 & 安全 & 测试）

| 项  | 内容                                              | 涉及文件                                               |
| --- | ------------------------------------------------- | ------------------------------------------------------ |
| M1  | 合并两套 KML 解析与抓取实现                       | `core/travel/`、`core/site/lib/travel-data-builder.js` |
| M2  | 合并两个 image-processor、拼音 slug、head partial | gallery/pictures/common                                |
| M3  | 博客正文统一 sanitizeHtml                         | `core/site/lib/blog-manager.js`                        |
| M5  | 停止暴露 data.json；清理死代码（M6）              | `resource-manager.js`、`blog-builder.js` 等            |
| L1  | 测试改造：带断言 + 隔离输出目录；为核心模块补测试 | 根目录测试脚本                                         |
| L2  | package.json 清理                                 | `package.json`                                         |

**预期收益**：可维护性与安全性提升

---

## 附：验证方式

每期完成后：

1. 运行完整构建 `pnpm build`（第一期修完 upload 问题后应能跑通）
2. `pnpm preview` 本地检查输出
3. 对比 `web/` 产物体积变化
4. 相册/站点页面可见变更时截图记录
