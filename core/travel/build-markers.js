const fs = require("fs");
const path = require("path");
const config = require("../common/lib/config");
const { WEB_DIR, PROJECT_ROOT, GENERATOR_DIR } = require("../common/lib/constants");
const { logger } = require("../common/lib/utils");
const { parseKml } = require("./lib/kml-parser");
const { loadKmlText } = require("./lib/kml-fetcher");

// 本地 KML 壳文件（内含 NetworkLink 远程地址），作为无配置时的兜底来源
const LOCAL_KML_PATH = path.join(GENERATOR_DIR, "我的足迹.kml");

/**
 * 构建旅行足迹 markers（M1：全站唯一实现，update:travel 与 build:site 共用）。
 *
 * 流程：加载 KML（URL 优先 / 本地壳跟进 NetworkLink）→ 成功则刷新本地快照 →
 * 失败回退快照 → 解析 → 写 web/<outputPath>（compact 单文件，前端唯一消费点）。
 *
 * @param {object} [options]
 * @param {string} [options.source] 强制指定 KML 来源（URL 或本地路径），覆盖 config.kmlUrl
 * @param {string} [options.outputPath] 产物相对 web/ 的路径，覆盖 config.site.travel.outputPath
 * @param {string} [options.snapshotPath] 快照相对仓库根的路径，覆盖 config.site.travel.snapshotPath
 * @returns {Promise<{markers: Array, outputPath: string, via: string} | null>} null 表示未能生成
 */
async function buildMarkers(options = {}) {
  const travelConfig = config.site.travel || {};
  const outRel = options.outputPath || travelConfig.outputPath;
  const snapshotRel =
    options.snapshotPath || travelConfig.snapshotPath || null;
  const snapshot = snapshotRel ? path.join(PROJECT_ROOT, snapshotRel) : null;
  const source = options.source || travelConfig.kmlUrl || LOCAL_KML_PATH;

  if (!outRel) {
    logger.warn("No site.travel.outputPath config found, skipping travel markers build.");
    return null;
  }

  // 1. 加载 KML：URL / 本地完整 KML / 本地壳跟进远程
  let kmlText = null;
  let via = "online";
  try {
    kmlText = await loadKmlText(source);
    logger.log("🌐 Loaded latest travel KML.");
  } catch (e) {
    logger.warn(
      `Failed to load KML from ${source} (${e.message}), falling back to local snapshot.`,
    );
  }

  // 2. 抓取成功则刷新本地快照，保持回退数据最新
  if (kmlText && snapshot) {
    try {
      fs.mkdirSync(path.dirname(snapshot), { recursive: true });
      fs.writeFileSync(snapshot, kmlText, "utf-8");
    } catch (e) {
      logger.warn(`Failed to refresh KML snapshot: ${e.message}`);
    }
  }

  // 3. 回退到本地快照
  if (!kmlText) {
    if (snapshot && fs.existsSync(snapshot)) {
      kmlText = fs.readFileSync(snapshot, "utf-8");
      via = "snapshot";
      logger.log("📦 Using local KML snapshot for travel markers.");
    } else {
      logger.warn("No online KML and no local snapshot. Travel markers not generated.");
      return null;
    }
  }

  // 4. 解析并输出 markers.json（compact，与前端 fetch 的唯一产物一致）
  const markers = parseKml(kmlText);
  if (markers.length === 0) {
    logger.warn("Parsed 0 travel markers from KML, output skipped.");
    return null;
  }

  const outputPath = path.join(WEB_DIR, outRel);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(markers), "utf-8");
  logger.success(
    `Travel markers: ${markers.length} points written to ${outRel} (source: ${via}).`,
  );
  return { markers, outputPath, via };
}

module.exports = { buildMarkers, LOCAL_KML_PATH };
