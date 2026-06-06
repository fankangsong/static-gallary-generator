const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../../../");
const GENERATOR_DIR = path.resolve(__dirname, "../../");
const WEB_DIR = path.join(PROJECT_ROOT, "web");
const PHOTO_WEB_DIR = path.join(WEB_DIR, "photography");

module.exports = {
  PROJECT_ROOT,
  GENERATOR_DIR,
  WEB_DIR,
  PHOTO_WEB_DIR,
  IMAGES_DIR: path.join(PHOTO_WEB_DIR, "images"), // This is just a base, actual images go into album folders
  CONFIG_DIR: path.join(WEB_DIR, "config"),
  FONTS_DIR: path.join(WEB_DIR, "assets/fonts"),
  TEMP_DIR: path.join(GENERATOR_DIR, ".temp"),
  TEMPLATES_DIR: path.join(PROJECT_ROOT, "templates"),
  COMMON_TEMPLATES_DIR: path.join(PROJECT_ROOT, "templates/common"),
  GALLERY_TEMPLATES_DIR: path.join(PROJECT_ROOT, "templates/gallary"),
  SITE_TEMPLATES_DIR: path.join(PROJECT_ROOT, "templates/site"),
  ASSETS_DIR: path.join(PROJECT_ROOT, "templates/assets"),
  DATA_JSON_NAME: "data.json",
  NAV_JSON_NAME: "nav.json",
};
