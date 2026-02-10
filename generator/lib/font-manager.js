const fs = require("fs");
const path = require("path");
const Fontmin = require("fontmin");
const config = require("./config");
const { FONTS_DIR, GENERATOR_DIR } = require("./constants");
const { logger } = require("./utils");

class FontManager {
  constructor() {
    this.sourceFont = path.join(GENERATOR_DIR, config.website.font.source);
  }

  async generateSubset(text) {
    if (fs.existsSync(this.sourceFont)) {
      logger.info("Generating font subset...");

      // Ensure output directory exists
      if (!fs.existsSync(FONTS_DIR)) {
        fs.mkdirSync(FONTS_DIR, { recursive: true });
      }

      const fontmin = new Fontmin()
        .src(this.sourceFont)
        .use(
          Fontmin.glyph({
            text: text,
            hinting: false,
          })
        )
        .dest(FONTS_DIR);

      await new Promise((resolve, reject) => {
        fontmin.run((err, files) => {
          if (err) {
            logger.error("Fontmin error:", err);
            reject(err);
          } else {
            logger.success("Font subset generated successfully!");
            resolve();
          }
        });
      });
    } else {
      logger.warn(
        "⚠️ Source font not found, skipping subset generation:",
        this.sourceFont
      );
    }
  }
}

module.exports = new FontManager();
