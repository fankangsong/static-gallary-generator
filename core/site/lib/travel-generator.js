const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const config = require("../../common/lib/config");
const {
  SITE_TEMPLATES_DIR,
  COMMON_TEMPLATES_DIR,
  GALLERY_TEMPLATES_DIR,
  WEB_DIR,
} = require("../../common/lib/constants");
const { logger } = require("../../common/lib/utils");

class TravelGenerator {
  async generate() {
    const templatePath = path.join(SITE_TEMPLATES_DIR, "travel.html");

    if (!fs.existsSync(templatePath)) {
      logger.error(`Travel template not found: ${templatePath}`);
      return;
    }

    const htmlTemplate = fs.readFileSync(templatePath, "utf-8");

    const data = {
      TITLE: "旅行",
      DESCRIPTION: "Travel Map",
      WEBSITE_TITLE_SUFFIX: config.website.url,
      WEBSITE_NAV_BRAND: config.website.navBrand,
      WEBSITE_LOGO: config.website.logo,
      WEBSITE_FONT: config.website.font,
      FULL_YEAR: new Date().getFullYear(),
      AUTHOR: config.defaultAuthor || "Author",
    };

    const options = {
      root: [SITE_TEMPLATES_DIR, COMMON_TEMPLATES_DIR, GALLERY_TEMPLATES_DIR],
      filename: templatePath,
    };

    const htmlContent = ejs.render(htmlTemplate, data, options);
    const outputDir = path.join(WEB_DIR, "travel");

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, "index.html");
    fs.writeFileSync(outputPath, htmlContent);
    logger.success(`Generated travel/index.html at ${outputPath}`);
  }
}

module.exports = new TravelGenerator();
