const sharp = require("sharp");

/**
 * 缩略图默认参数（L4：config 无 schema 校验，必须兜底）。
 * 取值与 config.gallery.thumbnail / config.pictures.thumbnail 保持一致。
 */
const DEFAULT_THUMBNAIL = {
  width: 800,
  height: 800,
  quality: 80,
  fit: "inside",
};

/**
 * 归一化缩略图参数：两份 config 的字段命名已一致，但都可能有缺字段，
 * 逐项兜底避免 sharp 收到 undefined。
 *
 * @param {object} [options]
 * @returns {{width: number, height: number, quality: number, fit: string}}
 */
function normalizeThumbnailOptions(options = {}) {
  const merged = { ...DEFAULT_THUMBNAIL, ...(options || {}) };
  return {
    width: Number(merged.width) || DEFAULT_THUMBNAIL.width,
    height: Number(merged.height) || DEFAULT_THUMBNAIL.height,
    quality: Number(merged.quality) || DEFAULT_THUMBNAIL.quality,
    fit: merged.fit || DEFAULT_THUMBNAIL.fit,
  };
}

/**
 * 生成 JPEG 缩略图（gallery 相册与 pictures 绘本共用）。
 *
 * 只负责「读源图 → 旋转 → 缩放 → 写 JPEG」这一段 Sharp 处理链；
 * 输出命名、增量判断（needsRegeneration）与并发控制由调用方负责。
 *
 * @param {{srcPath: string, destPath: string, options?: object}} params
 */
async function generateThumbnail({ srcPath, destPath, options }) {
  const opts = normalizeThumbnailOptions(options);
  await sharp(srcPath)
    .rotate()
    .resize(opts.width, opts.height, { fit: opts.fit })
    .toFormat("jpeg", { quality: opts.quality })
    .toFile(destPath);
}

module.exports = {
  generateThumbnail,
  normalizeThumbnailOptions,
  DEFAULT_THUMBNAIL,
};
