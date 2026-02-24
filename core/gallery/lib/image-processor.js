const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const ExifReader = require("exifreader");
const config = require("../../common/lib/config");
const { logger } = require("../../common/lib/utils");

class ImageProcessor {
  // New method for Init Phase: Extract EXIF only
  async getExif(filePath) {
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
        ? path.join(config.absolutePhotosDir, album.dirName, subDirName)
        : path.join(config.absolutePhotosDir, album.dirName);

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
      if (!fs.existsSync(thumbPath)) {
        await sharp(filePath)
          .rotate()
          .resize(config.thumbnail.width, config.thumbnail.height, {
            fit: config.thumbnail.fit,
          })
          .toFormat("jpeg", { quality: config.thumbnail.quality })
          .toFile(thumbPath);
        logger.log(`    🖼️`, ` Generated thumbnail: ${thumbFilename}`);
      }

      // 2. Generate Large Image
      let width, height;
      if (!fs.existsSync(largePath)) {
        const image = sharp(filePath).rotate();
        const metadata = await image.metadata();

        if (
          metadata.width > config.large.maxSize ||
          metadata.height > config.large.maxSize
        ) {
          await image
            .resize(config.large.maxSize, config.large.maxSize, {
              fit: config.large.fit,
              withoutEnlargement: true,
            })
            .toFormat("jpeg", { quality: config.large.quality })
            .toFile(largePath);
          logger.log(`    🖼️`, ` Generated large image: ${largeFilename}`);
        } else {
          await image
            .toFormat("jpeg", { quality: config.large.quality })
            .toFile(largePath);
          logger.log(`    🖼️`, ` Processed large image: ${largeFilename}`);
        }
      }

      // Read dimensions (Build phase enriches dimensions)
      try {
        const largeImageMeta = await sharp(largePath).metadata();
        width = largeImageMeta.width;
        height = largeImageMeta.height;
      } catch (e) {
        logger.error(`    ❌ Failed to read metadata for ${largePath}`, e);
        return null;
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

    const newGroups = [];

    // Iterate over groups from Index
    for (const group of album.groups) {
      const processedImages = [];
      for (const fileEntry of group.files) {
        // fileEntry is { filename: '...', exif: {...} }
        const result = await processFile(fileEntry, group.name);
        if (result) processedImages.push(result);
      }
      newGroups.push({
        name: group.name,
        images: processedImages,
      });
    }

    return newGroups;
  }
}

module.exports = new ImageProcessor();
