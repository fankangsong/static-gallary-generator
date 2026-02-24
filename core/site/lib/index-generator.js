const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const config = require("../../common/lib/config");
const { SITE_TEMPLATES_DIR, WEB_DIR } = require("../../common/lib/constants");
const { logger } = require("../../common/lib/utils");
const fontManager = require("../../common/lib/font-manager");

class IndexGenerator {
  async generate() {
    const templatePath = path.join(SITE_TEMPLATES_DIR, "index.html");

    if (!fs.existsSync(templatePath)) {
      logger.error(`Index template not found: ${templatePath}`);
      return;
    }

    const htmlTemplate = fs.readFileSync(templatePath, "utf-8");

    // Load content from config
    const links = config.site.index?.links || [];
    const quotes = config.site.index?.quotes || [];

    const data = {
      WEBSITE_TITLE: config.website.title,
      WEBSITE_FONT: config.website.font,
      LINKS: links,
      QUOTES: quotes,
    };

    const htmlContent = ejs.render(htmlTemplate, data);
    const outputPath = path.join(WEB_DIR, "index.html");

    // Ensure output directory exists
    if (!fs.existsSync(WEB_DIR)) {
      fs.mkdirSync(WEB_DIR, { recursive: true });
    }

    fs.writeFileSync(outputPath, htmlContent);
    logger.success(`Generated index.html at ${outputPath}`);

    // Generate font subset for index page
    const textToSubset = links.map((l) => l.text).join("") + quotes.join(""); // Include stamp text if used
    const fontOutputDir = path.join(WEB_DIR, "assets/fonts/index/");

    try {
      await fontManager.generateSubset(textToSubset, fontOutputDir);
      logger.success(
        `Generated font subset for index page in ${fontOutputDir}`,
      );
    } catch (e) {
      logger.error("Failed to generate font subset for index page:", e);
    }
  }
}

module.exports = new IndexGenerator();
