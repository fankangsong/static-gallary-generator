const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const config = require("../../common/lib/config");
const {
  GALLERY_TEMPLATES_DIR,
  COMMON_TEMPLATES_DIR,
  PHOTO_WEB_DIR,
  CONFIG_DIR,
  NAV_JSON_NAME,
} = require("../../common/lib/constants");
const { logger } = require("../../common/lib/utils");

class HtmlGenerator {
  generateAlbumHtml(id, albumData, contentHtml, meta) {
    const templateName = meta.template || config.gallery.template || "default";
    let templateFile = "template.html";
    if (templateName === "magazine") {
      templateFile = "template_magazine.html";
      logger.log(`  📖 Using Magazine Template for: ${id}`);
    }

    // Try finding template in Gallery specific templates first, then Common
    let templatePath = path.join(GALLERY_TEMPLATES_DIR, templateFile);
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(COMMON_TEMPLATES_DIR, templateFile);
    }

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
      WEBSITE_NAV_BRAND: config.gallery.navBrand,
      WEBSITE_LOGO: config.gallery.logo,
      WEBSITE_FONT: config.website.font,
      FULL_YEAR: new Date().getFullYear(),
      AUTHOR: meta.author || config.defaultAuthor,
    };

    // EJS Options: set root for includes
    // We prioritize Gallery templates, but allow including from Common
    const options = {
      root: [GALLERY_TEMPLATES_DIR, COMMON_TEMPLATES_DIR],
      filename: templatePath, // Enables relative includes
    };

    const htmlContent = ejs.render(htmlTemplate, data, options);

    // Create album specific directory: web/photography/album-id/index.html
    const albumDir = path.join(PHOTO_WEB_DIR, id);
    if (!fs.existsSync(albumDir)) {
      fs.mkdirSync(albumDir, { recursive: true });
    }
    const htmlPath = path.join(albumDir, "index.html");
    fs.writeFileSync(htmlPath, htmlContent);
    logger.log(`  📄 Generated HTML: photography/${id}/index.html`);
  }

  generateIndexHtml(albums) {
    let indexTemplatePath = path.join(
      GALLERY_TEMPLATES_DIR,
      "index_template.html",
    );
    if (!fs.existsSync(indexTemplatePath)) {
      indexTemplatePath = path.join(
        COMMON_TEMPLATES_DIR,
        "index_template.html",
      );
    }

    if (fs.existsSync(indexTemplatePath)) {
      const indexTemplate = fs.readFileSync(indexTemplatePath, "utf-8");

      // Update links to point to subdirectory
      const albumsWithUpdatedLinks = albums.map((album) => ({
        ...album,
        link: `${album.id}/`,
      }));

      const indexHtmlContent = ejs.render(
        indexTemplate,
        {
          ALBUMS: albumsWithUpdatedLinks,
          TITLE: config.gallery.navBrand,
          DESCRIPTION: config.website.description || "Photography Portfolio",
          WEBSITE_TITLE_SUFFIX: config.website.url,
          WEBSITE_NAV_BRAND: config.gallery.navBrand,
          WEBSITE_LOGO: config.gallery.logo,
          WEBSITE_FONT: config.website.font,
          FULL_YEAR: new Date().getFullYear(),
          AUTHOR: config.defaultAuthor,
          WEBSITE_BRAND_DESCRIPTION: config.gallery.brandDescription,
        },
        {
          root: [GALLERY_TEMPLATES_DIR, COMMON_TEMPLATES_DIR],
          filename: indexTemplatePath,
        },
      );
      const indexHtmlPath = path.join(PHOTO_WEB_DIR, "index.html");
      fs.writeFileSync(indexHtmlPath, indexHtmlContent);
      logger.log(
        `🌐 Generated web/photography/index.html with ${albums.length} albums`,
      );

      const navItems = albumsWithUpdatedLinks.map((album) => ({
        title: album.title,
        link: `../${album.link}`,
      }));
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }
      const navJsonPath = path.join(CONFIG_DIR, NAV_JSON_NAME);
      fs.writeFileSync(navJsonPath, JSON.stringify(navItems, null, 2));
      logger.log(`📂 Generated nav.json with ${navItems.length} items`);
    } else {
      logger.warn(
        "⚠️ index_template.html not found, skipping index generation.",
      );
    }
  }
}

module.exports = new HtmlGenerator();
