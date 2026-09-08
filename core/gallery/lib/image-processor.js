const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const ExifReader = require("exifreader");
const config = require("../../common/lib/config");
const { TEMP_DIR, EXIF_CACHE_NAME } = require("../../common/lib/constants");
const { logger, needsRegeneration } = require("../../common/lib/utils");
const { mapWithConcurrency } = require("../../common/lib/concurrency");
const { generateThumbnail } = require("../../common/lib/image-utils");

const EXIF_CACHE_PATH = path.join(TEMP_DIR, EXIF_CACHE_NAME);

// 图片处理并发度（H4）。config 无 schema 校验（L4），必须兜底；
// 非法值交给 mapWithConcurrency 回落为串行。
const DEFAULT_CONCURRENCY = 4;

function galleryConcurrency() {
  const value = config.gallery && config.gallery.concurrency;
  return Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : DEFAULT_CONCURRENCY;
}

class ImageProcessor {
  constructor() {
    this._exifCache = { version: 1, entries: {} };
    this._seenKeys = new Set();
  }

  // Load EXIF cache from disk into memory (once per scan).
  // force=true 或缓存损坏时以空缓存起步（降级为全量读取）。
  loadExifCache(force = false) {
    this._exifCache = { version: 1, entries: {} };
    this._seenKeys = new Set();
    if (force || !fs.existsSync(EXIF_CACHE_PATH)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(EXIF_CACHE_PATH, "utf-8"));
      if (parsed && parsed.version === 1 && typeof parsed.entries === "object") {
        this._exifCache = parsed;
      } else {
        logger.warn("exif-cache.json has unexpected format, starting fresh.");
      }
    } catch (e) {
      logger.warn("Failed to parse exif-cache.json, starting fresh:", e.message);
    }
  }

  // Flush cache back to disk once per scan, pruning entries not seen this run.
  flushExifCache() {
    const pruned = { version: 1, entries: {} };
    for (const key of this._seenKeys) {
      if (this._exifCache.entries[key]) {
        pruned.entries[key] = this._exifCache.entries[key];
      }
    }
    try {
      if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
      fs.writeFileSync(EXIF_CACHE_PATH, JSON.stringify(pruned));
      logger.success(
        `Saved EXIF cache (${Object.keys(pruned.entries).length} entries)`
      );
    } catch (e) {
      logger.warn("Failed to write exif-cache.json:", e.message);
    }
  }

  // New method for Init Phase: Extract EXIF only (with mtime-based cache)
  async getExif(filePath) {
    const key = path
      .relative(config.gallery.absolutePhotosDir, filePath)
      .split(path.sep)
      .join("/");
    let mtime = null;
    try {
      mtime = fs.statSync(filePath).mtimeMs;
    } catch (e) {
      // 读不到 stat（如文件扫描间隙被删）则跳过缓存直接全量读
    }

    const cached = mtime !== null ? this._exifCache.entries[key] : null;
    if (cached && cached.mtime === mtime) {
      this._seenKeys.add(key);
      return cached.exif;
    }

    let exifData = {};
    try {
      const tags = await ExifReader.load(filePath);
      if (tags.Make) exifData.make = tags.Make.description;
      if (tags.Model) exifData.model = tags.Model.description;
      if (tags.DateTimeOriginal) {
        const dateStr = tags.DateTimeOriginal.description;
        if (dateStr && dateStr.length >= 16) {
          const [datePart, timePart] = dateStr.split(" ");
          if (datePart && timePart) {
            exifData.date = `${datePart.replace(
              /:/g,
              "-"
            )} ${timePart.substring(0, 5)}`;
          }
        }
      }
      if (tags.ExposureTime) exifData.shutter = tags.ExposureTime.description;
      if (tags.FNumber) {
        const fVal = tags.FNumber.description;
        exifData.aperture = fVal.startsWith("f/") ? fVal : `f/${fVal}`;
      }
      if (tags.ISOSpeedRatings)
        exifData.iso = `ISO${tags.ISOSpeedRatings.description}`;
      if (tags.FocalLength) exifData.focalLength = tags.FocalLength.description;
    } catch (e) {
      logger.warn(
        `    ⚠️ Failed to read EXIF for ${path.basename(filePath)}:`,
        e.message
      );
    }
    if (mtime !== null) {
      this._exifCache.entries[key] = { mtime, exif: exifData };
      this._seenKeys.add(key);
    }
    return exifData;
  }

  // Refactored method for Build Phase: Resize images from File Index
  async processImages(album, albumImagesOutDir) {
    const imagesData = [];
    // Relative path for HTML: images/filename.jpg (since index.html is in album folder)
    const webRelativeBase = `images`;

    // Helper to process a single file entry from index
    const processFile = async (fileEntry, subDirName = null) => {
      const filename = fileEntry.filename;
      // Reconstruct source path using dirName stored in album
      const sourceDir = subDirName
        ? path.join(config.gallery.absolutePhotosDir, album.dirName, subDirName)
        : path.join(config.gallery.absolutePhotosDir, album.dirName);

      const filePath = path.join(sourceDir, filename);

      // Output directory
      const targetOutDir = subDirName
        ? path.join(albumImagesOutDir, subDirName)
        : albumImagesOutDir;

      if (!fs.existsSync(targetOutDir))
        fs.mkdirSync(targetOutDir, { recursive: true });

      const thumbFilename = `thumb_${path.parse(filename).name}.jpg`;
      const largeFilename = `large_${path.parse(filename).name}.jpg`;
      const thumbPath = path.join(targetOutDir, thumbFilename);
      const largePath = path.join(targetOutDir, largeFilename);

      const webRelativePath = subDirName
        ? `${webRelativeBase}/${subDirName}`
        : webRelativeBase;

      // 1. Generate Thumbnail
      // 旧实现仅判断 existsSync，源图更新后不会重生成（脏缓存），改为比较 mtime
      if (needsRegeneration(filePath, thumbPath)) {
        await generateThumbnail({
          srcPath: filePath,
          destPath: thumbPath,
          options: config.gallery.thumbnail,
        });
        logger.log(`    🖼️`, ` Generated thumbnail: ${thumbFilename}`);
      }

      // 2. Generate Large Image
      let width, height;
      if (needsRegeneration(filePath, largePath)) {
        const image = sharp(filePath).rotate();
        const metadata = await image.metadata();
        let info;

        if (
          metadata.width > config.gallery.large.maxSize ||
          metadata.height > config.gallery.large.maxSize
        ) {
          info = await image
            .resize(config.gallery.large.maxSize, config.gallery.large.maxSize, {
              fit: config.gallery.large.fit,
              withoutEnlargement: true,
            })
            .toFormat("jpeg", { quality: config.gallery.large.quality })
            .toFile(largePath);
          logger.log(`    🖼️`, ` Generated large image: ${largeFilename}`);
        } else {
          info = await image
            .toFormat("jpeg", { quality: config.gallery.large.quality })
            .toFile(largePath);
          logger.log(`    🖼️`, ` Processed large image: ${largeFilename}`);
        }

        // toFile() 的返回值已含输出尺寸，无需再对输出文件做一次 metadata 读取
        width = info.width;
        height = info.height;
      } else {
        // 命中缓存：尺寸只能从产物读取，这是唯一无法避免的一次读取
        try {
          const largeImageMeta = await sharp(largePath).metadata();
          width = largeImageMeta.width;
          height = largeImageMeta.height;
        } catch (e) {
          logger.error(`    ❌ Failed to read metadata for ${largePath}`, e);
          return null;
        }
      }

      return {
        src: `${webRelativePath}/${largeFilename}`,
        thumbnail: `${webRelativePath}/${thumbFilename}`,
        width: width,
        height: height,
        alt: filename,
        title: filename,
        author: album.author || "Unknown",
        exif: fileEntry.exif || {}, // Use cached EXIF from init
      };
    };

    const groups = album.groups || [];

    // 摊平 (group, file) 为任务列表（H4：并发执行，取代原来的双层串行循环）
    const tasks = [];
    groups.forEach((group, groupIdx) => {
      (group.files || []).forEach((fileEntry, fileIdx) => {
        tasks.push({ groupIdx, fileIdx, groupName: group.name, fileEntry });
      });
    });

    // 并发前预创建全部输出目录，避免并发 mkdir 竞态
    const outDirs = new Set([albumImagesOutDir]);
    for (const task of tasks) {
      if (task.groupName) outDirs.add(path.join(albumImagesOutDir, task.groupName));
    }
    for (const dir of outDirs) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    // 结果按 groupIdx / fileIdx 回填，保证分组结构与组内顺序与串行时完全一致
    const slots = groups.map((group) => new Array((group.files || []).length));

    await mapWithConcurrency(tasks, galleryConcurrency(), async (task) => {
      // fileEntry is { filename: '...', exif: {...} }
      slots[task.groupIdx][task.fileIdx] = await processFile(
        task.fileEntry,
        task.groupName,
      );
    });

    return groups.map((group, i) => ({
      name: group.name,
      images: slots[i].filter(Boolean),
    }));
  }
}

module.exports = new ImageProcessor();
