const fs = require("fs");
const path = require("path");
const {
  ASSETS_DIR,
  WEB_DIR,
  TEMP_DIR,
  DATA_JSON_NAME,
} = require("./constants");
const { logger } = require("./utils");

class ResourceManager {
  copyResources(options = {}) {
    const { silent = false } = options;
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
        if (!fs.existsSync(parentDir))
          fs.mkdirSync(parentDir, { recursive: true });
        fs.copyFileSync(src, dest);
      }
    };

    const resources = [{ src: ASSETS_DIR, dest: path.join(WEB_DIR, "assets") }];

    for (const res of resources) {
      if (fs.existsSync(res.src)) {
        copyRecursive(res.src, res.dest);
        logger.success(`Copied ${path.basename(res.src)} to ${res.dest}`);
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
    } else if (!silent) {
      logger.warn(
        `Source data.json not found at ${dataSrc}. Run 'init' first.`,
      );
    }
  }
}

module.exports = new ResourceManager();
