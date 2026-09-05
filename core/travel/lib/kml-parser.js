/**
 * 极简 KML 解析器：提取 Placemark 的名称、描述与坐标。
 * 仅用正则实现，避免引入 XML 解析依赖；足以应对 Google My Maps 导出的 KML 结构。
 */

function decodeEntities(str) {
  return String(str)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(str) {
  return decodeEntities(
    String(str)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function extractTag(block, tag) {
  const m = block.match(
    new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i")
  );
  return m ? m[1].trim() : "";
}

function parseCoordinates(text) {
  // 坐标格式: lng,lat[,alt]，多点时按空白分隔，取第一个点
  const first = String(text).trim().split(/\s+/)[0];
  if (!first) return null;
  const [lng, lat] = first.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * 解析 KML 文本，返回 [{ name, description, lat, lng }]
 * 跳过无坐标的 Placemark（如折线、多边形）
 */
function parseKml(kmlText) {
  const markers = [];
  const re = /<Placemark(?:\s[^>]*)?>([\s\S]*?)<\/Placemark>/gi;
  let m;
  while ((m = re.exec(kmlText))) {
    const block = m[1];
    const name = stripHtml(extractTag(block, "name"));
    const description = stripHtml(extractTag(block, "description"));
    const point = parseCoordinates(extractTag(block, "coordinates"));
    if (!point) continue;
    markers.push({ name, description, ...point });
  }
  return markers;
}

/** 提取 NetworkLink 中引用的远程 KML 地址（支持 CDATA） */
function extractNetworkLinkHref(kmlText) {
  const m = kmlText.match(
    /<href>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/href>/i
  );
  return m ? m[1].trim() : null;
}

module.exports = { parseKml, extractNetworkLinkHref };
