const fs = require("fs");
const path = require("path");
const { GENERATOR_DIR, DEFAULT_DESC_FILE } = require("./constants");
const { logger, normalizePath } = require("./utils");

function loadConfig() {
  const configPath = path.join(GENERATOR_DIR, "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  // Resolve Photos Dir
  const rawPhotosDir = config.photosDir || "photos";
  const normalizedRaw = normalizePath(rawPhotosDir);
  // Original logic was relative to generator dir
  config.absolutePhotosDir = path.resolve(GENERATOR_DIR, normalizedRaw);

  return config;
}

module.exports = loadConfig();
