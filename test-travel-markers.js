// M1 优化测试：KML 解析/抓取合并后（core/travel/build-markers.js）的行为验证
// 运行：node test-travel-markers.js
// 全部离线执行（不访问外网）；以 data-source/travel.kml 真实快照为 fixture。
// 全部断言通过则退出码 0，任一失败抛出异常退出码非 0。
const path = require("path");
const fs = require("fs");
const assert = require("assert");

const { WEB_DIR, PROJECT_ROOT } = require("./core/common/lib/constants");
const { parseKml } = require("./core/travel/lib/kml-parser");
const { buildMarkers } = require("./core/travel/build-markers");

// 真实快照（170KB）作为离线 fixture
const SNAPSHOT = path.join(PROJECT_ROOT, "data-source", "travel.kml");
assert.ok(fs.existsSync(SNAPSHOT), `fixture 缺失: ${SNAPSHOT}`);
const snapshotText = fs.readFileSync(SNAPSHOT, "utf-8");

// ------------------------------------------------------------------
// 1. 解析器单元：真实快照
// ------------------------------------------------------------------
const markers = parseKml(snapshotText);
assert.ok(markers.length > 0, `真实快照应解析出 >0 个 marker，实际 ${markers.length}`);
for (const m of markers) {
  assert.ok(typeof m.name === "string", "name 应为字符串");
  assert.ok(Number.isFinite(m.lat) && Number.isFinite(m.lng), "lat/lng 应为有限数字");
  // 合并实现保留 stripHtml：description 不得残留 HTML 标签
  assert.ok(!/[<>]/.test(m.description || ""), `description 应为纯文本: ${m.description}`);
}
console.log(`✅ 真实快照解析: ${markers.length} 个 marker，字段齐全且 description 为纯文本`);

// ------------------------------------------------------------------
// 2. 解析器单元：合成 KML 的行为兼容性
// ------------------------------------------------------------------
const syntheticKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark id="pm-1">
      <name>属性<![CDATA[与实体]]>&amp;emoji&#x1F600;&#65;</name>
      <description><![CDATA[<a href="https://example.com">链接</a>&nbsp;第二行]]></description>
      <Point><coordinates>120.1,30.2,0</coordinates></Point>
    </Placemark>
    <Placemark>
      <name>无坐标</name>
      <LineString><coordinates>120,30 121,31</coordinates></LineString>
    </Placemark>
  </Document>
</kml>`;
const [pm] = parseKml(syntheticKml);
assert.ok(pm, "合成 KML 应解析出 1 个 marker");
assert.strictEqual(pm.lat, 30.2);
assert.strictEqual(pm.lng, 120.1);
// fromCodePoint：&#x1F600;（emoji）必须完整解码，fromCharCode 会截断为单 surrogate
assert.ok(pm.name.includes("😀"), `增补平面字符应完整解码: ${JSON.stringify(pm.name)}`);
assert.ok(pm.name.includes("A"), "十进制字符引用应解码");
assert.ok(pm.name.includes("属性与实体&"), `CDATA 与实体应解码: ${JSON.stringify(pm.name)}`);
// stripHtml + &nbsp;
assert.strictEqual(pm.description, "链接 第二行");
console.log("✅ 合成 KML: 带属性 Placemark / CDATA / 实体 / emoji / stripHtml 全部正确");

async function main() {
  // ----------------------------------------------------------------
  // 3. buildMarkers 集成：本地 KML → 写 compact 产物（输出到临时路径，不碰真实产物）
  // ----------------------------------------------------------------
  const TEST_OUT = ".travel-test/markers.json";
  const TEST_SNAPSHOT = path.join(WEB_DIR, ".travel-test", "snapshot.kml");
  fs.mkdirSync(path.join(WEB_DIR, ".travel-test"), { recursive: true });

  const result1 = await buildMarkers({
    source: SNAPSHOT,
    outputPath: TEST_OUT,
    snapshotPath: path.relative(PROJECT_ROOT, TEST_SNAPSHOT),
  });
  assert.ok(result1, "本地完整 KML 应构建成功");
  const outAbs = path.join(WEB_DIR, TEST_OUT);
  assert.ok(fs.existsSync(outAbs), "产物应已写出");
  const raw = fs.readFileSync(outAbs, "utf-8");
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed) && parsed.length === markers.length, "产物应与解析结果一致");
  // compact：不允许 pretty-print（换行 + 缩进）
  assert.ok(!raw.includes("\n"), "产物必须为 compact 单行 JSON（旧 update:travel 是 pretty）");
  assert.ok(fs.existsSync(TEST_SNAPSHOT), "成功加载后应刷新快照");
  console.log(`✅ buildMarkers(本地 KML): ${parsed.length} 点，compact 单行，快照已刷新`);

  // ----------------------------------------------------------------
  // 4. buildMarkers 集成：来源失效 → 快照回退
  // ----------------------------------------------------------------
  const result2 = await buildMarkers({
    source: path.join(PROJECT_ROOT, "data-source", "__no_such__.kml"),
    outputPath: TEST_OUT,
    snapshotPath: path.relative(PROJECT_ROOT, TEST_SNAPSHOT),
  });
  assert.ok(result2, "来源失效时应回退快照成功");
  assert.strictEqual(result2.via, "snapshot");
  console.log("✅ buildMarkers(来源失效): 回退快照成功（via=snapshot）");

  // ----------------------------------------------------------------
  // 5. buildMarkers 集成：来源与快照双失败 → 返回 null
  // ----------------------------------------------------------------
  const result3 = await buildMarkers({
    source: path.join(PROJECT_ROOT, "data-source", "__no_such__.kml"),
    outputPath: TEST_OUT,
    snapshotPath: "data-source/__no_such_snapshot__.kml",
  });
  assert.strictEqual(result3, null, "无任何数据源时应返回 null 而非抛错");
  console.log("✅ buildMarkers(双失败): 返回 null，退出码由调用方决定");

  // ----------------------------------------------------------------
  // 6. 文件布局：旧的双写路径必须消失
  // ----------------------------------------------------------------
  assert.ok(
    !fs.existsSync(path.join(PROJECT_ROOT, "templates", "assets", "travel", "markers.json")),
    "templates/assets/travel/markers.json（旧死产物）应已删除",
  );
  assert.ok(
    fs.existsSync(path.join(WEB_DIR, "assets", "travel", "markers.json")),
    "web/assets/travel/markers.json（唯一产物）应存在",
  );
  const liveRaw = fs.readFileSync(
    path.join(WEB_DIR, "assets", "travel", "markers.json"),
    "utf-8",
  );
  assert.ok(!liveRaw.includes("\n"), "唯一产物必须为 compact");
  console.log("✅ 文件布局: 旧 templates/assets/travel 死路径已删除，web/ 单产物 compact");

  // ----------------------------------------------------------------
  // 清理临时输出
  // ----------------------------------------------------------------
  fs.rmSync(path.join(WEB_DIR, ".travel-test"), { recursive: true, force: true });

  console.log("\n🎉 test-travel-markers.js 全部通过");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
