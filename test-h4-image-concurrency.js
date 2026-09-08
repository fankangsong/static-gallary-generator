// H4 优化测试：图片处理并行化 + 冗余 Sharp 调用合并 + mtime 脏缓存修复
// 运行：node test-h4-image-concurrency.js
// 断言任一失败即抛错，退出码非 0；所有产物写入系统临时目录，不污染 web/（L1）
const os = require("os");
const path = require("path");
const fs = require("fs");
const assert = require("assert");

const config = require("./core/common/lib/config");
const { needsRegeneration } = require("./core/common/lib/utils");
const { mapWithConcurrency } = require("./core/common/lib/concurrency");
const galleryProcessor = require("./core/gallery/lib/image-processor");
const picturesProcessor = require("./core/pictures/lib/image-processor");
const sharp = require("sharp");

const TEST_ROOT =
  process.env.H4_TEST_DIR || path.join(os.tmpdir(), `h4-test-${Date.now()}`);
const PHOTOS_DIR = path.join(TEST_ROOT, "photos");
const ALBUM_DIR = path.join(PHOTOS_DIR, "AlbumA");
const SUB_DIR = path.join(ALBUM_DIR, "sub");
const OUT_DIR = path.join(TEST_ROOT, "out");

let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (e) {
    console.error(`❌ ${name}\n   ${e.message}`);
    throw e;
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (e) {
    console.error(`❌ ${name}\n   ${e.message}`);
    throw e;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function makeImage(file, width, height) {
  await sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 90, b: 40 } },
  })
    .jpeg()
    .toFile(file);
}

function futureDate(seconds) {
  return new Date(Date.now() + seconds * 1000);
}

(async () => {
  fs.mkdirSync(SUB_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await makeImage(path.join(ALBUM_DIR, "1.jpg"), 120, 80);
  await makeImage(path.join(ALBUM_DIR, "2.jpg"), 120, 80);
  await makeImage(path.join(SUB_DIR, "sub.jpg"), 120, 80);

  // ---------- mapWithConcurrency ----------
  await checkAsync("mapWithConcurrency 结果顺序与输入一致", async () => {
    const delays = { 5: 60, 1: 20, 3: 40 };
    const out = await mapWithConcurrency([5, 1, 3], 4, async (n) => {
      await sleep(delays[n]);
      return n * 2;
    });
    assert.deepStrictEqual(out, [10, 2, 6]);
  });

  await checkAsync("mapWithConcurrency 并发数不超过 limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const out = await mapWithConcurrency(
      Array.from({ length: 6 }, (_, i) => i),
      2,
      async (n) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await sleep(30);
        inFlight -= 1;
        return n;
      },
    );
    assert.deepStrictEqual(out, [0, 1, 2, 3, 4, 5]);
    assert.ok(maxInFlight <= 2, `实际最大并发 ${maxInFlight} 超过 limit 2`);
    assert.ok(maxInFlight >= 2, `实际最大并发 ${maxInFlight}，未体现并发`);
  });

  await checkAsync("mapWithConcurrency 非法 limit 回落为串行且结果正确", async () => {
    for (const bad of [0, -1, null, undefined, "x", 1.5]) {
      const out = await mapWithConcurrency([1, 2, 3], bad, async (n) => n + 1);
      assert.deepStrictEqual(out, [2, 3, 4], `limit=${bad} 时结果不正确`);
    }
  });

  await checkAsync("mapWithConcurrency 空数组返回空结果", async () => {
    assert.deepStrictEqual(await mapWithConcurrency([], 4, async (n) => n), []);
  });

  // ---------- needsRegeneration ----------
  await checkAsync("needsRegeneration：产物缺失 → true", async () => {
    const src = path.join(TEST_ROOT, "src-missing.jpg");
    const dest = path.join(TEST_ROOT, "dest-missing.jpg");
    await makeImage(src, 20, 20);
    assert.strictEqual(needsRegeneration(src, dest), true);
  });

  await checkAsync("needsRegeneration：产物比源图新 → false", async () => {
    const src = path.join(TEST_ROOT, "src-old.jpg");
    const dest = path.join(TEST_ROOT, "dest-new.jpg");
    await makeImage(src, 20, 20);
    fs.utimesSync(src, new Date(Date.now() - 10000), new Date(Date.now() - 10000));
    await makeImage(dest, 20, 20);
    fs.utimesSync(dest, futureDate(5), futureDate(5));
    assert.strictEqual(needsRegeneration(src, dest), false);
  });

  await checkAsync("needsRegeneration：源图比产物新 → true（脏缓存修复）", async () => {
    const src = path.join(TEST_ROOT, "src-new.jpg");
    const dest = path.join(TEST_ROOT, "dest-old.jpg");
    await makeImage(src, 20, 20);
    await makeImage(dest, 20, 20);
    fs.utimesSync(dest, new Date(Date.now() - 20000), new Date(Date.now() - 20000));
    fs.utimesSync(src, futureDate(5), futureDate(5));
    assert.strictEqual(needsRegeneration(src, dest), true);
  });

  // ---------- gallery processImages 集成 ----------
  config.gallery.absolutePhotosDir = PHOTOS_DIR;
  config.gallery.supportedExtensions = [".jpg"];
  config.gallery.concurrency = 4;
  config.gallery.thumbnail = { width: 60, height: 60, quality: 80, fit: "inside" };
  config.gallery.large = { maxSize: 100, quality: 60, fit: "inside" };

  const album = {
    id: "album-a",
    title: "AlbumA",
    dirName: "AlbumA",
    author: "tester",
    groups: [
      { name: null, files: [{ filename: "1.jpg" }, { filename: "2.jpg" }] },
      { name: "sub", files: [{ filename: "sub.jpg" }] },
    ],
  };

  let groups;

  await checkAsync("processImages 并发处理后保留分组结构与图片顺序", async () => {
    groups = await galleryProcessor.processImages(album, OUT_DIR);
    assert.strictEqual(groups.length, 2, "分组数量不符");
    assert.strictEqual(groups[0].name, null);
    assert.strictEqual(groups[1].name, "sub");
    assert.deepStrictEqual(
      groups[0].images.map((i) => i.alt),
      ["1.jpg", "2.jpg"],
      "组内顺序被并发打乱",
    );
    assert.deepStrictEqual(groups[1].images.map((i) => i.alt), ["sub.jpg"]);
  });

  await checkAsync("产物文件存在且尺寸来自处理链（未读取输出文件）", async () => {
    for (const f of ["thumb_1.jpg", "large_1.jpg", "thumb_2.jpg", "large_2.jpg"]) {
      assert.ok(fs.existsSync(path.join(OUT_DIR, f)), `缺少产物 ${f}`);
    }
    assert.ok(fs.existsSync(path.join(OUT_DIR, "sub", "thumb_sub.jpg")));
    assert.ok(fs.existsSync(path.join(OUT_DIR, "sub", "large_sub.jpg")));

    const first = groups[0].images[0];
    assert.strictEqual(typeof first.width, "number", "width 不是数字");
    assert.strictEqual(typeof first.height, "number", "height 不是数字");
    assert.ok(first.width > 0 && first.height > 0, "尺寸非正数");
    // 源图 120x80 超过 large.maxSize=100 → fit inside 后宽为 100
    assert.strictEqual(first.width, 100, `large 图宽度应为 100，实际 ${first.width}`);
  });

  await checkAsync("二次构建命中缓存：产物 mtime 不变", async () => {
    const before = fs.statSync(path.join(OUT_DIR, "large_1.jpg")).mtimeMs;
    await sleep(20);
    await galleryProcessor.processImages(album, OUT_DIR);
    const after = fs.statSync(path.join(OUT_DIR, "large_1.jpg")).mtimeMs;
    assert.strictEqual(after, before, "源图未变却重新生成了");
  });

  await checkAsync("源图更新后重新生成（脏缓存已修复）", async () => {
    const before = fs.statSync(path.join(OUT_DIR, "large_1.jpg")).mtimeMs;
    fs.utimesSync(
      path.join(ALBUM_DIR, "1.jpg"),
      futureDate(10),
      futureDate(10),
    );
    await galleryProcessor.processImages(album, OUT_DIR);
    const after = fs.statSync(path.join(OUT_DIR, "large_1.jpg")).mtimeMs;
    assert.notStrictEqual(after, before, "源图变新后未重新生成");
  });

  // ---------- pictures processBookImages 集成 ----------
  await checkAsync("processBookImages 并发处理且保留顺序", async () => {
    const bookDir = path.join(TEST_ROOT, "book");
    fs.mkdirSync(bookDir, { recursive: true });
    const files = [];
    for (const name of ["p1.jpg", "p2.jpg", "p3.jpg"]) {
      const p = path.join(bookDir, name);
      await makeImage(p, 120, 80);
      files.push({ filename: name, sourcePath: p });
    }
    const bookOut = path.join(TEST_ROOT, "bookout");
    const book = { id: "book-1", title: "Book", files };

    const res = await picturesProcessor.processBookImages(book, bookOut);
    assert.deepStrictEqual(
      res.map((r) => r.filename),
      ["p1.jpg", "p2.jpg", "p3.jpg"],
      "绘本图片顺序被并发打乱",
    );
    for (const r of res) {
      assert.ok(fs.existsSync(path.join(bookOut, r.thumbFilename)), "缺少缩略图");
    }
  });

  console.log(`\n🎉 H4 测试全部通过（${passed} 项）`);
})().catch((e) => {
  console.error("\n💥 H4 测试失败：", e && e.message);
  process.exitCode = 1;
});
