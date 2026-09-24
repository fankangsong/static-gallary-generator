const { logger } = require("../../common/lib/utils");

/**
 * content.md → 结构化字段（纯函数、无 IO，便于单测）。
 *
 * 约定：
 *
 *   # 晨跑之后的湖面            ← 首个一/二级 ATX 标题即 title（可有可无）
 *
 *   正文第一段……                ← 其余内容即 text（空行原样保留，首页按空行分段渲染）
 *
 *   位置信息：                   ← 位置区块标题：位置信息 / 位置 / 地点，可带 # 与中英文冒号
 *
 *   ```
 *   113.123456,22.123456       ← 代码块第一行：坐标「经度,纬度」（全角逗号亦可）
 *   广东省深圳市盐田区大梅沙      ← 其余非空行用空格拼成 location
 *   ```
 *
 * 容错：
 *   - 代码块第一行不是两个数 → 整块都当地址，coord 缺省
 *   - 只能判定为「纬度,经度」写反（第一个数绝对值 > 90）→ 自动交换并告警
 *   - 两个数都在 ±90 内、无法判定 → 按原序存，并告警提示核对
 *   - 没有位置区块 → location / coord 缺省（合法：首页容忍只有日期与正文的记录）
 *   - 围栏未闭合 → 位置区块吃到文末
 */

const LOCATION_HEADING = /^#{0,6}\s*(位置信息|位置|地点)\s*[:：]?\s*$/;
const TITLE_LINE = /^#{1,2}\s+(.+?)\s*#*\s*$/;
const FENCE_LINE = /^\s*([`~]{3,})/;

function normalizeText(raw) {
  return String(raw || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");
}

/**
 * 解析一行坐标文本（"经度,纬度"）。
 * @returns {{coord: [number, number]|null, swapped: boolean, ambiguous: boolean}}
 */
function parseCoordLine(line) {
  const parts = String(line)
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
  if (parts.length !== 2) return { coord: null, swapped: false, ambiguous: false };

  const nums = parts.map((s) => Number(s));
  if (!nums.every((n) => Number.isFinite(n))) return { coord: null, swapped: false, ambiguous: false };

  const [a, b] = nums;
  if (Math.abs(a) > 90 && Math.abs(b) <= 90) return { coord: [a, b], swapped: false, ambiguous: false };
  if (Math.abs(b) > 90 && Math.abs(a) <= 90) return { coord: [b, a], swapped: true, ambiguous: false };
  return { coord: [a, b], swapped: false, ambiguous: true };
}

/**
 * @param {string} raw   content.md 原文
 * @param {{context?: string}} [options] context 只用于日志（如日期目录名）
 * @returns {{title: string, text: string, location: string, coord: [number, number]|null}}
 */
function parseContent(raw, options = {}) {
  const context = options.context ? `${options.context}: ` : "";
  const lines = normalizeText(raw).split("\n");

  // 1. 定位位置区块：第一个「标题行 + 紧随其后的围栏代码块」
  let headingIdx = -1;
  let fenceStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!LOCATION_HEADING.test(lines[i].trim())) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j < lines.length && FENCE_LINE.test(lines[j])) {
      headingIdx = i;
      fenceStart = j;
      break;
    }
  }

  let fenceEnd = -1;
  if (fenceStart >= 0) {
    const mark = FENCE_LINE.exec(lines[fenceStart])[1][0];
    const closer = new RegExp(`^\\s*${mark === "`" ? "`" : "~"}{3,}\\s*$`);
    for (let k = fenceStart + 1; k < lines.length; k++) {
      if (closer.test(lines[k])) {
        fenceEnd = k;
        break;
      }
    }
    if (fenceEnd < 0) {
      fenceEnd = lines.length - 1;
      logger.warn(`${context}位置区块的代码围栏未闭合，按到文末处理`);
    }
  }

  let location = "";
  let coord = null;
  if (fenceStart >= 0) {
    const blockLines = [];
    for (let k = fenceStart + 1; k < (fenceEnd < 0 ? lines.length : fenceEnd); k++) {
      const text = lines[k].trim();
      if (text) blockLines.push(text);
    }

    if (blockLines.length) {
      const parsed = parseCoordLine(blockLines[0]);
      if (parsed.coord) {
        coord = parsed.coord;
        location = blockLines.slice(1).join(" ");
        if (parsed.swapped) {
          logger.warn(`${context}坐标疑似写成「纬度,经度」，已自动交换为 [${coord[0]}, ${coord[1]}]`);
        } else if (parsed.ambiguous) {
          logger.warn(`${context}坐标 ${blockLines[0]} 两数都在 ±90 内，无法判断经纬度，按原序存入`);
        }
        if (!location) logger.warn(`${context}位置区块只有坐标、没有地址文本`);
      } else {
        location = blockLines.join(" ");
      }
    } else {
      logger.warn(`${context}位置区块是空的`);
    }
  }

  // 2. 标题：位置区块之外的首个一/二级标题
  let titleIdx = -1;
  let title = "";
  for (let i = 0; i < lines.length; i++) {
    if (headingIdx >= 0 && i >= headingIdx && i <= fenceEnd) continue;
    const m = lines[i].match(TITLE_LINE);
    if (m) {
      title = m[1].trim();
      titleIdx = i;
      break;
    }
  }

  // 3. 正文：去掉标题行与整个位置区块（标题行 + 围栏 + 内容）后的剩余内容
  const dropped = new Set();
  if (titleIdx >= 0) dropped.add(titleIdx);
  if (headingIdx >= 0) {
    for (let i = headingIdx; i <= fenceEnd; i++) dropped.add(i);
  }
  const text = lines
    .filter((_, i) => !dropped.has(i))
    .join("\n")
    .replace(/^\s*\n+/, "")
    .replace(/\n+\s*$/, "");
  // 行尾空白（markdown 的强制换行）在纯文本渲染里没有意义，一并收掉
  const cleaned = text
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n");

  return { title, text: cleaned, location, coord };
}

module.exports = { parseContent, parseCoordLine, LOCATION_HEADING, TITLE_LINE };
