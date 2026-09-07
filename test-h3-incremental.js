// H3 优化测试：data.json 增量恢复 + EXIF mtime 缓存 + meta.json 合并 + --force
// 运行：node test-h3-incremental.js
// 可选环境变量 H3_TEST_DIR：指定临时目录根（默认 os.tmpdir()/h3-test-<ts>）
// 全部断言通过则退出码 0，任一失败抛出异常退出码非 0
const os = require("os");
const path = require("path");
const fs = require("fs");
const assert = require("assert");

// 1. 先 patch 常量与配置，再 require 被测模块
//    （DATA_JSON_PATH / EXIF_CACHE_PATH 在模块加载时用 TEMP_DIR 计算，必须先改）
const constants = require("./core/common/lib/constants");
const TEST_ROOT =
  process.env.H3_TEST_DIR || path.join(os.tmpdir(), `h3-test-${Date.now()}`);
constants.TEMP_DIR = path.join(TEST_ROOT, "temp");

const config = require("./core/common/lib/config");
const dataManager = require("./core/gallery/lib/data-manager");
const { logger } = require("./core/common/lib/utils");

// 2. 准备 fixture
const PHOTOS_DIR = path.join(TEST_ROOT, "photos");
const ALBUM_A = path.join(PHOTOS_DIR, "AlbumA");
const ALBUM_B = path.join(PHOTOS_DIR, "AlbumB");
const DATA_JSON = path.join(constants.TEMP_DIR, "data.json");
const EXIF_CACHE = path.join(constants.TEMP_DIR, "exif-cache.json");

fs.mkdirSync(ALBUM_A, { recursive: true });
fs.mkdirSync(ALBUM_B, { recursive: true });
fs.writeFileSync(path.join(ALBUM_A, "img1.jpg"), "");
fs.writeFileSync(path.join(ALBUM_A, "img2.jpg"), "");
fs.writeFileSync(path.join(ALBUM_B, "img3.jpg"), "");
fs.writeFileSync(
  path.join(ALBUM_A, "meta.json"),
  JSON.stringify({
    title: "Meta A Title",
    author: "Meta Author",
    description: ["line1", "line2"],
    template: "custom-tpl",
  })
);

config.gallery.absolutePhotosDir = PHOTOS_DIR;
config.gallery.supportedExtensions = [".jpg"];
config.gallery.template = "magazine";
config.defaultAuthor = "Test Author";

// 3. 拦截 logger.warn 统计真实 EXIF 读取尝试次数。
//    fixture 是空文件，ExifReader.load 每次必然抛错并触发一次
//    "Failed to read EXIF" 警告；缓存命中则不触发。
//    （不直接 patch ExifReader.load：其导出属性 getter-only 不可覆写）
let exifReadCount = 0;
const origWarn = logger.warn;
logger.warn = (...args) => {
  if (String(args[0]).includes("Failed to read EXIF")) exifReadCount++;
  origWarn(...args);
};

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));
const findAlbum = (albums, dirName) =>
  albums.find((a) => a.dirName === dirName);

async function main() {
  // ---- 用例 1：首扫 + meta.json 合并优先级 ----
  let albums = await dataManager.scanAlbums();
  assert.strictEqual(albums.length, 2, "应扫描到 2 个相册");
  const a = findAlbum(albums, "AlbumA");
  const b = findAlbum(albums, "AlbumB");
  assert.strictEqual(a.title, "Meta A Title", "meta.json title 应覆盖");
  assert.strictEqual(a.author, "Meta Author", "meta.json author 应覆盖");
  assert.ok(Array.isArray(a.description), "description 数组应原样保留");
  assert.deepStrictEqual(a.description, ["line1", "line2"]);
  assert.strictEqual(a.template, "custom-tpl", "meta.json template 应覆盖");
  assert.ok(a.cover && a.cover.includes("large_img1"), "meta 未提供的 cover 应自动推导");
  assert.strictEqual(a.id, "AlbumA", "meta 未提供 id 时用目录名");
  assert.strictEqual(b.title, "AlbumB", "无 meta.json 的相册用目录名");
  assert.strictEqual(b.author, "Test Author", "无 meta.json 时用 defaultAuthor");

  dataManager.saveGlobalData();
  assert.ok(fs.existsSync(DATA_JSON), "data.json 应写入 patched TEMP_DIR");
  assert.ok(fs.existsSync(EXIF_CACHE), "exif-cache.json 应写入 patched TEMP_DIR");
  assert.strictEqual(exifReadCount, 3, "首扫应读取 3 个文件的 EXIF");
  console.log("case 1 passed: meta.json merge + first scan");

  // ---- 用例 2：二次扫描缓存命中 ----
  await dataManager.scanAlbums();
  assert.strictEqual(exifReadCount, 3, "二次扫描应命中缓存，不再读 EXIF");
  console.log("case 2 passed: EXIF cache hit");

  // ---- 用例 3：mtime 失效重读 ----
  const img1 = path.join(ALBUM_A, "img1.jpg");
  const future = new Date(Date.now() + 10_000);
  fs.utimesSync(img1, future, future);
  await dataManager.scanAlbums();
  assert.strictEqual(exifReadCount, 4, "mtime 变化后应重读该文件");
  console.log("case 3 passed: mtime invalidation");

  // ---- 用例 4：增量加载（无 force）保留 data.json 手工修改 ----
  let data = readJson(DATA_JSON);
  findAlbum(data, "AlbumB").description = "Manual B description";
  fs.writeFileSync(DATA_JSON, JSON.stringify(data));
  albums = await dataManager.scanAlbums();
  assert.strictEqual(
    findAlbum(albums, "AlbumB").description,
    "Manual B description",
    "data.json 手工 description 应保留"
  );
  console.log("case 4 passed: incremental load keeps manual edits");

  // ---- 用例 5：--force 绕过 data.json 与缓存 ----
  albums = await dataManager.scanAlbums(true);
  assert.notStrictEqual(
    findAlbum(albums, "AlbumB").description,
    "Manual B description",
    "force 时 data.json 手工修改不应回流"
  );
  assert.strictEqual(exifReadCount, 7, "force 时应全量重读 EXIF（3+1+3）");
  console.log("case 5 passed: --force bypass");

  // ---- 用例 6：三种 JSON 损坏容错 ----
  fs.writeFileSync(DATA_JSON, "not json {{{");
  fs.writeFileSync(EXIF_CACHE, "broken ]]=");
  fs.writeFileSync(path.join(ALBUM_A, "meta.json"), "{ invalid");
  albums = await dataManager.scanAlbums(); // 不应抛异常
  const a2 = findAlbum(albums, "AlbumA");
  assert.strictEqual(a2.title, "AlbumA", "meta.json 损坏后回落目录名");
  assert.strictEqual(a2.author, "Test Author", "data.json 损坏后回落 defaultAuthor");
  console.log("case 6 passed: corrupted JSON tolerance");

  // ---- 用例 7：相册删除后旧条目清理 ----
  // 恢复 AlbumA 的 meta.json（用例 6 已损坏），删除 AlbumB
  fs.writeFileSync(
    path.join(ALBUM_A, "meta.json"),
    JSON.stringify({ title: "Meta A Title" })
  );
  fs.rmSync(ALBUM_B, { recursive: true, force: true });
  albums = await dataManager.scanAlbums();
  assert.strictEqual(albums.length, 1, "删除相册后应只剩 1 个");
  dataManager.saveGlobalData();
  data = readJson(DATA_JSON);
  assert.strictEqual(data.length, 1, "data.json 不应再含已删除相册");
  const cache = readJson(EXIF_CACHE);
  assert.ok(
    !Object.keys(cache.entries).some((k) => k.startsWith("AlbumB")),
    "exif-cache 应剪枝已删除相册的条目"
  );
  assert.ok(
    Object.keys(cache.entries).some((k) => k.startsWith("AlbumA")),
    "exif-cache 应保留现存相册条目"
  );
  console.log("case 7 passed: deleted album pruning");

  console.log("ALL H3 TESTS PASSED");
}

main()
  .then(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    process.exit(0);
  })
  .catch((e) => {
    console.error("TEST FAILED:", e.message);
    console.error(e.stack);
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    process.exit(1);
  });
