const fs = require("fs");
const path = require("path");
const { PROJECT_ROOT } = require("./constants");
const { normalizePath } = require("./utils");

function loadConfig() {
  const configPath = path.join(PROJECT_ROOT, "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}`);
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  
  // Flatten config for easier access, but keep structure clean
  const config = {
    website: rawConfig.common.site,
    defaultAuthor: rawConfig.common.defaultAuthor,
    gallery: rawConfig.gallery,
    site: rawConfig.site,
    blog: rawConfig.site.blog // Alias for easier access
  };

  // Resolve Photos Dir
  const rawPhotosDir = config.gallery.photosDir || "photos";
  const normalizedRaw = normalizePath(rawPhotosDir);
  // Resolve relative to project root now
  config.gallery.absolutePhotosDir = path.resolve(PROJECT_ROOT, normalizedRaw);

  return config;
}

module.exports = loadConfig();
