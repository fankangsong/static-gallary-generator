const fs = require("fs");
const path = require("path");
const config = require("../common/lib/config");
const {
  IMAGES_DIR,
  WEB_DIR,
  CONFIG_DIR,
  PHOTO_WEB_DIR,
} = require("../common/lib/constants");
const { logger } = require("../common/lib/utils");
const dataManager = require("./lib/data-manager");
const imageProcessor = require("./lib/image-processor");
const htmlGenerator = require("./lib/html-generator");
const fontManager = require("../common/lib/font-manager");
const resourceManager = require("../common/lib/resource-manager");

async function run(args) {
  const command = args[0];
  const isInitMode = command === "index:gallary";

  if (isInitMode) {
    logger.log(`🚀 Starting gallery initialization...`);
    if (!fs.existsSync(IMAGES_DIR))
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    if (!fs.existsSync(CONFIG_DIR))
      fs.mkdirSync(CONFIG_DIR, { recursive: true });

    await dataManager.scanAlbums();
    dataManager.saveGlobalData();
    logger.success("Init complete. data.json generated with file index.");
    return;
  }

  logger.log(`🚀 Starting gallery build...`);
  // Ensure output directories
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  if (!fs.existsSync(WEB_DIR)) fs.mkdirSync(WEB_DIR, { recursive: true });

  // Load data.json
  const albums = dataManager.loadData();
  if (albums.length === 0) {
    logger.warn(
      "No albums found. Run 'index:gallery' first or check photos directory.",
    );
    return;
  }

  // Resource Management
  resourceManager.copyResources();

  // Process Albums
  let allText = "";
  allText +=
    config.website.url + config.website.navBrand + config.defaultAuthor;

  for (const album of albums) {
    logger.log(`Processing album: ${album.title} (${album.id})`);

    const albumPath = path.join(config.gallery.absolutePhotosDir, album.dirName);
    const { html: contentHtml, markdown } = dataManager.getOrGenerateContent(
      albumPath,
      album.title,
      album.dirName,
    );

    allText +=
      album.title + markdown + (album.author || "") + (album.description || "");

    // Output images to: web/photography/<album-id>/images
    const albumImagesOutDir = path.join(PHOTO_WEB_DIR, album.id, "images");
    if (!fs.existsSync(albumImagesOutDir))
      fs.mkdirSync(albumImagesOutDir, { recursive: true });

    const groups = await imageProcessor.processImages(album, albumImagesOutDir);

    groups.forEach((g) => {
      if (g.name) allText += g.name;
    });

    const allImages = groups.flatMap((g) => g.images);

    const albumData = {
      ...album,
      images: allImages,
      groups: groups,
    };

    htmlGenerator.generateAlbumHtml(album.id, albumData, contentHtml, album);
  }

  htmlGenerator.generateIndexHtml(albums);

  const navLinks = config.site.index?.links || [];
  const navText = navLinks.map((l) => l.text).join("");
  allText += navText;

  await fontManager.generateSubset(
    allText,
    path.join(WEB_DIR, "assets/fonts/gallary/"),
  );

  logger.success("Gallery build complete!");
}

module.exports = { run };
