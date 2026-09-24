#!/usr/bin/env node
/**
 * telegram-to-timeline：把 Telegram（经 Hermes 网关）的文本 / 图片 / 位置落到时间轴素材目录。
 *
 *   <org>/2026-09-21 0730/
 *   ├── content.md      ← 文本（空行分段）+ 末尾「## 位置信息：」代码块（经度,纬度 + 地址）
 *   ├── p1.jpg
 *   └── p2.jpg
 *
 * 聚合规则：同一会话 + 同一发送者，且「同一 media_group_id」或「相邻消息间隔 ≤ --window 秒」
 * 的消息合成一条记录；目录名取该组第一条消息的时间（YYYY-MM-DD HHmm）。
 *
 * 用法：
 *   node scripts/import.mjs --file=updates.json [--org=<dir>] [--dry-run]
 *   node scripts/import.mjs --url=https://hermes.example/api/updates --token=$HERMES_TOKEN
 *   cat updates.json | node scripts/import.mjs
 *
 * 详见 ../SKILL.md、../references/input-format.md、../references/org-format.md
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_WINDOW = 60; // 秒：同一"次发送"的时间窗口（相册、配文、位置常差几秒）
const DEFAULT_EXT = ".jpg";
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function parseArgs(argv) {
  const opts = {
    org: path.resolve(process.cwd(), "data-source/timeline/org"),
    file: null,
    url: null,
    method: "GET",
    token: null,
    headers: [],
    window: DEFAULT_WINDOW,
    tz: null,
    base: null,
    state: null,
    force: false,
    dryRun: false,
    maxPhotos: 0,
  };

  for (const arg of argv.slice(2)) {
    const matched = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!matched) {
      console.warn(`⚠️  忽略无法识别的参数：${arg}`);
      continue;
    }
    const key = matched[1];
    const value = matched[2] === undefined ? true : matched[2];

    switch (key) {
      case "org": opts.org = path.resolve(String(value)); break;
      case "file": opts.file = path.resolve(String(value)); break;
      case "url": opts.url = String(value); break;
      case "method": opts.method = String(value).toUpperCase(); break;
      case "token": opts.token = String(value); break;
      case "header": opts.headers.push(String(value)); break;
      case "window": opts.window = Number(value) || DEFAULT_WINDOW; break;
      case "tz": opts.tz = String(value); break;
      case "base": opts.base = path.resolve(String(value)); break;
      case "state": opts.state = path.resolve(String(value)); break;
      case "max-photos": opts.maxPhotos = Number(value) || 0; break;
      case "force": opts.force = true; break;
      case "dry-run": opts.dryRun = true; break;
      case "help": opts.help = true; break;
      default: console.warn(`⚠️  未知参数：--${key}`);
    }
  }
  return opts;
}

function usage() {
  console.log(`用法：
  node scripts/import.mjs --file=<updates.json> [选项]
  node scripts/import.mjs --url=<endpoint> [选项]
  cat updates.json | node scripts/import.mjs [选项]

选项：
  --org=<dir>        输出目录（默认 <cwd>/data-source/timeline/org）
  --file=<path>      输入 JSON（Telegram Update 数组 / {result:[…]} / 单条 update / 扁平消息对象）
  --url=<endpoint>   输入 HTTP 接口（默认 GET，可用 --method=POST）
  --token=<token>    HTTP Authorization: Bearer；下载 file_id 图片时也用它
  --header=<k:v>     追加请求头（可重复）
  --window=<sec>     聚合窗口秒数（默认 ${DEFAULT_WINDOW}）
  --tz=<zone>        时区，如 Asia/Shanghai（默认跟随本机）
  --base=<dir>       输入里相对图片路径的基准目录（默认取输入文件所在目录）
  --state=<file>     去重状态文件（默认 <org>/.import-state.json）
  --max-photos=<n>   每条记录最多保留几张图（默认不限）
  --force            忽略去重状态，重新处理
  --dry-run          只打印计划：不下载图片、不写任何文件`);
}

/* ---------------- 输入 ---------------- */

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

async function readInput(opts) {
  if (opts.url) {
    const headers = {};
    for (const raw of opts.headers) {
      const idx = raw.indexOf(":");
      if (idx > 0) headers[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
    }
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    const res = await fetch(opts.url, { method: opts.method, headers });
    if (!res.ok) throw new Error(`拉取 ${opts.url} 失败：HTTP ${res.status}`);
    return { payload: await res.json(), baseDir: process.cwd(), origin: opts.url };
  }

  if (opts.file) {
    const text = await fsp.readFile(opts.file, "utf-8");
    return {
      payload: JSON.parse(text),
      baseDir: opts.base || path.dirname(opts.file),
      origin: opts.file,
    };
  }

  const text = (await readStdin()).trim();
  if (!text) {
    usage();
    throw new Error("没有输入：请用 --file 或 --url，或把 JSON 从 stdin 传入");
  }
  return { payload: JSON.parse(text), baseDir: opts.base || process.cwd(), origin: "stdin" };
}

/* ---------------- 归一化 ---------------- */

function pickMessage(node) {
  if (!node || typeof node !== "object") return null;
  for (const key of ["message", "channel_post", "edited_message", "edited_channel_post"]) {
    if (node[key] && typeof node[key] === "object") return node[key];
  }
  if (node.text || node.caption || node.photo || node.photos || node.location || node.venue || node.place) {
    return node;
  }
  return null;
}

function messageTimestamp(raw) {
  if (raw.date_iso) {
    const ms = Date.parse(raw.date_iso);
    if (Number.isFinite(ms)) return ms;
  }
  const seconds = Number(raw.date ?? raw.timestamp);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

function extFromMime(mime) {
  const value = String(mime || "").toLowerCase();
  if (value.includes("png")) return ".png";
  if (value.includes("webp")) return ".webp";
  if (value.includes("gif")) return ".gif";
  return DEFAULT_EXT;
}

function photoSourceOf(item) {
  if (!item) return null;
  if (typeof item === "string") {
    if (item.startsWith("data:")) return { kind: "data", value: item };
    if (/^https?:\/\//i.test(item)) return { kind: "url", value: item };
    return { kind: "path", value: item };
  }
  if (typeof item !== "object") return null;
  if (item.data) return { kind: "data", value: String(item.data) };
  if (item.url) return { kind: "url", value: String(item.url) };
  if (item.path || item.file) return { kind: "path", value: String(item.path || item.file) };
  if (item.file_id) {
    return { kind: "telegram", value: String(item.file_id), ext: extFromMime(item.mime_type) };
  }
  return null;
}

function collectPhotos(raw) {
  const sources = [];

  if (Array.isArray(raw.photo) && raw.photo.length) {
    const best = raw.photo
      .slice()
      .sort((a, b) => (b.file_size || 0) - (a.file_size || 0) || (b.width || 0) - (a.width || 0))[0];
    const src = photoSourceOf(best);
    if (src) sources.push(src);
  }

  const doc = raw.document;
  if (doc && String(doc.mime_type || "").startsWith("image/")) {
    const src = photoSourceOf(doc);
    if (src) sources.push(src);
  }

  for (const item of raw.photos || raw.images || []) {
    const src = photoSourceOf(item);
    if (src) sources.push(src);
  }

  return sources;
}

function collectPlace(raw) {
  const venue = raw.venue;
  if (venue && venue.location) {
    return {
      lat: Number(venue.location.latitude),
      lng: Number(venue.location.longitude),
      label: [venue.title, venue.address].filter(Boolean).join(" "),
    };
  }

  const loc = raw.location || raw.place;
  if (loc && loc.latitude !== undefined) {
    return {
      lat: Number(loc.latitude),
      lng: Number(loc.longitude),
      label: String(loc.title || loc.address || loc.label || ""),
    };
  }
  return null;
}

function normalizeMessage(raw) {
  const sender = raw.from || {};
  if (sender.is_bot === true) return null; // Hermes / 其它 bot 的回复不进素材

  const timestamp = messageTimestamp(raw);
  if (!timestamp) return null;

  const text = String(raw.text ?? raw.caption ?? raw.message ?? "").trim();
  const photos = collectPhotos(raw);
  const place = collectPlace(raw);
  if (!text && !photos.length && !place) return null;

  const id = raw.message_id ?? raw.id ?? null;
  return {
    id,
    key: `${raw.chat?.id ?? raw.chat_id ?? "?"}:${id ?? timestamp}`,
    chat: String(raw.chat?.id ?? raw.chat_id ?? "?"),
    sender: String(sender.id ?? raw.from_id ?? "?"),
    group: raw.media_group_id ? String(raw.media_group_id) : null,
    timestamp,
    text,
    photos,
    place,
  };
}

function extractMessages(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.result)
      ? payload.result
      : Array.isArray(payload?.messages)
        ? payload.messages
        : [payload];

  const messages = [];
  let skippedBots = 0;
  let skippedEmpty = 0;

  for (const node of list) {
    const raw = pickMessage(node);
    if (!raw) {
      skippedEmpty++;
      continue;
    }
    if ((raw.from || {}).is_bot === true) {
      skippedBots++;
      continue;
    }
    const msg = normalizeMessage(raw);
    if (msg) messages.push(msg);
    else skippedEmpty++;
  }
  return { messages, skippedBots, skippedEmpty };
}

/* ---------------- 聚合 ---------------- */

function groupMessages(messages, windowSec) {
  const sorted = messages.slice().sort((a, b) => a.timestamp - b.timestamp);
  const groups = [];

  for (const msg of sorted) {
    const last = groups[groups.length - 1];
    const lastMsg = last ? last.messages[last.messages.length - 1] : null;
    const sameThread = last && last.chat === msg.chat && last.sender === msg.sender;
    const sameAlbum = sameThread && lastMsg.group !== null && lastMsg.group === msg.group;
    const newAlbum = sameThread && lastMsg.group !== null && msg.group !== null && lastMsg.group !== msg.group;
    const withinWindow = sameThread && msg.timestamp - lastMsg.timestamp <= windowSec * 1000;

    if (last && (sameAlbum || (withinWindow && !newAlbum))) {
      last.messages.push(msg);
      last.lastTimestamp = msg.timestamp;
      continue;
    }

    groups.push({
      chat: msg.chat,
      sender: msg.sender,
      messages: [msg],
      timestamp: msg.timestamp,
      lastTimestamp: msg.timestamp,
    });
  }
  return groups;
}

/* ---------------- 输出 ---------------- */

function formatDirName(ms, tz) {
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-CA", tz ? { ...options, timeZone: tz } : options).formatToParts(new Date(ms));
  } catch (err) {
    console.warn(`⚠️  时区 ${tz} 无效，改用本机时区`);
    parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(new Date(ms));
  }
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}${get("minute")}`;
}

function buildContent(group) {
  const texts = [];
  for (const msg of group.messages) {
    if (msg.text && !texts.includes(msg.text)) texts.push(msg.text);
  }
  const place = group.messages.map((m) => m.place).find(Boolean) || null;

  const lines = [];
  if (texts.length) lines.push(texts.join("\n\n"), "");
  if (place) {
    lines.push("## 位置信息：", "", "```", `${place.lng.toFixed(6)},${place.lat.toFixed(6)}`);
    if (place.label) lines.push(place.label);
    lines.push("```", "");
  }
  return lines.join("\n");
}

async function loadPhotoBytes(source, opts) {
  if (source.kind === "data") {
    const base64 = String(source.value).split(",")[1] || "";
    return { buffer: Buffer.from(base64, "base64"), ext: DEFAULT_EXT };
  }
  if (source.kind === "url") {
    const res = await fetch(source.value);
    if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}：${source.value}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = path.extname(new URL(source.value).pathname).toLowerCase();
    return { buffer, ext: IMAGE_EXT.has(ext) ? ext : DEFAULT_EXT };
  }
  if (source.kind === "path") {
    const file = path.isAbsolute(source.value) ? source.value : path.join(opts.baseDir, source.value);
    const buffer = await fsp.readFile(file);
    const ext = path.extname(file).toLowerCase();
    return { buffer, ext: IMAGE_EXT.has(ext) ? ext : DEFAULT_EXT };
  }
  if (source.kind === "telegram") {
    if (!opts.token) throw new Error("图片是 file_id，需要 --token（或 $TELEGRAM_BOT_TOKEN）才能下载");
    const meta = await fetch(`https://api.telegram.org/bot${opts.token}/getFile?file_id=${encodeURIComponent(source.value)}`);
    const info = await meta.json();
    if (!info.ok) throw new Error(`getFile 失败：${info.description || "unknown"}`);
    const url = `https://api.telegram.org/file/bot${opts.token}/${info.result.file_path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}：${url}`);
    return { buffer: Buffer.from(await res.arrayBuffer()), ext: source.ext || DEFAULT_EXT };
  }
  throw new Error(`不支持的图片来源：${JSON.stringify(source)}`);
}

async function nextFreeIndex(dir) {
  let index = 1;
  if (!fs.existsSync(dir)) return index;
  const used = new Set(fs.readdirSync(dir));
  while (used.has(`p${index}.jpg`) || used.has(`p${index}.png`) || used.has(`p${index}.webp`) || used.has(`p${index}.gif`)) {
    index++;
  }
  return index;
}

function loadState(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (parsed && typeof parsed.processed === "object") return parsed;
  } catch (err) {
    /* 首次运行或文件损坏：当空状态处理 */
  }
  return { version: 1, processed: {} };
}

async function writeGroup(group, dirName, opts, state) {
  const dir = path.join(opts.org, dirName);
  const existed = fs.existsSync(path.join(dir, "content.md"));
  await fsp.mkdir(dir, { recursive: true });

  const content = buildContent(group);
  if (content) {
    if (existed) {
      console.warn(`⚠️  ${dirName}：content.md 已存在，文本追加到末尾`);
      await fsp.appendFile(path.join(dir, "content.md"), `${content}\n`, "utf-8");
    } else {
      await fsp.writeFile(path.join(dir, "content.md"), content, "utf-8");
    }
  }

  let sources = group.messages.flatMap((m) => m.photos);
  if (opts.maxPhotos > 0) sources = sources.slice(0, opts.maxPhotos);

  let index = await nextFreeIndex(dir);
  let saved = 0;
  for (const source of sources) {
    const { buffer, ext } = await loadPhotoBytes(source, opts);
    await fsp.writeFile(path.join(dir, `p${index}${ext}`), buffer);
    index++;
    saved++;
  }

  for (const msg of group.messages) state.processed[msg.key] = dirName;
  return { dirName, saved, textLength: content.length };
}

/* ---------------- 主流程 ---------------- */

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    usage();
    return;
  }
  if (!opts.token && process.env.TELEGRAM_BOT_TOKEN) opts.token = process.env.TELEGRAM_BOT_TOKEN;

  const { payload, baseDir, origin } = await readInput(opts);
  opts.baseDir = opts.base || baseDir;

  const { messages, skippedBots, skippedEmpty } = extractMessages(payload);
  console.log(`📥 读入 ${messages.length} 条消息（来源：${origin}；忽略 bot 消息 ${skippedBots} 条、空消息 ${skippedEmpty} 条）`);
  if (!messages.length) {
    console.log("没有可用消息，什么都没做。");
    return;
  }

  const groups = groupMessages(messages, opts.window);
  console.log(`🗂  按 ${opts.window}s 窗口 / 媒体组聚合为 ${groups.length} 条记录`);

  const stateFile = opts.state || path.join(opts.org, ".import-state.json");
  const state = opts.force ? { version: 1, processed: {} } : loadState(stateFile);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const group of groups) {
    const dirName = formatDirName(group.timestamp, opts.tz);
    const allProcessed = group.messages.every((m) => state.processed[m.key]);

    if (allProcessed && !opts.force) {
      console.log(`⏭  ${dirName}  ·  已处理过（--force 可强制重来）`);
      skipped++;
      continue;
    }

    const textLength = buildContent(group).replace(/\s/g, "").length;
    const photoCount = group.messages.reduce((n, m) => n + m.photos.length, 0);
    const place = group.messages.map((m) => m.place).find(Boolean);
    const summary = [
      textLength ? `${textLength} 字` : "无文本",
      photoCount ? `${photoCount} 张图` : "无图",
      place ? (place.label ? `地点 ${place.label}` : "仅有坐标") : "无位置",
    ].join(" · ");

    if (opts.dryRun) {
      console.log(`🧪 ${dirName}  ·  ${summary}  →  ${path.join(opts.org, dirName)}`);
      continue;
    }

    try {
      const result = await writeGroup(group, dirName, opts, state);
      console.log(`🆕 ${dirName}  ·  ${summary}  →  写入 ${result.saved} 张图`);
      created++;
    } catch (err) {
      console.error(`❌ ${dirName} 处理失败：${err.message}`);
      failed++;
    }
  }

  if (!opts.dryRun) {
    await fsp.mkdir(path.dirname(stateFile), { recursive: true });
    await fsp.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
    console.log(`\n✅ 完成：新增 ${created} 条 / 跳过 ${skipped} 条${failed ? ` / 失败 ${failed} 条` : ""} → ${opts.org}`);
    console.log(`ℹ️  ${path.relative(process.cwd(), stateFile) || stateFile} 记录了已处理的消息，重复导入不会重复建目录`);
    console.log("ℹ️  下一步（在站点仓库根）：pnpm build:timeline && pnpm build:home");
  } else {
    console.log("\n🧪 dry-run：没有写任何文件、没有下载图片");
  }

  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exitCode = 1;
});
