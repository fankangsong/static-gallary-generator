# 输入格式（Telegram / Hermes → import.mjs）

`scripts/import.mjs` 只要求输入是 **一条或多条「消息」**，消息形状与 **Telegram Bot API 的 `Update` / `Message` 兼容**；Hermes 只要能给出下面这些字段，就能直接喂进来。

## 1. 顶层容器

以下三种都接受（可以是单个，也可以是数组）：

| 形态 | 例子 |
|---|---|
| `Update` 数组 | `[{"update_id":1,"message":{…}}, …]` |
| `getUpdates` 返回体 | `{"ok":true,"result":[{"message":{…}}, …]}` |
| 裸 `Message` | `{"message_id":101,"date":1789947000,"text":"…"}` |

从 `Update` 里取消息时按顺序识别：`message` → `channel_post` → `edited_message` → `edited_channel_post`；没有外层包裹的对象会被当作消息本身。

## 2. 消息字段（用到哪些）

| 字段 | 必需 | 说明 |
|---|---|---|
| `date` | 是（或 `date_iso`） | Unix 秒（Telegram 原样）。也支持 `date_iso`：`"2026-09-19T09:05:00+08:00"` |
| `message_id` | 建议 | 去重状态用；缺省时退化为「时间戳」做键 |
| `chat.id` / `chat_id` | 建议 | 参与聚合与去重；缺省为 `?` |
| `from.id` / `from_id` | 建议 | 参与聚合；缺省为 `?` |
| `from.is_bot` | — | **为 `true` 的消息一律忽略**（Hermes 等 bot 的回复不会进素材） |
| `text` | — | 正文 |
| `caption` | — | 相册配文（没有 `text` 时当正文） |
| `media_group_id` | — | 相册分组键；同组消息合成一条记录 |
| `photo` | — | Telegram 的尺寸数组，取 `file_size`（其次 `width`）最大的一张 |
| `document` | — | `mime_type` 以 `image/` 开头时当图片 |
| `location` | — | `{latitude, longitude}`（可带 `title` / `address`） |
| `venue` | — | `{title, address, location:{latitude, longitude}}`，`title` + `address` 会拼成地址行 |

### 简化形态（Hermes 自己组装时最省事）

```json
{
  "message_id": 109,
  "date_iso": "2026-09-19T09:05:00+08:00",
  "chat_id": 5550001,
  "from_id": 7770001,
  "text": "相机送去保养了，最近只能用手机拍。",
  "photos": ["demo/p1.jpg", { "url": "https://…/p2.jpg" }],
  "location": { "latitude": 22.5431, "longitude": 114.0579, "title": "深圳湾公园" }
}
```

## 3. 图片的四种给法

`photo[]` / `document` / `photos[]` 里的每一项都可以是：

| 写法 | 说明 |
|---|---|
| `"sample/p1.jpg"`（字符串） | 本地路径：绝对路径，或相对「输入文件所在目录」（`--base` 可改基准） |
| `{ "file": "sample/p1.jpg" }` | 同上；`{"path": …}` 等价 |
| `{ "url": "https://…/p1.jpg" }` | HTTP 下载 |
| `{ "data": "data:image/jpeg;base64,…" }` | 内联 base64（Hermes 直接内联小图时可用） |
| `{ "file_id": "AgAC…", "mime_type": "image/jpeg" }` | 真·Telegram 取文件：需要 `--token`（或环境变量 `TELEGRAM_BOT_TOKEN`），走 `getFile` → `api.telegram.org/file/...` |

图片会按顺序存成 `p1.jpg`、`p2.jpg`…（后缀跟随来源的实际扩展名）。同一目录重复导入时从下一个空位继续编号。

## 4. 聚合规则（决定「几个目录」）

同一 `chat.id` + 同一 `from.id` 的消息，满足以下**任一**条件就并成一条记录：

- 两者的 `media_group_id` 相同（相册）；
- 相邻消息时间间隔 **≤ `--window` 秒**（默认 60）—— 相册配文、紧跟着补发的文字、位置+说明都会落进同一条。

若两条消息属于**不同的** `media_group_id`，即使时间很近也算两条（两个相册不会被混在一起）。

目录名取该组**第一条消息**的时间，格式 `YYYY-MM-DD HHmm`（`--tz` 指定时区，默认跟随本机）。

## 5. 幂等

处理成功的记录会把其消息键（`chat.id:message_id`）写进 `<org>/.import-state.json`；再次导入同一批数据会整条跳过（`--force` 可强制重来）。该文件以 `.` 开头，`build:timeline` 扫描时会被忽略。
