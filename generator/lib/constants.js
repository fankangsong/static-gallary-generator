const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../../");
const GENERATOR_DIR = path.resolve(__dirname, "../");
const WEB_DIR = path.join(PROJECT_ROOT, "web");

module.exports = {
  PROJECT_ROOT,
  GENERATOR_DIR,
  WEB_DIR,
  IMAGES_DIR: path.join(WEB_DIR, "images"),
  CONFIG_DIR: path.join(WEB_DIR, "config"),
  FONTS_DIR: path.join(WEB_DIR, "fonts"),
  TEMP_DIR: path.join(GENERATOR_DIR, ".temp"),
  TEMPLATES_DIR: path.join(GENERATOR_DIR, "templates"),
  DEFAULT_DESC_FILE: path.join(GENERATOR_DIR, "DEFAULT_DESCRIPTION"),
  DATA_JSON_NAME: "data.json",
  NAV_JSON_NAME: "nav.json",
};
