---
name: telegram-to-timeline
description: Use when Telegram messages (text, photos, location — usually relayed by the Hermes gateway) need to be saved into a timeline source directory as dated folders with content.md — fetches updates from a JSON file / HTTP endpoint / stdin, groups albums and follow-ups into one record per "send", downloads or copies the photos as p1.jpg/p2.jpg, and de-duplicates re-imports so the site's `pnpm build:timeline` can consume them.
---

# Telegram → timeline 素材目录

## 用途

把 Telegram（含经 Hermes 网关中转）的 **文本 / 图片 / 位置** 落成时间轴素材：

```
<org>/2026-09-21 0730/
├── content.md      # 正文（空行分段）+ 末尾「## 位置信息：」代码块（经度,纬度 + 地址）
├── p1.jpg
└── p2.jpg
```

随后由站点仓库的 `pnpm build:timeline` 把它变成 `data-source/timeline.json`，`pnpm build:home` 重新构建首页。
本 skill **只写素材目录**，不生成 JSON、不碰站点产物。

## 何时使用

- 用户说「把 Telegram / Hermes 的消息导入时间轴」「把今天发的图片和位置存到 org/」「同步一下我这批记录」
- 需要把带位置的图文消息整理成 `data-source/timeline/org/<日期 时间>/content.md` 的格式
- 需要给时间轴补一批素材（单次或定期批量）

## 工作流

1. **确认输入来源**（三选一，缺省从 stdin 读）：
   - `--file=<updates.json>`：Hermes 落盘的更新文件
   - `--url=<endpoint>`：Hermes 的 HTTP 接口（默认 GET，可 `--method=POST`、`--token=`、`--header=k:v`）
   - 管道：`cat updates.json | node $SKILL/scripts/import.mjs`
2. **先干跑**：加 `--dry-run` 确认聚合结果与目录名（不会下载图片、不写任何文件）。
3. **正式导入**：去掉 `--dry-run`。默认写到 `<cwd>/data-source/timeline/org`，用 `--org=<dir>` 改。
4. **复核产出**：抽查 `content.md`（正文分段、坐标顺序、地址行）与图片编号。
5. **交给构建**（在站点仓库根）：`pnpm build:timeline && pnpm build:home`。

```bash
# 命令都在站点仓库根执行。$SKILL = 本 skill 所在目录 —— 仓库内即 skills/telegram-to-timeline，
# 装在别处（如 ~/.codebuddy/skills/telegram-to-timeline）就换成它的绝对路径；路径不必写死。
SKILL=skills/telegram-to-timeline

# 干跑（推荐先做）
node $SKILL/scripts/import.mjs --file=updates.json --tz=Asia/Shanghai --dry-run

# 正式导入（默认写 <cwd>/data-source/timeline/org）
node $SKILL/scripts/import.mjs --file=updates.json --tz=Asia/Shanghai

# 冒烟测试（用自带示例数据，不需要网络；dry-run 不写任何文件）
node $SKILL/scripts/import.mjs --file=$SKILL/assets/sample-updates.json --org=./.tmp-org --tz=Asia/Shanghai --dry-run
```

## 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `--org=<dir>` | `<cwd>/data-source/timeline/org` | 素材输出目录 |
| `--file=<path>` | — | 输入 JSON（数组 / `{result:[…]}` / 单条 / 裸消息） |
| `--url=<endpoint>` | — | 输入 HTTP 接口 |
| `--method=<GET\|POST>` | `GET` | 配合 `--url` |
| `--token=<token>` | `$TELEGRAM_BOT_TOKEN` | HTTP `Authorization: Bearer`；下载 `file_id` 图片也用它 |
| `--header=<k:v>` | — | 追加请求头，可重复 |
| `--window=<sec>` | `60` | 聚合窗口：相邻消息间隔不超过它就并成一条 |
| `--tz=<zone>` | 本机时区 | 目录名用哪个时区，如 `Asia/Shanghai` |
| `--base=<dir>` | 输入文件所在目录 | 相对图片路径的基准目录 |
| `--state=<file>` | `<org>/.import-state.json` | 去重状态 |
| `--max-photos=<n>` | 不限 | 每条最多保留几张图 |
| `--force` | — | 忽略状态重新处理 |
| `--dry-run` | — | 只打印计划 |

## 聚合规则（决定「几个目录」）

同一会话 + 同一发送者，满足任一即并成一条：

- `media_group_id` 相同（相册多图 + 配文）；
- 相邻消息间隔 ≤ `--window` 秒（紧跟着补发的文字、位置+说明）。

不同 `media_group_id` 不会被混在一起。目录名 = 该组第一条消息的时间，`YYYY-MM-DD HHmm`。
`from.is_bot === true` 的消息（Hermes 的回复）一律忽略。

## 幂等

处理成功后把消息键写进 `<org>/.import-state.json`，重复导入整条跳过（`--force` 可重来）。该文件以 `.` 开头，`build:timeline` 扫描时会忽略。同一目录后续新增消息时，图片会从下一个空位继续编号。

## 参考文档

- 输入字段、图片给法、Hermes 需要产出什么 → `references/input-format.md`
- 输出目录与 `content.md` 规范、与 `build:timeline` 的衔接 → `references/org-format.md`

## 排错

| 现象 | 处理 |
|---|---|
| `没有输入：请用 --file 或 --url` | 补输入来源；管道用法要确认 stdin 有内容 |
| `图片是 file_id，需要 --token` | 传 `--token=`，或设环境变量 `TELEGRAM_BOT_TOKEN`；若 Hermes 能直接给路径/URL 就优先用那种 |
| 目录名时区不对 | 加 `--tz=Asia/Shanghai`（Telegram 的 `date` 是 UTC 秒） |
| 一条消息被拆成多个目录 | 相册缺 `media_group_id`，或两条消息间隔超过 `--window`，按需调大窗口 |
| 一天内多条被并成一条 | 两条消息间隔在窗口内；调小 `--window`（如 `--window=20`） |
| 想改某条的文字或加标题 | 直接编辑该目录的 `content.md`：顶部加 `# 标题`，正文按空行分段 |
| 只有坐标、没有地址 | Telegram 普通位置消息不带地址；`pnpm build:timeline` 会告警提示补地址，手工把地址补到坐标行下面即可 |
