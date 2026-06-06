const fs = require("fs");
const path = require("path");
const Fontmin = require("fontmin");
const config = require("./config");
const { FONTS_DIR, PROJECT_ROOT } = require("./constants");
const { logger } = require("./utils");

class FontManager {
  constructor() {
    this.sourceFont = path.join(PROJECT_ROOT, config.website.font.source);
  }

  async generateSubset(text, outputDir = null) {
    // Add brand description to the text
    text += config.gallery.brandDescription;
    const outputName = config.website.font.name + ".ttf";

    if (fs.existsSync(this.sourceFont)) {
      const targetName = config.website.font.name;
      const targetDir = outputDir || FONTS_DIR;

      logger.info(`Generating font subset: ${targetName} in ${targetDir}...`);

      // Ensure output directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fontmin = new Fontmin()
        .src(this.sourceFont)
        .use(
          Fontmin.glyph({
            text: text,
            hinting: false,
          }),
        )
        .dest(targetDir);

      await new Promise((resolve, reject) => {
        fontmin.run((err, files) => {
          if (err) {
            logger.error("Fontmin error:", err);
            reject(err);
          } else {
            // Rename if outputName is provided and different from source
            if (outputName) {
              const sourceBasename = path.basename(this.sourceFont);
              if (sourceBasename !== outputName) {
                // Fontmin returns buffers in memory, but .dest() writes them.
                // We need to rename the file on disk.
                const originalPath = path.join(targetDir, sourceBasename);
                const newPath = path.join(targetDir, outputName);
                if (fs.existsSync(originalPath)) {
                  // Check if target exists, remove it first to avoid error
                  if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
                  fs.renameSync(originalPath, newPath);
                }
              }
            }
            logger.success(`Font subset generated successfully: ${targetName}`);
            resolve();
          }
        });
      });
    } else {
      // ⚠️ Source font not found logic
      // Instead of just logging a warning, let's log once per run or check if it's already logged?
      // For now, let's keep the warning but maybe make it less alarming if it's expected for some users.
      // Or we can try to fallback? No fallback logic for now.
      logger.warn(
        "⚠️ Source font not found, skipping subset generation:",
        this.sourceFont,
      );
    }
  }
}

module.exports = new FontManager();
