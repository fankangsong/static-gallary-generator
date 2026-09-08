const fs = require("fs");
const path = require("path");
const config = require("../../common/lib/config");
const { logger, needsRegeneration } = require("../../common/lib/utils");
const { mapWithConcurrency } = require("../../common/lib/concurrency");
const { generateThumbnail } = require("../../common/lib/image-utils");

const DEFAULT_THUMBNAIL = {
  width: 800,
  height: 800,
  quality: 80,
  fit: "inside",
};

// 图片处理并发度（H4）。config 无 schema 校验（L4），必须兜底。
const DEFAULT_CONCURRENCY = 4;

function thumbnailOptions() {
  return config.pictures.thumbnail || DEFAULT_THUMBNAIL;
}

function picturesConcurrency() {
  const value = config.pictures && config.pictures.concurrency;
  return Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : DEFAULT_CONCURRENCY;
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

  // 并发执行（H4），按输入顺序回填结果；单图失败仍仅告警跳过
  const slots = await mapWithConcurrency(
    book.files || [],
    picturesConcurrency(),
    async (file) => {
      const base = path.parse(file.filename).name;
      const thumbFilename = `thumb_${base}.jpg`;
      const thumbPath = path.join(bookImagesOutDir, thumbFilename);

      try {
        // 旧实现仅判断 existsSync，源图更新后不会重生成（脏缓存），改为比较 mtime
        if (needsRegeneration(file.sourcePath, thumbPath)) {
          await generateThumbnail({
            srcPath: file.sourcePath,
            destPath: thumbPath,
            options: opts,
          });
          logger.log(
            `    🖼️`,
            ` Generated thumbnail: ${book.id}/${thumbFilename}`,
          );
        }
        return { filename: file.filename, thumbFilename };
      } catch (e) {
        logger.warn(
          `Failed to process ${file.sourcePath}, skipped:`,
          e.message,
        );
        return null;
      }
    },
  );

  return slots.filter(Boolean);
}

module.exports = { processBookImages };
