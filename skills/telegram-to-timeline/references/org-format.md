# 输出约定（org/ 目录与 content.md）

本 skill 只写「素材目录」，不生成 JSON、不动站点产物；素材目录由仓库的 `pnpm build:timeline` 消费。

## 1. 目录结构

```
data-source/timeline/org/
├── 2026-09-21 0730/          ← 目录名 = YYYY-MM-DD HHmm（该条记录第一条消息的时间）
│   ├── content.md            ← 正文 + 位置区块
│   ├── p1.jpg
│   └── p2.jpg                ← 图片按文件名自然序，顺序即首页卡堆展示顺序
└── 2026-09-18 1820/
    └── content.md
```

- 目录名也可只写日期（`2026-09-21`），但本 skill 一律带时间，避免同一天多条互相覆盖。
- 非日期目录、`.` 开头的文件/目录都会被 `build:timeline` 跳过，因此可以放心放 `.import-state.json` 之类的附属文件。

## 2. content.md

```md
正文第一段……

正文第二段……                 ← 消息里的空行原样保留（→ 首页拆成多个 <p>）

## 位置信息：                  ← 标题也可写「位置」「地点」，可带 # 与中英文冒号

```
114.057900,22.543100          ← 第一行：坐标「经度,纬度」
大梅沙海滨公园 广东省深圳市盐田区盐梅路   ← 其余非空行拼成地址（可多行）
```
```

规则：

- **标题可选**：`# 标题` 会被 `build:timeline` 当作该条记录的标题（首页显示在正文上方）。skill 不会自动编造标题；想给某条加标题，在 `content.md` 顶部补一行 `# 标题` 即可。
- **正文不解析 markdown 行内语法**（`**粗体**` 会原样显示），按纯文本渲染。
- **坐标必须是「经度,纬度」**；写成「纬度,经度」时生成器会自动交换并告警。
- **Telegram 的普通位置消息只有经纬度、没有地址**：此时 skill 只写坐标行，`pnpm build:timeline` 会打一条 `位置区块只有坐标、没有地址文本` 的告警 —— 这是预期行为，事后手补地址即可（Venue 类型才自带名称/地址）。
- 没有位置的消息不写位置区块；没有图片的记录照样成立（首页有对应版式）。
- 消息里出现多个空行时会被规范成单个空行，避免首页出现空段落。

## 3. 与构建的衔接

```bash
# 命令都在站点仓库根执行。$SKILL = 本 skill 所在目录，按实际安装位置改这一行：
#   仓库内 skills/telegram-to-timeline ｜ Hermes ~/.hermes/skills/telegram-to-timeline ｜ CodeBuddy ~/.codebuddy/skills/telegram-to-timeline
SKILL=skills/telegram-to-timeline

# 1. 导入（默认写 <cwd>/data-source/timeline/org）
node $SKILL/scripts/import.mjs --file=updates.json

# 2. 生成数据源（会整份重写 data-source/timeline.json）
pnpm build:timeline

# 3. 重新构建首页
pnpm build:home          # 或 pnpm build:site
```

- 首页每条记录最多展示 **前 3 张** 图（`p1`、`p2`、`p3`），但 JSON 会收录目录里的全部图片。
- 想让某条记录的照片顺序变化，直接重命名 `pN.jpg` 即可（自然序：`p1 < p2 < p10`）。
- 照片由首页 `config.json` 的 `publish` 条目从 `data-source/timeline/org` 发布到 `web/assets/timeline/org`（只发布图片，md 原文不进站点产物）。
