const fs = require("fs");
const path = require("path");
const { PROJECT_ROOT } = require("./constants");
const { normalizePath } = require("./utils");

function loadConfig() {
  const configPath = path.join(PROJECT_ROOT, "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  // Resolve Photos Dir
  const rawPhotosDir = config.photosDir || "photos";
  const normalizedRaw = normalizePath(rawPhotosDir);
  // Resolve relative to project root now
  config.absolutePhotosDir = path.resolve(PROJECT_ROOT, normalizedRaw);

  return config;
}

module.exports = loadConfig();
