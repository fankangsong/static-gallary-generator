const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");
const config = require("../../common/lib/config");
const { DATA_JSON_NAME, TEMP_DIR } = require("../../common/lib/constants");
const { logger, getDescription, slugifyName } = require("../../common/lib/utils");
const imageProcessor = require("./image-processor");

let CONTENT_DEFAULT = ``;

const DATA_JSON_PATH = path.join(TEMP_DIR, DATA_JSON_NAME);

// meta.json 中允许覆盖相册条目的字段白名单
const META_FIELDS = [
  "id",
  "title",
  "author",
  "description",
  "template",
  "date",
  "cover",
];

class DataManager {
  constructor() {
    this.albums = [];
  }

  getOrGenerateContent(albumPath, title, albumDirName) {
    let contentHtml = "";
    let markdown = "";
    const contentPath = path.join(albumPath, "content.md");

    if (fs.existsSync(contentPath)) {
      try {
        markdown = fs.readFileSync(contentPath, "utf-8");
        const rawHtml = marked.parse(markdown);
        contentHtml = sanitizeHtml(rawHtml, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            "img",
            "h1",
            "h2",
            "span",
          ]),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ["src", "alt", "title", "width", "height", "class"],
            "*": ["class", "style"],
          },
        });
        logger.success(`Processed content.md for: ${albumDirName}`);
      } catch (e) {
        logger.error(`Error processing content.md for ${albumDirName}:`, e);
      }
    } else {
      try {
        fs.writeFileSync(contentPath, CONTENT_DEFAULT);
        contentHtml = CONTENT_DEFAULT;
        markdown = CONTENT_DEFAULT;
        logger.info(`Created default content.md for: ${albumDirName}`);
      } catch (e) {
        logger.error(
          `Error writing default content.md for ${albumDirName}:`,
          e
        );
      }
    }
    return { html: contentHtml, markdown };
  }

  // 读取相册源目录中的手工元数据 meta.json（优先级最高）。
  // 不存在/损坏/非对象时返回 null，回落到已有 data.json 或自动推导。
  readAlbumMeta(albumPath) {
    const metaPath = path.join(albumPath, "meta.json");
    if (!fs.existsSync(metaPath)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        logger.warn(`Invalid meta.json (not an object), ignored: ${metaPath}`);
        return null;
      }
      const meta = {};
      for (const key of META_FIELDS) {
        const value = raw[key];
        // 跳过空值；空数组视为未提供；description 数组原样保留（模板已支持逐行渲染）
        if (value === undefined || value === null || value === "") continue;
        if (Array.isArray(value) && value.length === 0) continue;
        meta[key] = value;
      }
      return Object.keys(meta).length > 0 ? meta : null;
    } catch (e) {
      logger.warn(`Failed to parse meta.json, ignored: ${metaPath}`, e.message);
      return null;
    }
  }

  // Init Phase: Scan directory, update data.json (Source of Truth)
  async scanAlbums(force = false) {
    const photosDir = config.gallery.absolutePhotosDir;
    if (!fs.existsSync(photosDir)) {
      logger.error("Photos directory not found:", photosDir);
      return [];
    }

    // 0. Load EXIF cache (force 时重置为全量重读)
    imageProcessor.loadExifCache(force);

    // 1. Load existing data (Persistent)
    let existingData = [];
    if (!force && fs.existsSync(DATA_JSON_PATH)) {
      try {
        existingData = JSON.parse(fs.readFileSync(DATA_JSON_PATH, "utf-8"));
      } catch (e) {
        logger.warn(
          "Failed to parse existing data.json, starting fresh:",
          e.message
        );
      }
    }

    const albumDirs = fs.readdirSync(photosDir);
    const newAlbumsData = [];

    for (const albumDirName of albumDirs) {
      const albumPath = path.join(photosDir, albumDirName);
      if (!fs.statSync(albumPath).isDirectory()) continue;

      // Check if exists in DB
      let albumEntry = existingData.find((a) => a.dirName === albumDirName);

      if (!albumEntry) {
        // Create new entry
        logger.info(`New album detected: ${albumDirName}`);
        // 非中文目录名保持原样，中文转拼音——沿用既有 id 规则，避免已发布链接失效
        const generatedId = slugifyName(albumDirName, {
          normalize: false,
          fallback: albumDirName,
        });

        albumEntry = {
          id: generatedId,
          title: albumDirName,
          author: config.defaultAuthor,
          description: "",
          template: config.gallery.template || "default",
          dirName: albumDirName,
          groups: [], // Will be populated
        };
      } else {
        logger.info(`Updating album: ${albumDirName}`);
      }

      // Apply meta.json (overrides existing data.json; auto-derivation below only fills gaps)
      const meta = this.readAlbumMeta(albumPath);
      if (meta) {
        Object.assign(albumEntry, meta);
        logger.info(`Applied meta.json for: ${albumDirName}`);
      }

      // Always rescan files and update index
      // Structure: groups: [{ name: null, files: [{filename, exif}] }, { name: 'sub', files: [...] }]
      const groups = [];
      const entries = fs.readdirSync(albumPath, { withFileTypes: true });

      // 1. Root files
      const rootFiles = entries
        .filter(
          (e) =>
            e.isFile() &&
            config.gallery.supportedExtensions.includes(
              path.extname(e.name).toLowerCase()
            )
        )
        .map((e) => e.name);

      if (rootFiles.length > 0) {
        const fileEntries = [];
        for (const file of rootFiles) {
          const filePath = path.join(albumPath, file);
          const exif = await imageProcessor.getExif(filePath);
          fileEntries.push({ filename: file, exif });
        }
        groups.push({ name: null, files: fileEntries });
      }

      // 2. Subdirectories
      const subDirs = entries.filter((e) => e.isDirectory());
      for (const dir of subDirs) {
        const subDirPath = path.join(albumPath, dir.name);
        const subFiles = fs
          .readdirSync(subDirPath)
          .filter((file) =>
            config.gallery.supportedExtensions.includes(
              path.extname(file).toLowerCase()
            )
          );

        if (subFiles.length > 0) {
          const fileEntries = [];
          for (const file of subFiles) {
            const filePath = path.join(subDirPath, file);
            const exif = await imageProcessor.getExif(filePath);
            fileEntries.push({ filename: file, exif });
          }
          groups.push({ name: dir.name, files: fileEntries });
        }
      }

      albumEntry.groups = groups;
      albumEntry.link = `${albumEntry.id}.html`; // Ensure link is set

      // Deduce Date and Description from first image
      if (groups.length > 0) {
        // Try to find first group with files
        const groupWithFiles = groups.find(
          (g) => g.files && g.files.length > 0
        );
        if (groupWithFiles) {
          const firstFile = groupWithFiles.files[0];

          // Deduce Date
          if (!albumEntry.date && firstFile.exif && firstFile.exif.date) {
            try {
              // firstFile.exif.date is "2023-10-27 12:00"
              const datePart = firstFile.exif.date.split(" ")[0]; // 2023-10-27
              albumEntry.date = datePart.replace(/-/g, ".");
            } catch (e) {
              logger.warn(`Failed to parse date for ${albumEntry.id}:`, e);
            }
          }

          // Deduce Description
          // Only update description if it is empty (config has no defaultDescription field)
          if (!albumEntry.description) {
            let desc = "";
            let dateStr = "";
            let deviceStr = "";

            // Get Date
            if (firstFile.exif && firstFile.exif.date) {
              try {
                // 2023-10-27 12:00 -> 2023/10/27
                const rawDate = firstFile.exif.date.split(" ")[0];
                dateStr = rawDate.replace(/-/g, "/");
              } catch (e) {}
            }

            // Get Device (Make + Model)
            if (firstFile.exif) {
              const make = firstFile.exif.make || "";
              const model = firstFile.exif.model || "";

              // Clean up Make (e.g. "Apple" -> "Apple")
              // Sometimes Model contains Make, e.g. "Canon EOS 5D"
              if (make && model) {
                if (model.toLowerCase().includes(make.toLowerCase())) {
                  deviceStr = model;
                } else {
                  deviceStr = `${make} ${model}`;
                }
              } else {
                deviceStr = make || model;
              }
            }

            desc = getDescription(deviceStr, dateStr);

            // Only set if we generated something
            if (desc) {
              albumEntry.description = desc;
            } else {
              // If no info, keep it empty string instead of default text
              albumEntry.description = "";
            }
          }
        }
      }

      // Auto-set cover if empty
      if (
        !albumEntry.cover &&
        groups.length > 0 &&
        groups[0].files.length > 0
      ) {
        // Use first image as cover.
        // We store the filename here. Build process (generate.js) will convert it to web path.
        // But wait, generate.js uses ALBUM_DATA.cover directly in template?
        // Yes, template uses <%= ALBUM_DATA.cover %>.
        // If we set it here to filename, we need to ensure it's resolved later.
        // Or we can construct the predictable path here?
        // images/<id>/large_<filename>.jpg
        // But filename might change extension? image-processor uses .jpg for output.
        // Let's set a temporary flag or just the filename, and let generate.js resolve it?
        // Actually, let's set the web path directly, assuming standard processing.

        const firstFile = groups[0].files[0];
        const filename = firstFile.filename;
        const namePart = path.parse(filename).name;
        // Default to large image as cover
        // New path structure: <album-id>/images/large_<filename>.jpg
        // This is relative to the photography root (index.html)
        albumEntry.cover = `${albumEntry.id}/images/large_${namePart}.jpg`;
      }

      newAlbumsData.push(albumEntry);
    }

    this.albums = newAlbumsData;
    imageProcessor.flushExifCache();
    return newAlbumsData;
  }

  saveGlobalData() {
    // Save Data to .temp/data.json (Single Source of Truth as per user request)
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_JSON_PATH, JSON.stringify(this.albums, null, 2));
    logger.success(`Saved data to ${DATA_JSON_PATH}`);
  }

  loadData(silent = false) {
    // Load from generator/data.json (Persistent)
    if (fs.existsSync(DATA_JSON_PATH)) {
      return JSON.parse(fs.readFileSync(DATA_JSON_PATH, "utf-8"));
    }
    if (!silent) {
      logger.warn("No data found. Please run 'index:gallary' first.");
    }
    return [];
  }
}

module.exports = new DataManager();
