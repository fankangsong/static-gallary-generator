const fs = require("fs");
const path = require("path");
const config = require("../common/lib/config");
const { WEB_DIR, CONFIG_DIR } = require("../common/lib/constants");
const { logger } = require("../common/lib/utils");
const resourceManager = require("../common/lib/resource-manager");
const dataManager = require("../gallery/lib/data-manager");
const { buildBlog } = require("./lib/blog-builder");
const pageGenerator = require("./lib/page-generator");
const sitemapGenerator = require("./lib/sitemap-generator");
const travelDataBuilder = require("./lib/travel-data-builder");

async function run(args) {
  logger.log(`🚀 Starting site (blog) build...`);
  if (!fs.existsSync(WEB_DIR)) fs.mkdirSync(WEB_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

  // Resource Management
  resourceManager.copyResources({ silent: true });

  let albums = [];
  try {
    albums = dataManager.loadData(true);
  } catch (e) {
    logger.warn(
      "Failed to load album data. Site navigation may miss albums.",
      e,
    );
  }

  const initialText = "";
  const { posts } = await buildBlog(initialText, albums);

  // Generate travel markers data (for the 3D globe on travel page)
  await travelDataBuilder.run();

  // Generate pages (index, travel, 404, etc.)
  await pageGenerator.generate();

  // Generate Sitemap
  sitemapGenerator.generate(albums, posts);

  logger.success("Site build complete!");
}

module.exports = { run };
