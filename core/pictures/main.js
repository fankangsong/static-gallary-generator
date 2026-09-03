const fs = require("fs");
const path = require("path");
const config = require("../common/lib/config");
const { PICTURES_WEB_DIR } = require("../common/lib/constants");
const { logger } = require("../common/lib/utils");
const scanner = require("./lib/scanner");
const imageProcessor = require("./lib/image-processor");

const BOOKSHELF_TEMPLATE = path.resolve(
  __dirname,
  "../../templates/pictures/bookshelf.html"
);
const LOGO_ASSET = path.resolve(
  __dirname,
  "../../docs/logo/logo-xiangxiang-hero.svg"
);

/**
 * build:pictures 流水线：扫描 → 缩略图 → data.json → 页面/资源拷贝。
 * 产物自包含于 web/pictures/，一次执行即完成，无独立 index 阶段。
 */
async function run() {
  logger.log("🚀 Starting pictures build...");

  const books = scanner.scanBooks();
  if (books.length === 0) {
    logger.warn(
      "No picture books found. Check config.pictures.sourceDir:",
      config.pictures.absoluteSourceDir
    );
    return;
  }

  if (!fs.existsSync(PICTURES_WEB_DIR)) {
    fs.mkdirSync(PICTURES_WEB_DIR, { recursive: true });
  }

  // 1. 缩略图（增量构建：已存在则跳过；单图失败告警不中断）
  let imageCount = 0;
  for (const book of books) {
    logger.log(`Processing book: ${book.title} (${book.id})`);
    const outDir = path.join(PICTURES_WEB_DIR, "images", book.id);
    const processed = await imageProcessor.processBookImages(book, outDir);
    imageCount += processed.length;
  }

  // 2. data.json：与书架页 normalize() 数据契约一致（albums + groups/files）
  const data = books.map((book) => ({
    id: book.id,
    title: book.title,
    groups:
      book.files.length > 0
        ? [
            {
              name: null,
              files: book.files.map((f) => ({ filename: f.filename })),
            },
          ]
        : [],
  }));
  const dataPath = path.join(PICTURES_WEB_DIR, "data.json");
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  logger.success(`Saved data to ${dataPath}`);

  // 3. 书架页面与静态资源
  fs.copyFileSync(BOOKSHELF_TEMPLATE, path.join(PICTURES_WEB_DIR, "index.html"));
  const assetsDir = path.join(PICTURES_WEB_DIR, "assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  if (fs.existsSync(LOGO_ASSET)) {
    fs.copyFileSync(
      LOGO_ASSET,
      path.join(assetsDir, "logo-xiangxiang-hero.svg")
    );
  } else {
    logger.warn("Logo asset not found, page renders without logo:", LOGO_ASSET);
  }

  logger.success(
    `Pictures build complete: ${books.length} book(s), ${imageCount} image(s) → ${PICTURES_WEB_DIR}`
  );
}

module.exports = { run };
