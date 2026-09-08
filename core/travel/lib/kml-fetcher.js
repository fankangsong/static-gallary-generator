const http = require("http");
const https = require("https");
const tls = require("tls");
const fs = require("fs");
const { extractNetworkLinkHref } = require("./kml-parser");

const FETCH_TIMEOUT_MS = 15000;

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

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
 * 在线抓取 KML 文本：代理优先，直连兜底；校验响应确为 KML
 */
async function fetchKmlText(url) {
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

/**
 * 加载 KML 文本：
 * - URL → 下载（含代理/超时/内容校验）
 * - 本地文件 → 若本身含 Placemark 则直接使用；否则按 NetworkLink 壳跟进其引用地址
 *
 * @param {string} source URL 或本地文件路径
 * @returns {Promise<string>} KML 文本
 */
async function loadKmlText(source) {
  if (/^https?:\/\//i.test(source)) return fetchKmlText(source);

  if (!fs.existsSync(source)) {
    throw new Error(`无效的 KML 来源（不是 URL 且文件不存在）: ${source}`);
  }

  const text = fs.readFileSync(source, "utf-8");
  if (/<Placemark[\s>]/i.test(text)) return text;

  const href = extractNetworkLinkHref(text);
  if (!href) {
    throw new Error(`KML 文件中既无 Placemark 也无 NetworkLink 地址: ${source}`);
  }
  return fetchKmlText(href);
}

module.exports = { fetchKmlText, loadKmlText };
