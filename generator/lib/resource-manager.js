const fs = require("fs");
const path = require("path");
const {
  TEMPLATES_DIR,
  WEB_DIR,
  TEMP_DIR,
  DATA_JSON_NAME,
} = require("./constants");
const { logger } = require("./utils");

const SRC_DIR_LIST = [
  "js",
  "assets"
];

class ResourceManager {
  copyResources() {
    // 1. Copy items from SRC_DIR_LIST Recursively
    const copyRecursive = (src, dest) => {
      if (!fs.existsSync(src)) return;
      const stats = fs.statSync(src);

      if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          copyRecursive(srcPath, destPath);
        }
      } else {
        const parentDir = path.dirname(dest);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
        fs.copyFileSync(src, dest);
      }
    };

    for (const item of SRC_DIR_LIST) {
      const srcPath = path.join(TEMPLATES_DIR, item);
      const destPath = path.join(WEB_DIR, item);

      if (fs.existsSync(srcPath)) {
        copyRecursive(srcPath, destPath);
        logger.success(`Copied ${item} to web/${item}`);
      } else {
        // Optional: warn if configured item is missing?
        // logger.warn(`Source item ${item} not found in templates.`);
      }
    }

    // 2. Copy data.json (Source of Truth to Runtime)
    const dataSrc = path.join(TEMP_DIR, DATA_JSON_NAME);
    const configDestDir = path.join(WEB_DIR, "config");
    const dataDest = path.join(configDestDir, "data.json");

    if (fs.existsSync(dataSrc)) {
      if (!fs.existsSync(configDestDir))
        fs.mkdirSync(configDestDir, { recursive: true });
      fs.copyFileSync(dataSrc, dataDest);
      logger.success("Copied data.json to web/config/");
    } else {
      logger.warn(
        `Source data.json not found at ${dataSrc}. Run 'init' first.`
      );
    }
  }
}

module.exports = new ResourceManager();
