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
const fontManager = require("../../common/lib/font-manager");

class ErrorPageGenerator {
  async generate() {
    const templatePath = path.join(SITE_TEMPLATES_DIR, "404.html");

    if (!fs.existsSync(templatePath)) {
      logger.error(`404 template not found: ${templatePath}`);
      return;
    }

    const htmlTemplate = fs.readFileSync(templatePath, "utf-8");

    // Load content from config
    const links = config.site.index?.links || [];

    const data = {
      TITLE: "404 - Page Not Found",
      DESCRIPTION: "Page not found",
      WEBSITE_TITLE: config.website.title,
      WEBSITE_FONT: config.website.font,
      LINKS: links,
      NAV_LINKS: links,
      WEBSITE_TITLE_SUFFIX: config.website.url,
      WEBSITE_NAV_BRAND: config.gallery.navBrand,
      WEBSITE_LOGO: config.gallery.logo,
      FULL_YEAR: new Date().getFullYear(),
      AUTHOR: config.defaultAuthor,
    };

    const options = {
      root: [SITE_TEMPLATES_DIR, COMMON_TEMPLATES_DIR, GALLERY_TEMPLATES_DIR],
      filename: templatePath,
    };

    const htmlContent = ejs.render(htmlTemplate, data, options);
    const outputPath = path.join(WEB_DIR, "404.html");

    // Ensure output directory exists
    if (!fs.existsSync(WEB_DIR)) {
      fs.mkdirSync(WEB_DIR, { recursive: true });
    }

    fs.writeFileSync(outputPath, htmlContent);
    logger.success(`Generated 404.html at ${outputPath}`);

    // Generate font subset for 404 page
    const navText = links.map((l) => l.text).join("");
    // Text used in 404 page: "4", "Go Back Home", plus nav links
    const pageText =
      "4Go Back Home" + navText + (config.gallery.navBrand || "");
    const fontOutputDir = path.join(WEB_DIR, "assets/fonts/error/");

    try {
      await fontManager.generateSubset(pageText, fontOutputDir);
      logger.success(`Generated font subset for 404 page in ${fontOutputDir}`);
    } catch (e) {
      logger.error("Failed to generate font subset for 404 page:", e);
    }
  }
}

module.exports = new ErrorPageGenerator();
