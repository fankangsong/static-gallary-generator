const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const config = require("./config");
const { TEMPLATES_DIR, WEB_DIR } = require("./constants");
const { logger } = require("./utils");

class HtmlGenerator {
  generateAlbumHtml(id, albumData, contentHtml, meta) {
    const templateName = meta.template || config.website.template || "default";
    let templateFile = "template.html";
    if (templateName === "magazine") {
      templateFile = "template_magazine.html";
      logger.log(`  📖 Using Magazine Template for: ${id}`);
    }

    const templatePath = path.join(TEMPLATES_DIR, templateFile);
    if (!fs.existsSync(templatePath)) {
      logger.error(`Template not found: ${templatePath}`);
      return;
    }

    const htmlTemplate = fs.readFileSync(templatePath, "utf-8");

    // Data passed to template
    const data = {
      ALBUM_DATA: albumData,
      TITLE: albumData.title,
      CONTENT_HTML: contentHtml,
      DESCRIPTION: meta.description,
      WEBSITE_TITLE_SUFFIX: config.website.url,
      WEBSITE_NAV_BRAND: config.website.navBrand,
      WEBSITE_LOGO: config.website.logo,
      WEBSITE_FONT: config.website.font,
      FULL_YEAR: new Date().getFullYear(),
      AUTHOR: meta.author || config.defaultAuthor,
    };

    // EJS Options: set root for includes
    const options = {
      root: TEMPLATES_DIR,
      filename: templatePath, // Enables relative includes
    };

    const htmlContent = ejs.render(htmlTemplate, data, options);
    const htmlPath = path.join(WEB_DIR, `${id}.html`);
    fs.writeFileSync(htmlPath, htmlContent);
    logger.log(`  📄 Generated HTML: ${id}.html`);
  }

  generateIndexHtml(albums) {
    const indexTemplatePath = path.join(TEMPLATES_DIR, "index_template.html");
    if (fs.existsSync(indexTemplatePath)) {
      const indexTemplate = fs.readFileSync(indexTemplatePath, "utf-8");
      const indexHtmlContent = ejs.render(
        indexTemplate,
        {
          ALBUMS: albums,
          TITLE: config.website.navBrand,
          DESCRIPTION: config.website.description || "Photography Portfolio",
          WEBSITE_TITLE_SUFFIX: config.website.url,
          WEBSITE_NAV_BRAND: config.website.navBrand,
          WEBSITE_LOGO: config.website.logo,
          WEBSITE_FONT: config.website.font,
          FULL_YEAR: new Date().getFullYear(),
          AUTHOR: config.defaultAuthor,
          WEBSITE_BRAND_DESCRIPTION: config.website.brandDescription,
        },
        {
          root: TEMPLATES_DIR,
          filename: indexTemplatePath,
        }
      );
      const indexHtmlPath = path.join(WEB_DIR, "index.html");
      fs.writeFileSync(indexHtmlPath, indexHtmlContent);
      logger.log(`🌐 Generated web/index.html with ${albums.length} albums`);
    } else {
      logger.warn(
        "⚠️ index_template.html not found, skipping index generation."
      );
    }
  }
}

module.exports = new HtmlGenerator();
