const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");
const pinyin = require("pinyin").default;
const config = require("../../common/lib/config");
const { DATA_JSON_NAME, TEMP_DIR } = require("../../common/lib/constants");
const { logger, getDescription } = require("../../common/lib/utils");
const imageProcessor = require("./image-processor");

let CONTENT_DEFAULT = ``;

const DATA_JSON_PATH = path.join(TEMP_DIR, DATA_JSON_NAME);

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

  // Init Phase: Scan directory, update data.json (Source of Truth)
  async scanAlbums() {
    const photosDir = config.gallery.absolutePhotosDir;
    if (!fs.existsSync(photosDir)) {
      logger.error("Photos directory not found:", photosDir);
      return [];
    }

    // 1. Load existing data (Persistent)
    let existingData = [];
    // Force refresh: Do not load existing data
    // if (fs.existsSync(DATA_JSON_PATH)) {
    //   try {
    //     existingData = JSON.parse(fs.readFileSync(DATA_JSON_PATH, "utf-8"));
    //   } catch (e) {
    //     logger.warn("Failed to parse existing data.json, starting fresh.", e);
    //   }
    // }

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
        let generatedId = albumDirName;
        if (/[\u4e00-\u9fa5]/.test(albumDirName)) {
          generatedId = pinyin(albumDirName, {
            style: pinyin.STYLE_NORMAL,
            segment: true,
          })
            .flat()
            .join("-")
            .toLowerCase()
            .replace(/-+/g, "-");
        }

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
          // Only update description if it is default or empty
          if (
            !albumEntry.description ||
            albumEntry.description === config.defaultDescription
          ) {
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
      logger.warn("No data found. Please run 'init' first.");
    }
    return [];
  }
}

module.exports = new DataManager();
