const fs = require("fs");
const path = require("path");
const config = require("../common/lib/config");
const { PROJECT_ROOT } = require("../common/lib/constants");
const { logger } = require("../common/lib/utils");
const { scanSource } = require("./lib/source-scanner");

/**
 * build:timeline —— 从手写素材生成首页（时间轴）的数据文件。
 *
 * ## 素材目录约定
 *
 *   data-source/timeline/org/
 *   ├── 2026-09-21 0730/          目录名 = 日期，可带时间：2026-09-21 / 2026-09-21 0730 / 2026-09-21-0730
 *   │   ├── content.md            正文 + 位置区块（格式见 lib/content-parser.js 头部说明）
 *   │   ├── p1.jpg                图片按文件名自然序（p1 < p2 < p10），顺序即首页卡堆展示顺序
 *   │   └── p2.jpg
 *   └── 2026-09-18/
 *       └── content.md
 *
 * 目录名不合规、或不是目录的条目会被跳过并汇总告警；单条目录的问题只影响该条。
 *
 * ## 产出
 *
 *   默认写到 config.timeline.outputFile（data-source/timeline.json）—— 那就是首页的数据源，
 *   每次运行都会**整份重写**它（org/ 是唯一真源），写完 pnpm build:home 即可生效。
 *   记录按日期倒序（最新在前，与首页刻度带方向一致）。
 *   想先预览、不覆盖数据源：pnpm build:timeline -- --out=<临时文件>。
 *
 *   photos 里写的是「相对首页 PHOTO_BASE（/assets/timeline/）的路径」，
 *   前缀取自 config.site.pages[].publish 里 org 那条的 to，保证与发布路径严格一致；
 *   同时该 publish 条目带 ext 过滤，md 原文不会被发布到站点产物里。
 *
 * ## 用法
 *
 *   pnpm build:timeline
 *   pnpm build:timeline -- --src=data-source/timeline/org --out=/tmp/tl.json
 */

const PHOTO_BASE = "assets/timeline"; // 与 templates/site/index.html 的 PHOTO_BASE 对应

function parseArgs(args = []) {
  const options = {};
  for (const arg of args.slice(1)) {
    const matched = /^--(src|out)=(.+)$/.exec(String(arg || ""));
    if (!matched) {
      logger.warn(`忽略未知参数：${arg}（可用 --src=<dir> --out=<file>）`);
      continue;
    }
    options[matched[1]] = matched[2];
  }
  return options;
}

/**
 * photos 前缀：取 config.timeline.sourceDir → publish.to 的映射，
 * 使「/assets/timeline/ + photos[i]」正好是发布后的实际地址。
 */
function resolvePhotoPrefix(sourceDirRel) {
  const pages = (config.site && config.site.pages) || [];
  for (const page of pages) {
    for (const item of (page && page.publish) || []) {
      if (!item || item.from !== sourceDirRel) continue;
      if (item.to === PHOTO_BASE) return "";
      if (item.to.startsWith(`${PHOTO_BASE}/`)) return item.to.slice(PHOTO_BASE.length + 1);
    }
  }
  const fallback = path.basename(sourceDirRel);
  logger.warn(
    `config.site.pages[].publish 里没有 "${sourceDirRel}" 的发布条目，photos 前缀回退为 "${fallback}"（请补配置）`,
  );
  return fallback;
}

function toRecord(entry, prefix) {
  const record = { date: entry.date };
  if (entry.time) record.time = entry.time;
  if (entry.title) record.title = entry.title;
  if (entry.text) record.text = entry.text;
  if (entry.location) record.location = entry.location;
  if (entry.coord) record.coord = entry.coord;
  if (entry.images.length) {
    record.photos = entry.images.map((name) =>
      prefix ? `${prefix}/${entry.dirName}/${name}` : `${entry.dirName}/${name}`,
    );
  }
  return record;
}

/* 读已有文件的记录条数：不存在或不是合法 JSON 数组时返回 null（只用于日志提示） */
function readRecordCount(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return Array.isArray(parsed) ? parsed.length : null;
  } catch (err) {
    return null;
  }
}

/* 日期倒序（最新在前）；同日按时间倒序、再按目录名，保证重复运行结果稳定 */
function byDateDesc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const ta = a.time || "";
  const tb = b.time || "";
  if (ta !== tb) return ta < tb ? 1 : -1;
  return (a.dirName || "") < (b.dirName || "") ? 1 : -1;
}

async function run(args = []) {
  const options = parseArgs(args);
  const timelineConfig = config.timeline || {};
  const sourceDirRel = options.src || timelineConfig.sourceDir || "data-source/timeline/org";
  const outRel = options.out || timelineConfig.outputFile || "data-source/timeline.json";
  const sourceDir = path.isAbsolute(sourceDirRel) ? sourceDirRel : path.join(PROJECT_ROOT, sourceDirRel);
  const outPath = path.isAbsolute(outRel) ? outRel : path.join(PROJECT_ROOT, outRel);

  logger.log(`🕒 生成时间轴数据：${sourceDirRel} → ${outRel}`);

  let scan;
  try {
    scan = scanSource(sourceDir);
  } catch (err) {
    logger.error(`扫描源目录失败：${err.message}`);
    process.exitCode = 1;
    return;
  }

  if (scan.error) {
    logger.error(`素材目录不存在：${sourceDir}`);
    process.exitCode = 1;
    return;
  }

  scan.skipped.forEach(({ name, reason }) => logger.warn(`跳过 ${name}（${reason}）`));

  const prefix = resolvePhotoPrefix(sourceDirRel);
  const entries = scan.records.slice().sort(byDateDesc);
  const records = entries.map((entry) => toRecord(entry, prefix));

  if (!records.length) {
    logger.error(`没有解析出任何记录（目录 ${sourceDirRel} 下没有合规的日期目录），未写文件`);
    process.exitCode = 1;
    return;
  }

  /* 先拼好整段字符串再落盘：解析环节抛错也不会留下半成品 */
  const payload = `${JSON.stringify(records, null, 2)}\n`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  /* 这个文件就是首页的数据源、会被整份重写：落盘前记下原有条数，写完给出明确提示 */
  const previousCount = readRecordCount(outPath);
  fs.writeFileSync(outPath, payload, "utf-8");

  records.forEach((record) => {
    const bits = [
      record.photos ? `${record.photos.length} 张图` : "无图",
      record.location || "无地点",
      record.coord ? "有坐标" : null,
    ].filter(Boolean);
    logger.log(
      `   ${record.date}${record.time ? ` ${record.time}` : ""} · ${record.title || "(无标题)"} · ${bits.join(" · ")}`,
    );
  });

  logger.success(
    `已生成 ${records.length} 条记录 / ${scan.imageCount} 张图片 → ${outRel}（扫描 ${scan.scanned} 个目录，跳过 ${scan.skipped.length} 个）`,
  );

  if (previousCount !== null) {
    logger.info(
      previousCount === records.length
        ? `${outRel} 原有 ${previousCount} 条记录，已整份重写`
        : `${outRel} 已覆盖：${previousCount} 条 → ${records.length} 条`,
    );
  }
  logger.info("下一步：pnpm build:home（想先看结果不覆盖数据源，用 --out=<临时文件>）");
}

module.exports = { run, parseArgs, resolvePhotoPrefix, toRecord, byDateDesc };
