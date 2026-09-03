const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const tls = require("tls");
const config = require("../../common/lib/config");
const { WEB_DIR, PROJECT_ROOT } = require("../../common/lib/constants");
const { logger } = require("../../common/lib/utils");

const FETCH_TIMEOUT_MS = 15000;

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

/**
 * 解码 XML 实体（含十进制/十六进制字符引用）
 */
function decodeXmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(parseInt(code, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * 提取块内指定标签的文本值，兼容 CDATA 包裹
 */
function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return "";
  let value = m[1].trim();
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) value = cdata[1];
  return decodeXmlEntities(value.trim());
}

/**
 * 解析 KML 字符串中的 Point 标记
 * 结构：<Placemark><name/><description/><Point><coordinates>lng,lat,alt</coordinates></Point></Placemark>
 */
function parseKml(kmlString) {
  const markers = [];
  const blocks = kmlString.match(/<Placemark>[\s\S]*?<\/Placemark>/gi) || [];

  for (const block of blocks) {
    const name = extractTag(block, "name");
    const description = extractTag(block, "description");
    const coordStr = extractTag(block, "coordinates");

    if (!coordStr) {
      logger.warn(`Placemark "${name || "(unnamed)"}" has no coordinates, skipped.`);
      continue;
    }

    // 坐标可能是多段（LineString），Point 类型取第一段 "lng,lat[,alt]"
    const firstTuple = coordStr.split(/\s+/)[0];
    const parts = firstTuple.split(",");
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      logger.warn(`Placemark "${name}" has invalid coordinates "${coordStr}", skipped.`);
      continue;
    }

    markers.push({ name, description, lat, lng });
  }

  return markers;
}

/**
 * 获取代理环境变量（Node 内置 fetch 不读取代理环境变量，需自行处理）
 */
function getProxyUrl() {
  const candidates = [
    process.env.HTTPS_PROXY,
    process.env.https_proxy,
    process.env.HTTP_PROXY,
    process.env.http_proxy,
  ];
  const found = candidates.find(Boolean);
  // 仅支持 http 协议代理（CONNECT 隧道）
  return found && /^http:\/\//i.test(found) ? found : null;
}

/**
 * 通过代理 CONNECT 隧道请求 HTTPS 资源（零依赖实现）
 */
function httpsGetViaProxy(url, proxyUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const proxy = new URL(proxyUrl);

    const connectReq = http.request({
      host: proxy.hostname,
      port: Number(proxy.port) || 80,
      method: "CONNECT",
      path: `${target.hostname}:443`,
      timeout: timeoutMs,
    });

    connectReq.on("timeout", () =>
      connectReq.destroy(new Error("Proxy CONNECT timeout")),
    );
    connectReq.on("error", reject);
    connectReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        socket.destroy();
        return reject(new Error(`Proxy CONNECT failed: HTTP ${res.statusCode}`));
      }

      const req = https.request(
        {
          createConnection: () =>
            tls.connect({ socket: socket, servername: target.hostname }),
          host: target.hostname,
          path: target.pathname + target.search,
          headers: REQUEST_HEADERS,
          timeout: timeoutMs,
        },
        resolve,
      );
      req.on("timeout", () => req.destroy(new Error("HTTPS request timeout")));
      req.on("error", (e) => {
        socket.destroy();
        reject(e);
      });
      req.end();
    });
    connectReq.end();
  });
}

/**
 * 读取响应体为文本
 */
function readBody(res) {
  return new Promise((resolve, reject) => {
    let data = "";
    res.setEncoding("utf-8");
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => resolve(data));
    res.on("error", reject);
  });
}

/**
 * 在线抓取 KML，失败返回 null（抛出异常）
 */
async function fetchKml(url) {
  const proxyUrl = getProxyUrl();
  let text;

  if (proxyUrl) {
    // 走本地代理（CONNECT 隧道）
    const res = await httpsGetViaProxy(url, proxyUrl, FETCH_TIMEOUT_MS);
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    text = await readBody(res);
  } else {
    // 直连
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: REQUEST_HEADERS,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  if (!/<kml/i.test(text)) throw new Error("Response is not valid KML");
  return text;
}

async function run() {
  const travelConfig = config.site.travel;
  if (!travelConfig || !travelConfig.kmlUrl) {
    logger.warn("No site.travel config found, skipping travel markers build.");
    return;
  }

  const snapshotAbsPath = path.join(PROJECT_ROOT, travelConfig.snapshotPath);

  // 1. 优先在线抓取最新数据
  let kmlString = null;
  let source = "online";
  try {
    kmlString = await fetchKml(travelConfig.kmlUrl);
    logger.log("🌐 Fetched latest travel KML from Google My Maps.");
  } catch (e) {
    logger.warn(`Failed to fetch KML online (${e.message}), falling back to local snapshot.`);
  }

  if (kmlString) {
    // 2. 抓取成功则刷新本地快照，保持回退数据最新
    try {
      fs.writeFileSync(snapshotAbsPath, kmlString, "utf-8");
    } catch (e) {
      logger.warn(`Failed to refresh KML snapshot: ${e.message}`);
    }
  } else if (fs.existsSync(snapshotAbsPath)) {
    // 3. 回退到本地快照
    kmlString = fs.readFileSync(snapshotAbsPath, "utf-8");
    source = "snapshot";
    logger.log("📦 Using local KML snapshot for travel markers.");
  } else {
    logger.warn("No online KML and no local snapshot. Travel markers not generated.");
    return;
  }

  // 4. 解析并输出 markers.json
  const markers = parseKml(kmlString);
  if (markers.length === 0) {
    logger.warn("Parsed 0 travel markers from KML, output skipped.");
    return;
  }

  const outputPath = path.join(WEB_DIR, travelConfig.outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(markers), "utf-8");
  logger.success(
    `Travel markers: ${markers.length} points written to ${travelConfig.outputPath} (source: ${source}).`,
  );
}

module.exports = { run, parseKml };
