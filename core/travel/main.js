const fs = require("fs");
const path = require("path");
const { logger } = require("../common/lib/utils");
const { GENERATOR_DIR, ASSETS_DIR } = require("../common/lib/constants");
const { parseKml, extractNetworkLinkHref } = require("./lib/kml-parser");

// 本地 KML 壳文件（内含 NetworkLink 远程地址）
const LOCAL_KML_PATH = path.join(GENERATOR_DIR, "我的足迹.kml");
// 输出位置与 travel/index.html 中 fetch 的 /assets/travel/markers.json 对应
const OUTPUT_PATH = path.join(ASSETS_DIR, "travel", "markers.json");

async function fetchKml(url) {
  logger.log(`🌐 正在拉取远程 KML: ${url}`);
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "static-gallary-generator travel updater" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * 加载 KML 文本：
 * - URL → 直接下载
 * - 本地文件 → 若本身含 Placemark 则直接使用；否则按 NetworkLink 壳跟进其引用地址
 */
async function loadKmlText(source) {
  if (/^https?:\/\//i.test(source)) return fetchKml(source);

  if (!fs.existsSync(source)) {
    throw new Error(`无效的 KML 来源（不是 URL 且文件不存在）: ${source}`);
  }

  const text = fs.readFileSync(source, "utf-8");
  if (/<Placemark[\s>]/i.test(text)) return text;

  const href = extractNetworkLinkHref(text);
  if (!href) {
    throw new Error(`KML 文件中既无 Placemark 也无 NetworkLink 地址: ${source}`);
  }
  return fetchKml(href);
}

async function run(args = []) {
  // args[0] 为命令名（如 "update:travel"），可选的 KML 来源从 args[1] 取
  const source = args[1] || LOCAL_KML_PATH;
  logger.log(`🗺️  更新足迹数据（来源: ${source}）`);

  try {
    const kmlText = await loadKmlText(source);
    const markers = parseKml(kmlText);
    if (!markers.length) {
      throw new Error("KML 中未解析到任何带坐标的 Placemark");
    }

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(markers, null, 2) + "\n", "utf-8");

    logger.success(`足迹数据已更新: ${OUTPUT_PATH}（共 ${markers.length} 处）`);
  } catch (err) {
    logger.error(`更新足迹数据失败: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { run };
