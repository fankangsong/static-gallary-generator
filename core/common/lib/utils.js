const fs = require("fs");
const path = require("path");
const pinyin = require("pinyin").default;

const logger = {
  info: (...args) => console.log("ℹ️ ", ...args),
  success: (...args) => console.log("✅", ...args),
  warn: (...args) => console.warn("⚠️ ", ...args),
  error: (...args) => console.error("❌", ...args),
  log: (...args) => console.log(...args),
};

function normalizePath(p) {
  // Fix Windows drive letter issues if needed, similar to original code
  let normalized = p.replace(/^([a-zA-Z]):(?![\\/])/, "$1:/");
  return normalized.replace(/\\/g, "/");
}

/**
 * 目录名 → URL 安全的 ASCII slug（与 gallery data-manager 的 pinyin 惯例一致）。
 * 中文转小写拼音连字符；非单词字符转连字符；空结果回退为 "book"。
 */
function slugifyDirName(dirName) {
  let slug = String(dirName);
  if (/[\u4e00-\u9fa5]/.test(slug)) {
    try {
      slug = pinyin(slug, { style: pinyin.STYLE_NORMAL, segment: true })
        .flat()
        .join("-")
        .toLowerCase();
    } catch (e) {
      logger.warn(`Failed to pinyin for "${dirName}", keep original.`, e.message);
    }
  }
  slug = slug
    .trim()
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return slug || "book";
}

/**
 * 判断产物是否需要重新生成（H4：修复只看 existsSync 造成的脏缓存）
 *
 * 判定规则（任一命中即重新生成）：
 * - 产物不存在
 * - 任一 stat 失败（保守起见重新生成）
 * - 源图 mtime 新于产物 mtime
 *
 * 已知限制：修改 config 的 quality / 尺寸不会触发重生成，需手工清理产物。
 *
 * @param {string} srcPath 源文件
 * @param {string} destPath 产物文件
 * @returns {boolean}
 */
function needsRegeneration(srcPath, destPath) {
  let srcStat;
  let destStat;
  try {
    srcStat = fs.statSync(srcPath);
  } catch (e) {
    return true;
  }
  try {
    destStat = fs.statSync(destPath);
  } catch (e) {
    return true;
  }
  return srcStat.mtimeMs > destStat.mtimeMs;
}

function getDescription(deviceStr, dateStr) {
  let desc = "";
  if (deviceStr && dateStr) {
    desc = `📷 ${deviceStr} 📆 ${dateStr}`;
  } else if (deviceStr) {
    desc = `📷 ${deviceStr}`;
  } else if (dateStr) {
    desc = `📷 ${dateStr}`;
  }
  return desc;
}

module.exports = {
  logger,
  normalizePath,
  getDescription,
  slugifyDirName,
  needsRegeneration,
};
