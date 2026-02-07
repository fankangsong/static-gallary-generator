const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const ejs = require("ejs");
const Fontmin = require("fontmin");
const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");
const pinyin = require("pinyin").default;
const config = require("./config.json");

const PHOTOS_DIR = path.join(__dirname, "photos");
const WEB_DIR = path.join(__dirname, "../web");
const DATA_DIR = path.join(WEB_DIR, "data");
const IMAGES_DIR = path.join(WEB_DIR, "images");
const CONFIG_DIR = path.join(WEB_DIR, "config");
const FONTS_DIR = path.join(WEB_DIR, "fonts");
const TEMPLATE_PATH = path.join(__dirname, "template.html");
const INDEX_TEMPLATE_PATH = path.join(__dirname, "index_template.html");
const SOURCE_FONT = path.join(
  __dirname,
  config.website.font
    ? config.website.font.source
    : "fonts/SourceHanSerifCN-Regular.otf",
);

const CONTENT_DEFAULT = ``;
const DESCRIPTION_DEFAULT = ["📷 理光 GR3  🎞️ 伊尔夫 PAN200 📅 2024-01-01"];

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
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
      console.error(`Error reading meta.json for ${albumDirName}:`, e);
    }
  } else {
    // Auto-generate meta.json
    console.log(`  meta.json not found, creating default for: ${albumDirName}`);

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
    };
    try {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    } catch (e) {
      console.error(`Error writing default meta.json for ${albumDirName}:`, e);
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
      console.log(`  Processed content.md for: ${albumDirName}`);
    } catch (e) {
      console.error(`Error processing content.md for ${albumDirName}:`, e);
    }
  } else {
    try {
      fs.writeFileSync(contentPath, CONTENT_DEFAULT);
      contentHtml = CONTENT_DEFAULT;
      markdown = CONTENT_DEFAULT;
      console.log(`  Created default content.md for: ${albumDirName}`);
    } catch (e) {
      console.error(`Error writing default content.md for ${albumDirName}:`, e);
    }
  }
  return { html: contentHtml, markdown };
}

/**
 * 3. Image Processing
 */
async function processImages(albumPath, albumImagesOutDir, id, meta) {
  // Process images
  const files = fs.readdirSync(albumPath).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return config.supportedExtensions.includes(ext);
  });

  const imagesData = [];

  for (const file of files) {
    const filePath = path.join(albumPath, file);
    const filename = path.parse(file).name;

    const thumbFilename = `thumb_${filename}.jpg`;
    const largeFilename = `large_${filename}.jpg`;

    const thumbPath = path.join(albumImagesOutDir, thumbFilename);
    const largePath = path.join(albumImagesOutDir, largeFilename);

    // 1. Generate Thumbnail (300x300, cover)
    if (!fs.existsSync(thumbPath)) {
      await sharp(filePath)
        .rotate()
        .resize(config.thumbnail.width, config.thumbnail.height, {
          fit: config.thumbnail.fit,
        })
        .toFormat("jpeg", { quality: config.thumbnail.quality })
        .toFile(thumbPath);
      console.log(`  Generated thumbnail: ${thumbFilename}`);
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
        console.log(`  Generated large image: ${largeFilename}`);
      } else {
        await image
          .toFormat("jpeg", { quality: config.large.quality })
          .toFile(largePath);
        console.log(`  Processed large image: ${largeFilename}`);
      }
    }

    // Read dimensions of the generated large file
    const largeImageMeta = await sharp(largePath).metadata();
    width = largeImageMeta.width;
    height = largeImageMeta.height;

    imagesData.push({
      src: `images/${id}/${largeFilename}`,
      thumbnail: `images/${id}/${thumbFilename}`,
      width: width,
      height: height,
      alt: filename,
      author: meta.author || "Unknown",
    });
  }
  return imagesData;
}

/**
 * 4. HTML Generation
 */
function generateHtml(id, albumData, contentHtml, meta) {
  const htmlTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  const htmlContent = ejs.render(htmlTemplate, {
    DATA_FILE: `${id}.json`,
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
  console.log(`  Generated HTML: ${id}.html`);
}

/**
 * 5. Font Subset Generation
 */
async function generateFontSubset() {
  if (fs.existsSync(SOURCE_FONT)) {
    console.log("Generating font subset...");
    const fontmin = new Fontmin()
      .src(SOURCE_FONT)
      .use(
        Fontmin.glyph({
          text: allText,
          hinting: false,
        }),
      )
      .dest(FONTS_DIR);

    await new Promise((resolve, reject) => {
      fontmin.run((err, files) => {
        if (err) {
          console.error("Fontmin error:", err);
          reject(err);
        } else {
          console.log("Font subset generated successfully!");
          resolve();
        }
      });
    });
  } else {
    console.warn(
      "Source font not found, skipping subset generation:",
      SOURCE_FONT,
    );
  }
}

async function processAlbum(albumDirName, isInitMode) {
  const albumPath = path.join(PHOTOS_DIR, albumDirName);
  const stats = fs.statSync(albumPath);
  if (!stats.isDirectory()) return null;

  console.log(`Processing album: ${albumDirName}`);

  // 1. Get or Generate Meta
  const meta = getOrGenerateMeta(albumPath, albumDirName);

  // Default ID to folder name if not present
  const id = meta.id || albumDirName;
  const title = meta.title || albumDirName;

  // 2. Get or Generate Content
  const { html: contentHtml, markdown } = getOrGenerateContent(
    albumPath,
    title,
    albumDirName,
  );

  // If init mode, stop here
  if (isInitMode) {
    console.log(`  [Init] Completed meta and content for: ${albumDirName}`);
    return null; // Don't return nav item in init mode? Or should we?
    // Usually init is for setting up new folders.
    // We can return null to skip nav update or return basic info.
    // Let's return null to skip heavy processing effects.
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

  // 3. Process Images
  const imagesData = await processImages(
    albumPath,
    albumImagesOutDir,
    id,
    meta,
  );

  // Construct Data JSON
  const albumData = {
    id: id,
    title: title,
    author: meta.author || config.defaultAuthor,
    cover: meta.cover || (imagesData.length > 0 ? imagesData[0].src : ""),
    description: meta.description || "",
    images: imagesData,
  };

  // Write Data JSON
  const dataJsonPath = path.join(DATA_DIR, `${id}.json`);
  fs.writeFileSync(dataJsonPath, JSON.stringify(albumData, null, 2));
  console.log(`  Generated data: ${id}.json`);

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
    `Starting static site generation${isInitMode ? " (INIT MODE)" : ""}...`,
  );

  if (!fs.existsSync(PHOTOS_DIR)) {
    console.error("Photos directory not found:", PHOTOS_DIR);
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
    console.log("Init complete. Run without 'init' to generate full site.");
    return;
  }

  // Write Nav JSON
  fs.writeFileSync(navPath, JSON.stringify(existingNav, null, 2));
  console.log("Updated nav.json");

  // Generate web/index.html with redirect
  if (fs.existsSync(INDEX_TEMPLATE_PATH)) {
    const indexTemplate = fs.readFileSync(INDEX_TEMPLATE_PATH, "utf-8");
    const redirectUrl = existingNav.length > 0 ? existingNav[0].link : "";
    const indexHtmlContent = ejs.render(indexTemplate, {
      REDIRECT_URL: redirectUrl,
    });
    const indexHtmlPath = path.join(WEB_DIR, "index.html");
    fs.writeFileSync(indexHtmlPath, indexHtmlContent);
    console.log(`Generated web/index.html with redirect to: ${redirectUrl}`);
  } else {
    console.warn("index_template.html not found, skipping index generation.");
  }

  // Collect nav items text for font subset
  existingNav.forEach((item) => {
    allText += item.title;
  });

  // 5. Generate Font Subset
  await generateFontSubset();

  console.log("Generation complete!");
}

main().catch((err) => console.error(err));
