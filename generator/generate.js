const fs = require("fs");
const path = require("path");
const config = require("./lib/config");
const { IMAGES_DIR, WEB_DIR, CONFIG_DIR } = require("./lib/constants");
const { logger } = require("./lib/utils");
const dataManager = require("./lib/data-manager");
const imageProcessor = require("./lib/image-processor");
const htmlGenerator = require("./lib/html-generator");
const fontManager = require("./lib/font-manager");
const resourceManager = require("./lib/resource-manager");

async function main() {
  const args = process.argv.slice(2);
  const isInitMode = args.includes("init");

  logger.log(
    `🚀 Starting static site generation${isInitMode ? " (INIT MODE)" : ""}...`
  );

  // Ensure output directories
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(WEB_DIR)) fs.mkdirSync(WEB_DIR, { recursive: true });

  // 1. Data Management
  // Init mode: Scan albums, build index, extract EXIF, save to data.json
  if (isInitMode) {
    await dataManager.scanAlbums();
    dataManager.saveGlobalData();
    logger.success("Init complete. data.json generated with file index.");
    return;
  }

  // Build mode: Load data.json
  const albums = dataManager.loadData();
  if (albums.length === 0) {
    logger.warn("No albums found. Run 'init' first or check photos directory.");
    return;
  }

  // 2. Resource Management
  resourceManager.copyResources();

  // 3. Process Albums
  let allText = ""; // For font subsetting
  allText +=
    config.website.url + config.website.navBrand + config.defaultAuthor;

  for (const album of albums) {
    logger.log(`Processing album: ${album.title} (${album.id})`);

    // Load content
    // Note: data-manager already saves 'dirName' in album object
    const albumPath = path.join(config.absolutePhotosDir, album.dirName);
    const { html: contentHtml, markdown } = dataManager.getOrGenerateContent(
      albumPath,
      album.title,
      album.dirName
    );

    // Collect text
    allText +=
      album.title + markdown + (album.author || "") + (album.description || "");

    // Process Images (Using Index from Album Data)
    const albumImagesOutDir = path.join(IMAGES_DIR, album.id);
    if (!fs.existsSync(albumImagesOutDir))
      fs.mkdirSync(albumImagesOutDir, { recursive: true });

    // processImages now returns enriched groups (with dimensions)
    const groups = await imageProcessor.processImages(album, albumImagesOutDir);

    // Collect group names for font
    groups.forEach((g) => {
      if (g.name) allText += g.name;
    });

    // Flatten images for template data (compatibility)
    const allImages = groups.flatMap((g) => g.images);

    // Construct final Album Data for template
    // We update album.groups with the processed groups (which have correct paths and dims)
    const albumData = {
      ...album,
      images: allImages,
      groups: groups,
    };

    // Generate HTML
    // Note: meta is flattened into albumData now
    htmlGenerator.generateAlbumHtml(album.id, albumData, contentHtml, album);
  }

  // 4. Generate Index HTML
  htmlGenerator.generateIndexHtml(albums);

  // 5. Collect Nav Text
  albums.forEach((a) => (allText += a.title));

  // 6. Generate Fonts
  await fontManager.generateSubset(allText);

  logger.success("Generation complete!");
}

main().catch((err) => logger.error(err));
