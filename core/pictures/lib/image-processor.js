const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const config = require("../../common/lib/config");
const { logger } = require("../../common/lib/utils");

const DEFAULT_THUMBNAIL = {
  width: 800,
  height: 800,
  quality: 80,
  fit: "inside",
};

function thumbnailOptions() {
  return config.pictures.thumbnail || DEFAULT_THUMBNAIL;
}

/**
 * 为一本绘本生成阅读器缩略图（阅读器仅使用 thumb 图）。
 * - 输出命名与 gallery 一致：thumb_<文件名去扩展名>.jpg
 * - 增量构建：目标已存在则跳过
 * - 单图失败仅告警不中断（页面自带 img-err 兜底展示）
 *
 * @returns {Promise<Array<{filename: string, thumbFilename: string}>>} 处理成功的文件
 */
async function processBookImages(book, bookImagesOutDir) {
  const opts = thumbnailOptions();
  if (!fs.existsSync(bookImagesOutDir)) {
    fs.mkdirSync(bookImagesOutDir, { recursive: true });
  }

  const results = [];
  for (const file of book.files) {
    const base = path.parse(file.filename).name;
    const thumbFilename = `thumb_${base}.jpg`;
    const thumbPath = path.join(bookImagesOutDir, thumbFilename);

    try {
      if (!fs.existsSync(thumbPath)) {
        await sharp(file.sourcePath)
          .rotate()
          .resize(opts.width, opts.height, { fit: opts.fit })
          .toFormat("jpeg", { quality: opts.quality })
          .toFile(thumbPath);
        logger.log(`    🖼️`, ` Generated thumbnail: ${book.id}/${thumbFilename}`);
      }
      results.push({ filename: file.filename, thumbFilename });
    } catch (e) {
      logger.warn(
        `Failed to process ${file.sourcePath}, skipped:`,
        e.message
      );
    }
  }
  return results;
}

module.exports = { processBookImages };
