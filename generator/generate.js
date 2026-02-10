const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const ejs = require("ejs");
const Fontmin = require("fontmin");
const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");
const pinyin = require("pinyin").default;
const ExifReader = require("exifreader");
const config = require("./config.json");

// Photo source directory, storing original images and metadata
const PHOTOS_DIR = path.join(__dirname, "photos");
// Website output root directory
const WEB_DIR = path.join(__dirname, "../web");
// Processed images output directory
const IMAGES_DIR = path.join(WEB_DIR, "images");
// Website config directory (e.g., nav.json)
const CONFIG_DIR = path.join(WEB_DIR, "config");
// Font files directory
const FONTS_DIR = path.join(WEB_DIR, "fonts");
// Detail page HTML template path
const TEMPLATE_PATH = path.join(__dirname, "template.html");
const TEMPLATE_MAGAZINE_PATH = path.join(__dirname, "template_magazine.html");
// Index page HTML template path
const INDEX_TEMPLATE_PATH = path.join(__dirname, "index_template.html");
// Source font path for subsetting
const SOURCE_FONT = path.join(__dirname, config.website.font.source);

// Default Markdown content
const CONTENT_DEFAULT = ``;
// Default album description
let DESCRIPTION_DEFAULT = "";
// Try to read default description from DEFAULT_DESCRIPTION file
const defaultDescPath = path.join(__dirname, "./DEFAULT_DESCRIPTION");
if (fs.existsSync(defaultDescPath)) {
  try {
    const defaultDescText = fs.readFileSync(defaultDescPath, "utf-8");
    console.log("ℹ️ Loaded default description from file");
    DESCRIPTION_DEFAULT = [defaultDescText.trim()];
  } catch (e) {
    console.warn(`⚠️ Warning: Failed to read DEFAULT_DESCRIPTION:`, e.message);
    // do nothing
  }
}

// Ensure directories exist
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

// Collect all text for font subsetting
let allText = "";
allText += config.website.url;
allText += config.website.navBrand;
allText += config.defaultAuthor;

/**
 * 1. Meta JSON Generation/Retrieval
 */
function getOrGenerateMeta(albumPath, albumDirName) {
  let meta = {};
  const metaPath = path.join(albumPath, "meta.json");

  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    } catch (e) {
      console.error(`❌ Error reading meta.json for ${albumDirName}:`, e);
    }
  } else {
    // Auto-generate meta.json
    console.log(
      `  ✨ meta.json not found, creating default for: ${albumDirName}`
    );

    // Generate ID from folder name (use Pinyin if Chinese)
    let generatedId = albumDirName;
    if (/[\u4e00-\u9fa5]/.test(albumDirName)) {
      generatedId = pinyin(albumDirName, {
        style: pinyin.STYLE_NORMAL,
        segment: true,
      })
        .flat()
        .join("-")
        .toLowerCase();
    }

    meta = {
      id: generatedId,
      title: albumDirName,
      author: config.defaultAuthor,
      description: DESCRIPTION_DEFAULT,
      template: config.template || "default",
    };
    try {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    } catch (e) {
      console.error(
        `❌ Error writing default meta.json for ${albumDirName}:`,
        e
      );
    }
  }
  return meta;
}

/**
 * 2. Content Markdown Generation/Retrieval
 */
function getOrGenerateContent(albumPath, title, albumDirName) {
  let contentHtml = "";
  let markdown = "";
  const contentPath = path.join(albumPath, "content.md");

  if (fs.existsSync(contentPath)) {
    try {
      markdown = fs.readFileSync(contentPath, "utf-8");
      // allText += markdown; // Add markdown content to font subset
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
      console.log(`  ✅ Processed content.md for: ${albumDirName}`);
    } catch (e) {
      console.error(`❌ Error processing content.md for ${albumDirName}:`, e);
    }
  } else {
    try {
      fs.writeFileSync(contentPath, CONTENT_DEFAULT);
      contentHtml = CONTENT_DEFAULT;
      markdown = CONTENT_DEFAULT;
      console.log(`  📝 Created default content.md for: ${albumDirName}`);
    } catch (e) {
      console.error(
        `❌ Error writing default content.md for ${albumDirName}:`,
        e
      );
    }
  }
  return { html: contentHtml, markdown };
}

/**
 * 3. Image Processing Helper
 */
async function processImageBatch(
  files,
  sourceDir,
  outputDir,
  webRelativePath,
  meta
) {
  const imagesData = [];

  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const filename = path.parse(file).name;

    const thumbFilename = `thumb_${filename}.jpg`;
    const largeFilename = `large_${filename}.jpg`;

    const thumbPath = path.join(outputDir, thumbFilename);
    const largePath = path.join(outputDir, largeFilename);

    // 1. Generate Thumbnail (300x300, cover)
    if (!fs.existsSync(thumbPath)) {
      await sharp(filePath)
        .rotate()
        .resize(config.thumbnail.width, config.thumbnail.height, {
          fit: config.thumbnail.fit,
        })
        .toFormat("jpeg", { quality: config.thumbnail.quality })
        .toFile(thumbPath);
      console.log(`    🖼️`, ` Generated thumbnail: ${thumbFilename}`);
    }

    // 2. Generate Large Image (Max 3000px, inside)
    let width, height;

    if (!fs.existsSync(largePath)) {
      const image = sharp(filePath).rotate();
      const metadata = await image.metadata();

      // Resize if needed
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
        console.log(`    🖼️`, ` Generated large image: ${largeFilename}`);
      } else {
        await image
          .toFormat("jpeg", { quality: config.large.quality })
          .toFile(largePath);
        console.log(`    🖼️`, ` Processed large image: ${largeFilename}`);
      }
    }

    // Read dimensions of the generated large file
    try {
      const largeImageMeta = await sharp(largePath).metadata();
      width = largeImageMeta.width;
      height = largeImageMeta.height;
    } catch (e) {
      console.error(`    ❌ Failed to read metadata for ${largePath}`, e);
      continue; // Skip this image if metadata read fails
    }

    // 3. Extract EXIF Data
    let exifData = {};
    try {
      const tags = await ExifReader.load(filePath);

      // Model
      if (tags.Model) {
        exifData.model = tags.Model.description;
      }

      // DateTime
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

      // Shutter Speed (ExposureTime)
      if (tags.ExposureTime) {
        exifData.shutter = tags.ExposureTime.description;
      }

      // Aperture (FNumber)
      if (tags.FNumber) {
        const fVal = tags.FNumber.description;
        exifData.aperture = fVal.startsWith("f/") ? fVal : `f/${fVal}`;
      }

      // ISO
      if (tags.ISOSpeedRatings) {
        exifData.iso = `ISO${tags.ISOSpeedRatings.description}`;
      }

      // Focal Length
      if (tags.FocalLength) {
        exifData.focalLength = tags.FocalLength.description;
      }
    } catch (e) {
      console.warn(`    ⚠️ Failed to read EXIF for ${filename}:`, e.message);
    }

    // Add filename to allText for font subsetting
    allText += filename;

    imagesData.push({
      src: `${webRelativePath}/${largeFilename}`,
      thumbnail: `${webRelativePath}/${thumbFilename}`,
      width: width,
      height: height,
      alt: filename,
      title: filename, // Use filename as title
      author: meta.author || "Unknown",
      exif: exifData,
    });
  }
  return imagesData;
}

/**
 * 3. Image Processing Main
 */
async function processImages(albumPath, albumImagesOutDir, id, meta) {
  const groups = [];
  const entries = fs.readdirSync(albumPath, { withFileTypes: true });

  // 1. Root files
  const rootFiles = entries
    .filter(
      (e) =>
        e.isFile() &&
        config.supportedExtensions.includes(path.extname(e.name).toLowerCase())
    )
    .map((e) => e.name);

  if (rootFiles.length > 0) {
    // Output dir is albumImagesOutDir
    // Web path is `images/${id}`
    const processed = await processImageBatch(
      rootFiles,
      albumPath,
      albumImagesOutDir,
      `images/${id}`,
      meta
    );
    groups.push({ name: null, images: processed });
  }

  // 2. Subdirectories
  const subDirs = entries.filter((e) => e.isDirectory());
  for (const dir of subDirs) {
    const dirName = dir.name;
    const subDirPath = path.join(albumPath, dirName);
    const subOutDir = path.join(albumImagesOutDir, dirName);

    if (!fs.existsSync(subOutDir)) fs.mkdirSync(subOutDir, { recursive: true });

    const subFiles = fs
      .readdirSync(subDirPath)
      .filter((file) =>
        config.supportedExtensions.includes(path.extname(file).toLowerCase())
      );

    if (subFiles.length > 0) {
      const processed = await processImageBatch(
        subFiles,
        subDirPath,
        subOutDir,
        `images/${id}/${dirName}`,
        meta
      );
      groups.push({ name: dirName, images: processed });
    }
  }

  return groups;
}

/**
 * 4. HTML Generation
 */
function generateHtml(id, albumData, contentHtml, meta) {
  // Determine which template to use
  // Priority: meta.json template > config.json website.template > default
  const templateName = meta.template || config.website.template || "default";
  let templatePath = TEMPLATE_PATH;

  if (templateName === "magazine") {
    templatePath = TEMPLATE_MAGAZINE_PATH;
    console.log(`  📖 Using Magazine Template for: ${id}`);
  }

  const htmlTemplate = fs.readFileSync(templatePath, "utf-8");
  const htmlContent = ejs.render(htmlTemplate, {
    ALBUM_DATA: albumData,
    TITLE: albumData.title,
    CONTENT_HTML: contentHtml,
    DESCRIPTION: meta.description,
    WEBSITE_TITLE_SUFFIX: config.website.url,
    WEBSITE_NAV_BRAND: config.website.navBrand,
    WEBSITE_LOGO: config.website.logo,
    WEBSITE_FONT: config.website.font,
    FULL_YEAR: new Date().getFullYear(),
    AUTHOR: meta.author || config.defaultAuthor,
  });
  const htmlPath = path.join(WEB_DIR, `${id}.html`);
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`  📄 Generated HTML: ${id}.html`);
}

/**
 * 5. Font Subset Generation
 */
async function generateFontSubset() {
  if (fs.existsSync(SOURCE_FONT)) {
    console.log("🔡 Generating font subset...");
    const fontmin = new Fontmin()
      .src(SOURCE_FONT)
      .use(
        Fontmin.glyph({
          text: allText,
          hinting: false,
        })
      )
      .dest(FONTS_DIR);

    await new Promise((resolve, reject) => {
      fontmin.run((err, files) => {
        if (err) {
          console.error("❌ Fontmin error:", err);
          reject(err);
        } else {
          console.log("✅ Font subset generated successfully!");
          resolve();
        }
      });
    });
  } else {
    console.warn(
      "⚠️ Source font not found, skipping subset generation:",
      SOURCE_FONT
    );
  }
}

async function processAlbum(albumDirName, isInitMode) {
  const albumPath = path.join(PHOTOS_DIR, albumDirName);
  const stats = fs.statSync(albumPath);
  if (!stats.isDirectory()) return null;

  console.log(`📁 Processing album: ${albumDirName}`);

  // 1. Get or Generate Meta
  const meta = getOrGenerateMeta(albumPath, albumDirName);

  // Default ID to folder name if not present
  const id = meta.id || albumDirName;
  const title = meta.title || albumDirName;

  // 2. Get or Generate Content
  const { html: contentHtml, markdown } = getOrGenerateContent(
    albumPath,
    title,
    albumDirName
  );

  // If init mode, stop here
  if (isInitMode) {
    console.log(`  ✨ [Init] Completed meta and content for: ${albumDirName}`);
    return null;
  }

  // Collect text for font generation
  allText += title;
  allText += markdown;
  allText += meta.author || "";
  allText += meta.description
    ? Array.isArray(meta.description)
      ? meta.description.join("")
      : meta.description
    : "";

  // Prepare output directory for images
  const albumImagesOutDir = path.join(IMAGES_DIR, id);
  if (!fs.existsSync(albumImagesOutDir))
    fs.mkdirSync(albumImagesOutDir, { recursive: true });

  // 3. Process Images (Now returns groups)
  const groups = await processImages(albumPath, albumImagesOutDir, id, meta);

  // Add group names to font subsetting
  groups.forEach((group) => {
    if (group.name) {
      allText += group.name;
    }
  });

  // Flatten images for backward compatibility and cover selection
  const allImages = groups.flatMap((g) => g.images);

  // Construct Data JSON
  const albumData = {
    id: id,
    title: title,
    author: meta.author || config.defaultAuthor,
    cover: meta.cover || (allImages.length > 0 ? allImages[0].src : ""),
    description: meta.description || "",
    images: allImages,
    groups: groups,
  };

  // 4. Generate HTML
  generateHtml(id, albumData, contentHtml, meta);

  return {
    id: id,
    title: title,
    link: `${id}.html`,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isInitMode = args.includes("init");

  console.log(
    `🚀 Starting static site generation${isInitMode ? " (INIT MODE)" : ""}...`
  );

  if (!fs.existsSync(PHOTOS_DIR)) {
    console.error("❌ Photos directory not found:", PHOTOS_DIR);
    return;
  }

  const albums = fs.readdirSync(PHOTOS_DIR);

  // Read existing nav
  let existingNav = [];
  const navPath = path.join(CONFIG_DIR, "nav.json");
  if (fs.existsSync(navPath)) {
    try {
      existingNav = JSON.parse(fs.readFileSync(navPath, "utf-8"));
    } catch (e) {}
  }

  for (const albumDir of albums) {
    const result = await processAlbum(albumDir, isInitMode);

    if (result && !isInitMode) {
      // Check if exists in nav
      const idx = existingNav.findIndex((item) => item.id === result.id);
      if (idx >= 0) {
        existingNav[idx] = result;
      } else {
        existingNav.push(result);
      }
    }
  }

  if (isInitMode) {
    console.log("✨ Init complete. Run without 'init' to generate full site.");
    return;
  }

  // Write Nav JSON
  fs.writeFileSync(navPath, JSON.stringify(existingNav, null, 2));
  console.log("💾 Updated nav.json");

  // Generate web/index.html with redirect
  if (fs.existsSync(INDEX_TEMPLATE_PATH)) {
    const indexTemplate = fs.readFileSync(INDEX_TEMPLATE_PATH, "utf-8");
    const redirectUrl = existingNav.length > 0 ? existingNav[0].link : "";
    const indexHtmlContent = ejs.render(indexTemplate, {
      REDIRECT_URL: redirectUrl,
    });
    const indexHtmlPath = path.join(WEB_DIR, "index.html");
    fs.writeFileSync(indexHtmlPath, indexHtmlContent);
    console.log(`🌐 Generated web/index.html with redirect to: ${redirectUrl}`);
  } else {
    console.warn(
      "⚠️ index_template.html not found, skipping index generation."
    );
  }

  // Collect nav items text for font subset
  existingNav.forEach((item) => {
    allText += item.title;
  });

  // 5. Generate Font Subset
  await generateFontSubset();

  console.log("🎉 Generation complete!");
}

main().catch((err) => console.error(err));
