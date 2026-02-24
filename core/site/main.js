const fs = require("fs");
const path = require("path");
const config = require("../common/lib/config");
const { WEB_DIR, CONFIG_DIR } = require("../common/lib/constants");
const { logger } = require("../common/lib/utils");
const dataManager = require("../gallery/lib/data-manager");
const { buildBlog } = require("./lib/blog-builder");
const indexGenerator = require("./lib/index-generator");
const travelGenerator = require("./lib/travel-generator");
const sitemapGenerator = require("./lib/sitemap-generator");

async function run(args) {
  logger.log(`🚀 Starting site (blog) build...`);
  if (!fs.existsSync(WEB_DIR)) fs.mkdirSync(WEB_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

  let albums = [];
  try {
    albums = dataManager.loadData();
  } catch (e) {
    logger.warn(
      "Failed to load album data. Site navigation may miss albums.",
      e,
    );
  }

  const initialText = "";
  const { posts } = await buildBlog(initialText, albums);

  // Generate main index page
  await indexGenerator.generate();

  // Generate travel page
  await travelGenerator.generate();

  // Generate Sitemap
  sitemapGenerator.generate(albums, posts);

  logger.success("Site build complete!");
}

module.exports = { run };
