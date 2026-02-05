const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const ejs = require("ejs");
const Fontmin = require("fontmin");
const config = require("./config.json");

const PHOTOS_DIR = path.join(__dirname, "photos");
const WEB_DIR = path.join(__dirname, "../web");
const DATA_DIR = path.join(WEB_DIR, "data");
const IMAGES_DIR = path.join(WEB_DIR, "images");
const CONFIG_DIR = path.join(WEB_DIR, "config");
const FONTS_DIR = path.join(WEB_DIR, "fonts");
const TEMPLATE_PATH = path.join(__dirname, "template.html");
const INDEX_TEMPLATE_PATH = path.join(__dirname, "index_template.html");
const SOURCE_FONT = path.join(__dirname, "fonts/SourceHanSerifCN-Regular.otf");

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

async function processAlbum(albumDirName) {
  const albumPath = path.join(PHOTOS_DIR, albumDirName);
  const stats = fs.statSync(albumPath);
  if (!stats.isDirectory()) return null;

  console.log(`Processing album: ${albumDirName}`);

  // Read meta.json
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
    meta = {
      id: albumDirName,
      title: albumDirName,
      author: config.defaultAuthor,
      description: [],
    };
    try {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    } catch (e) {
      console.error(`Error writing default meta.json for ${albumDirName}:`, e);
    }
  }

  // Default ID to folder name if not present
  const id = meta.id || albumDirName;
  const title = meta.title || albumDirName;

  // Collect text
  allText += title;
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
        .resize(config.thumbnail.width, config.thumbnail.height, {
          fit: config.thumbnail.fit,
        })
        .toFormat("jpeg", { quality: config.thumbnail.quality })
        .toFile(thumbPath);
      console.log(`  Generated thumbnail: ${thumbFilename}`);
    }

    // 2. Generate Large Image (Max 3000px, inside)
    // Check if large file exists, if so read its dimensions, otherwise create it
    let width, height;

    if (!fs.existsSync(largePath)) {
      const image = sharp(filePath);
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
        // Just copy or convert to jpeg if not resizing?
        // Let's standardize on jpeg for web
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

  // Write HTML
  const htmlTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  const htmlContent = ejs.render(htmlTemplate, {
    DATA_FILE: `${id}.json`,
    TITLE: title,
    WEBSITE_TITLE_SUFFIX: config.website.url,
    WEBSITE_NAV_BRAND: config.website.navBrand,
    WEBSITE_LOGO: config.website.logo,
  });
  const htmlPath = path.join(WEB_DIR, `${id}.html`);
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`  Generated HTML: ${id}.html`);

  return {
    id: id,
    title: title,
    link: `${id}.html`,
  };
}

async function main() {
  console.log("Starting static site generation...");

  if (!fs.existsSync(PHOTOS_DIR)) {
    console.error("Photos directory not found:", PHOTOS_DIR);
    return;
  }

  const albums = fs.readdirSync(PHOTOS_DIR);
  const navItems = [];

  // Preserve existing nav items if possible?
  // Or just regenerate? The user said "Collect folder names", implying regeneration.
  // But we have existing manual pages (nature, architecture, portrait).
  // If we only regenerate based on photos folder, we might lose existing manual pages if they don't have source folders in generator/photos.
  // However, the task implies this script is the source of truth.
  // Let's read existing nav.json first to see if we should merge or overwrite.
  // For now, I'll append to existing list or start fresh?
  // User said "Collect folder names...". I will assume this script generates NEW content.
  // But typically a generator rebuilds the site.
  // I'll try to keep existing items if they are not in the new list, OR just rewrite.
  // Given the prompt "Collect folder names... Generate html", it seems like a full build process.
  // I'll check if `nature`, `architecture` exist in photos. They don't (only `shantou` exists).
  // So if I overwrite, I lose nature/architecture.
  // Strategy: Read existing nav.json, filter out items that collide with new ones, then add new ones.

  let existingNav = [];
  const navPath = path.join(CONFIG_DIR, "nav.json");
  if (fs.existsSync(navPath)) {
    try {
      existingNav = JSON.parse(fs.readFileSync(navPath, "utf-8"));
    } catch (e) {}
  }

  for (const albumDir of albums) {
    const result = await processAlbum(albumDir);
    if (result) {
      // Check if exists in nav
      const idx = existingNav.findIndex((item) => item.id === result.id);
      if (idx >= 0) {
        existingNav[idx] = result;
      } else {
        existingNav.push(result);
      }
    }
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

  // Collect nav items text
  existingNav.forEach((item) => {
    allText += item.title;
  });

  // Generate Font Subset
  if (fs.existsSync(SOURCE_FONT)) {
    console.log("Generating font subset...");
    // Filter unique characters to reduce size? Fontmin does this?
    // Actually fontmin might need explicit text.
    // Remove duplicates and non-chinese/non-display chars roughly?
    // Fontmin handles unique chars internally usually, but let's just pass the string.

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
      SOURCE_FONT
    );
  }

  console.log("Generation complete!");
}

main().catch((err) => console.error(err));
