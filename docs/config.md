# config.json 配置说明

`config.json` 是本站点的**全局唯一配置入口**，由 `core/common/lib/config.js` 在启动时加载并扁平化透出。所有站点设置（标题、导航、页面、图片处理参数、源目录）都集中在这里，避免在模板或脚本中硬编码。

## 加载机制

```
config.js（loadConfig）
  ├─ 读取 PROJECT_ROOT/config.json
  ├─ 扁平化：common.site → website，site.blog → blog，pictures 缺省为 {}
  └─ 路径解析：相对路径均以「项目根目录」为基准，解析结果注入绝对路径字段
       ├─ gallery.photosDir  → gallery.absolutePhotosDir
       ├─ pictures.sourceDir → pictures.absoluteSourceDir
       └─ site.blog.dir      → blog-manager 内部解析
```

修改本文件后重新运行对应构建命令即可生效，无需改动任何代码。

---

## common — 全局公共

| 字段 | 类型 | 说明 | 消费方 |
|---|---|---|---|
| `site.title` | string | 站点标题，注入模板变量 `WEBSITE_TITLE` | site/gallery 页面模板 |
| `site.description` | string | 站点描述，作为博客等页面 DESCRIPTION 的兜底值 | html-generator |
| `site.url` | string | 站点域名（不带协议头时自动补 `https://`），注入 `WEBSITE_TITLE_SUFFIX`；sitemap 以此为 baseUrl | page-generator / sitemap-generator |
| `site.font.name` | string | 子集字体的输出文件名（如 `KingHwaOldSong.ttf`） | font-manager |
| `site.font.source` | string | 源字体 TTF 路径，**相对项目根**；文件不存在时跳过子集化并告警 | font-manager |
| `defaultAuthor` | string | 默认作者，相册/博客未单独指定 author 时使用 | data-manager / blog-manager 等 |

## gallery — 摄影相册（`index:gallary` / `build:gallary`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `navBrand` | string | 相册品牌名，注入 `WEBSITE_NAV_BRAND`，并参与字体子集取字 |
| `brandDescription` | string | 品牌标语，注入 `WEBSITE_BRAND_DESCRIPTION`，同样参与字体子集取字 |
| `logo.enabled` | boolean | 是否渲染 logo |
| `logo.src` | string | logo 地址（产物内绝对路径，如 `/assets/logo.svg`） |
| `logo.width` | string | logo 显示宽度（CSS 值） |
| `photosDir` | string | **照片源目录**，相对项目根（`../photography` 即项目根的上级目录）；其下每个子目录 = 一个相册 |
| `template` | string | 相册默认模板名（`templates/gallary/` 下的模板，如 `magazine`）；相册级 meta.template 可覆盖 |
| `supportedExtensions` | string[] | 扫描时识别的图片扩展名（小写匹配） |
| `thumbnail` | object | 缩略图参数：`width` / `height` / `quality` / `fit`（sharp resize 参数），输出 `thumb_<名称>.jpg` |
| `large` | object | 大图参数：`maxSize`（超限时等比缩到该尺寸内）/ `quality` / `fit`，输出 `large_<名称>.jpg` |
| `concurrency` | number | 图片处理并发度（缩略图 + large 图），缺省 `4`；非法值（<1 / 非数字）回落为 `1` 即串行。相册之间的循环始终串行 |

## pictures — 女儿的画册（`build:pictures`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `sourceDir` | string | **绘本源目录**，相对项目根；其下每个子目录 = 一本绘本，书名取目录名、页题取文件名（如 `01-出发.png` → 「出发」） |
| `supportedExtensions` | string[] | 识别的图片扩展名，与 gallery 同规则 |
| `thumbnail` | object | 缩略图参数，同 gallery.thumbnail；阅读器仅使用 thumb 图（不生成 large） |
| `concurrency` | number | 缩略图处理并发度，缺省 `4`；规则同 gallery.concurrency |

产物输出到 `web/pictures/`（书架页 + `data.json` + `images/<绘本id>/thumb_*.jpg`），绘本 id 为目录名的拼音 slug（中文自动转换，重名追加 `-2`）。

## timeline — 时间轴素材（`build:timeline`）

| 字段 | 类型 | 说明 |
|---|---|---|
| `sourceDir` | string | **手写素材目录**，相对项目根；其下每个「日期目录」= 一条记录，目录名形如 `2026-09-21`（可带时间：`2026-09-21 0730` / `2026-09-21-1830` / `2026-09-21 18:30`），不合规的目录会被跳过并告警 |
| `outputFile` | string | 生成文件路径，相对项目根（默认 `data-source/timeline.json`，即首页数据源，每次运行**整份重写**）；可用 `--out=` 指向临时文件做预览 |
| `supportedExtensions` | string[] | 日期目录内识别为照片的扩展名（小写比较），其余文件忽略（如 `content.md`、`.txt`） |

日期目录内的 `content.md`：

```md
# 标题（可选，取首个一/二级标题）

正文第一段……

正文第二段……

## 位置信息：（可写 位置 / 地点，可带 # 与中英文冒号）

```
113.123456,22.123456     ← 第一行：坐标「经度,纬度」，全角逗号亦可；写成「纬度,经度」会自动交换
广东省深圳市盐田区大梅沙    ← 其余非空行用空格拼成地址
```
```

- 正文按空行分段（首页按 `\n{2,}/` 拆成多个 `<p>`），不解析 markdown 行内语法；缺位置区块时 `location` / `coord` 缺省
- 照片按文件名自然序（`p1 < p2 < p10`），顺序即首页卡堆的展示顺序（首页每堆最多取前 3 张）
- 生成的记录按日期倒序（最新在前，与首页刻度带方向一致），字段为空则不写该键

流程：把素材放进 `org/<日期>/` → `pnpm build:timeline`（整份重写 `data-source/timeline.json`）→ `pnpm build:home`。想先看结果又不覆盖数据源，用 `pnpm build:timeline -- --out=/tmp/timeline.json` 预览。照片经首页 `publish` 的 org 条目发布到 `web/assets/timeline/org/`，因此 `photos` 里的路径前缀由该条目推导，保证与产物地址一致。

## site — 站点页面与导航（`build:site`）

### `site.nav` — 全局导航

数组，每项 `{ text, url }`。注入所有模板的 `NAV_LINKS`（别名 `LINKS`）；导航文字同样参与字体子集取字。

### `site.pages[]` — 静态页面清单

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 页面标识（日志用） |
| `template` | string | EJS 模板路径，相对 `templates/site/`（如 `travel/index.html`） |
| `output` | string | 产物相对路径，相对 `web/`（如 `travel/index.html`） |
| `fontOutput` | string | 该页字体子集的输出目录，相对 `web/` |
| `dataFile` | string | 可选。数据源 JSON 的路径，**相对项目根**（如首页的 `data-source/timeline.json`）：构建期读取后原样注入模板变量 `DATA_FILE`，其全部文本同时作为该页字体子集的取字来源 —— 数据驱动页面的正文不在模板里，只能按这份 JSON 取字 |
| `publish` | object[] | 可选。需要发布到产物的静态资产，每项 `{ from, to, ext? }`：`from` 相对项目根、`to` 相对 `web/`，目录整棵拷贝；`ext`（可选，如 `[".jpg", ".jpeg"]`）是扩展名白名单，配了它则目录里的其它文件（例如时间轴素材里的 `content.md` 原文）不会被发布，不配则整棵原样拷贝。如首页把 `data-source/timeline/demo` 与 `data-source/timeline/org`（仅图片）发布到 `assets/timeline/` 下 |
| `data` | object | 注入模板的变量（如 `TITLE`、`DESCRIPTION`），与全局变量合并；其中所有字符串都会参与字体子集取字，所以 JS 运行时才渲染的文案（如首页的 `UI_TEXT`）也放在这里 |

#### 现有页面

| 页面 | 模板 | 产物 | 数据与字体 |
|---|---|---|---|
| 首页（时间轴） | `templates/site/index.html` | `web/index.html` | 数据源 `data-source/timeline.json`，构建期内联进页面的 `#tl-data`（无前端 fetch）；照片经 `publish` 发布；字体子集 `web/assets/fonts/index/` |
| 关于 | `templates/site/about.html` | `web/about/index.html` | 原首页的竖排版式；字体子集 `web/assets/fonts/about/` |
| 旅行 | `templates/site/travel/index.html` | `web/travel/index.html` | 字体子集 `web/assets/fonts/travel/` |
| 404 | `templates/site/404.html` | `web/404.html` | 字体子集 `web/assets/fonts/error/` |

### `site.blog` — 博客

| 字段 | 类型 | 说明 |
|---|---|---|
| `dir` | string | **博客源目录**，相对项目根；每个 `.md` 文件 = 一篇文章 |
| `template` | string | 文章页模板，相对 `templates/`（如 `blog/post`） |
| `indexTemplate` | string | 博客列表页模板（如 `blog/index`） |
| `title` / `description` | string | 列表页标题与描述（兜底「随笔」） |

### `site.travel` — 旅行足迹（`update:travel`，`build:site` 内嵌执行）

| 字段 | 类型 | 说明 |
|---|---|---|
| `kmlUrl` | string | Google My Maps 的 KML 数据地址；缺失时跳过 markers 生成并告警 |
| `snapshotPath` | string | 本地 KML 快照路径，**相对项目根**；在线抓取失败时回退使用 |
| `outputPath` | string | markers JSON 输出路径，相对 `web/`（默认 `assets/travel/markers.json`，compact 格式） |

---

## 配置 ↔ 命令对照

| 命令 | 读取的配置段 | 产物 |
|---|---|---|
| `pnpm index:gallary` | `gallery.photosDir` | `.temp/data.json` 相册索引 + `.temp/exif-cache.json` |
| `pnpm build:gallary` | `gallery` 全部 + `common` | `web/photography/`、`web/config/data.json`、字体子集 |
| `pnpm build:pictures` | `pictures` | `web/pictures/` |
| `pnpm build:site`（别名 `build:blog`） | `site` 全部 + `common` | `web/` 下的首页（时间轴）、关于、随笔、旅行、404 等 |
| `pnpm build:home` | `site.pages` 中 `name=index` 的条目 + `common` | 只出首页相关产物：`web/index.html`、`web/assets/timeline/`（`publish`）、`web/assets/fonts/index/` |
| `pnpm update:travel` | `site.travel` | `web/assets/travel/markers.json` |
| `pnpm build:timeline` | `timeline` | `data-source/timeline.json`（首页数据源，整份重写；`--out=` 可指向临时文件预览） |
| `pnpm build:css` | —（读 `tailwind.config.js` + `styles/tailwind.css`） | `web/assets/css/tailwind.css`（`build:gallary` / `build:site` 末尾也会自动执行） |
| `pnpm clear` | —（固定路径） | 删除 `web/` 与 `core/.temp/` |

> 命令级参数：`pnpm index:gallary -- --force` 忽略 `data.json` 与 EXIF 缓存全量重建（新增相册 / 元数据错乱时使用）。

---

## 相关配置文件

除 `config.json` 外还有两份构建用配置（均不进产物）：

| 文件 | 作用 |
|---|---|
| `tailwind.config.js` | Tailwind 扫描范围（content）与插件（`prose-*` 依赖 `@tailwindcss/typography`）。content 含 `templates/**/*.html|ejs`、`templates/assets/js/*.js`、`core/**/*.js` 与 `web/**/*.html`（后者用于捕获博客 markdown 内联 HTML 的类名）；刻意排除 `templates/assets/js/vendor/**` 与 `assets/data/**` 的大文件 |
| `styles/tailwind.css` | Tailwind 输入样式（`@tailwind base/components/utilities`）。放在 `styles/` 而非 `templates/assets/css/`，是因为资源拷贝步骤会把 `templates/assets` 整棵发布到 `web/` |

## 注意事项

1. **保持 JSON 合法**：不支持注释与尾逗号，改完可运行任一构建命令验证（解析失败会直接抛错）
2. **目录约定**：`photosDir` / `sourceDir` / `blog.dir` / `travel.snapshotPath` 四个源路径均相对项目根解析；指向项目外目录（如 `../photography`）是既有惯例
3. **新增静态页面**：在 `site.pages[]` 追加条目 + 在 `templates/site/` 放对应 EJS 模板，重新 `build:site`
4. **字体子集**：取字来源 = 模板 HTML 文本 + `site.nav` 文字 + `gallery.navBrand` + 页面 `data` 里的所有字符串 + 页面 `dataFile` 的全部文本，改这些内容后需重新构建才会重新取字；`site.font.source` 指向的 TTF 需真实存在，否则跳过并告警。注意模板里的 `<script>` / `<style>` 会被剥掉，所以 JS 运行时才渲染的文案（如首页日期里的「年月日」、卡堆的无障碍说明）必须写进该页 `data` 的 `UI_TEXT`，否则子集缺字、那几个字会回退到系统宋体
5. **扩展名**：`supportedExtensions` 匹配时统一转小写，新增格式（如 `.avif`）直接追加即可，sharp 自动支持
6. **相册手工元数据**：优先放源目录 `photography/<相册>/meta.json`（白名单字段：id / title / author / description / template / date / cover），优先级 **meta.json > data.json > 自动推导**；直接改 `core/.temp/data.json` 也会被保留
7. **图片处理参数变更不会自动重建**：`thumbnail` / `large` 的增量判定只比较源图与产物的 mtime，改 `quality` / `width` / `maxSize` 后需手工清理 `web/photography/`（或 `web/pictures/images/`）下的对应产物才会重新生成；源图文件更新则会自动重生成
8. **并发度调整**：`concurrency` 仅影响文件级并发；libvips 自身多线程，建议 2–8，调大主要增加内存占用而非速度
