const fs = require("fs");
const path = require("path");
const config = require("../../common/lib/config");
const { slugifyDirName, logger } = require("../../common/lib/utils");

const DEFAULT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function supportedExtensions() {
  return config.pictures.supportedExtensions || DEFAULT_EXTENSIONS;
}

/**
 * 扫描绘本源目录：一个子目录 = 一本绘本（零手工元数据）。
 * - 书名 = 子目录名
 * - 作品 = 子目录下平铺的图片文件（不递归分组），按文件名自然排序
 * - id = 目录名的拼音 slug（重名追加 -2/-3 去重），保证 URL 安全
 *
 * @returns {Array<{id: string, title: string, dirName: string, files: Array<{filename: string, sourcePath: string}>}>}
 */
function scanBooks() {
  const sourceDir = config.pictures.absoluteSourceDir;
  if (!fs.existsSync(sourceDir)) {
    logger.error("Pictures source directory not found:", sourceDir);
    return [];
  }

  const usedSlugs = new Map(); // slug -> 已用次数
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const books = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirName = entry.name;
    const bookPath = path.join(sourceDir, dirName);

    const files = fs
      .readdirSync(bookPath, { withFileTypes: true })
      .filter((e) => e.isFile())
      .filter((e) =>
        supportedExtensions().includes(path.extname(e.name).toLowerCase())
      )
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((filename) => ({ filename, sourcePath: path.join(bookPath, filename) }));

    if (files.length === 0) {
      logger.warn(`Empty book (no supported images): ${dirName}`);
    }

    const baseSlug = slugifyDirName(dirName);
    const seen = usedSlugs.get(baseSlug) || 0;
    usedSlugs.set(baseSlug, seen + 1);
    const id = seen === 0 ? baseSlug : `${baseSlug}-${seen + 1}`;

    books.push({ id, title: dirName, dirName, files });
  }

  logger.log(
    `Scanned ${books.length} book(s) from ${sourceDir} ` +
      `(total ${books.reduce((n, b) => n + b.files.length, 0)} image(s)).`
  );
  return books;
}

module.exports = { scanBooks };
