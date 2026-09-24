const fs = require("fs");
const path = require("path");
const config = require("../../common/lib/config");
const { logger } = require("../../common/lib/utils");
const { parseContent } = require("./content-parser");

/**
 * 扫描时间轴源目录：一个「日期目录」= 一条记录。
 *
 *   <sourceDir>/2026-09-21 0730/      目录名 = YYYY-MM-DD[ 时间]，时间可写 0730 / 07:30
 *   ├── content.md                    正文 + 位置区块（见 content-parser.js）
 *   ├── p1.jpg                        图片按文件名自然序（p1 < p2 < p10）
 *   └── p2.jpg
 *
 * 只做目录遍历与小文件读取，不解码图片；单条目录的任何问题只影响该条，
 * 不匹配的目录计入 skipped 并汇总告警，不中断整轮。
 */

const DIR_NAME = /^(\d{4})-(\d{2})-(\d{2})(?:[ T_-]?(\d{2}):?(\d{2})?)?$/;
const DEFAULT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function supportedExtensions(options = {}) {
  if (Array.isArray(options.extensions) && options.extensions.length) return options.extensions;
  const fromConfig = config.timeline && config.timeline.supportedExtensions;
  return Array.isArray(fromConfig) && fromConfig.length ? fromConfig : DEFAULT_EXTENSIONS;
}

/**
 * 目录名 → { date: "YYYY-MM-DD", time: "HH:mm" | "" }；不合法返回 null。
 */
function parseDirName(name) {
  const m = DIR_NAME.exec(String(name || "").trim());
  if (!m) return null;

  const [, year, month, day, hour, minute] = m;
  const date = `${year}-${month}-${day}`;
  const probe = new Date(`${date}T00:00:00`);
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getMonth() + 1 !== Number(month) ||
    probe.getDate() !== Number(day)
  ) {
    return null;
  }

  if (hour === undefined) return { date, time: "" };
  const hh = Number(hour);
  const mm = minute === undefined ? 0 : Number(minute);
  if (hh > 23 || mm > 59) return null;
  return { date, time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
}

function naturalSort(names) {
  return names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function pickContentFile(files, dirName) {
  const mds = files.filter((f) => path.extname(f).toLowerCase() === ".md");
  if (!mds.length) return null;
  if (mds.includes("content.md")) {
    if (mds.length > 1) {
      logger.warn(`${dirName}: 有多个 md，已取 content.md（其余忽略：${mds.filter((f) => f !== "content.md").join(", ")}）`);
    }
    return "content.md";
  }
  const picked = naturalSort(mds)[0];
  logger.warn(`${dirName}: 没有 content.md，已改用 ${picked}`);
  return picked;
}

/**
 * @param {string} sourceDir 绝对路径
 * @param {{extensions?: string[]}} [options]
 * @returns {{records: Array<object>, scanned: number, imageCount: number, skipped: Array<{name: string, reason: string}>}}
 */
function scanSource(sourceDir, options = {}) {
  const extensions = supportedExtensions(options);
  const result = { records: [], scanned: 0, imageCount: 0, skipped: [] };

  if (!fs.existsSync(sourceDir)) {
    logger.error(`Timeline source directory not found: ${sourceDir}`);
    result.error = "SOURCE_NOT_FOUND";
    return result;
  }

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith(".")) continue;

    if (!entry.isDirectory()) {
      result.skipped.push({ name, reason: "不是目录" });
      continue;
    }

    const parsedName = parseDirName(name);
    if (!parsedName) {
      result.skipped.push({ name, reason: "目录名不是 YYYY-MM-DD[ 时间] 形式" });
      continue;
    }

    const dirPath = path.join(sourceDir, name);
    const files = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name);

    const images = naturalSort(
      files.filter((f) => extensions.includes(path.extname(f).toLowerCase())),
    );

    const contentFile = pickContentFile(files, name);
    let fields = { title: "", text: "", location: "", coord: null };
    if (contentFile) {
      fields = parseContent(fs.readFileSync(path.join(dirPath, contentFile), "utf-8"), {
        context: name,
      });
    } else {
      logger.warn(`${name}: 没有 md 文件，该条记录只有日期${images.length ? "与照片" : ""}`);
    }

    if (!images.length) logger.warn(`${name}: 没有图片`);

    result.scanned += 1;
    result.imageCount += images.length;
    result.records.push({
      date: parsedName.date,
      time: parsedName.time,
      dirName: name,
      images,
      ...fields,
    });
  }

  return result;
}

module.exports = { scanSource, parseDirName, supportedExtensions, DEFAULT_EXTENSIONS, DIR_NAME };
