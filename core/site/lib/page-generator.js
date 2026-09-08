const fs = require("fs");
const path = require("path");
const config = require("../../common/lib/config");
const {
  WEB_DIR,
  TEMPLATES_DIR,
  SITE_TEMPLATES_DIR,
} = require("../../common/lib/constants");
const templateRenderer = require("../../common/lib/template-renderer");
const { logger } = require("../../common/lib/utils");

class PageGenerator {
  constructor() {
    this.pages = config.site.pages || [];
  }

  // Helper to extract Chinese characters from text
  extractChineseChars(text) {
    if (!text) return "";
    const matches = text.match(/[\u4e00-\u9fa5]/g);
    return matches ? matches.join("") : "";
  }

  // Helper to strip HTML tags but preserve Chinese characters in attributes like value="" or placeholder=""
  // and text content
  extractTextFromHtml(html) {
    if (!html) return "";

    // 1. Remove script and style tags and their content
    let text = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, " ");
    text = text.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, " ");

    // 2. Extract Chinese characters from specific attributes (value, placeholder, title, alt)
    // This regex looks for attributes with quoted values containing Chinese
    const attributeMatches = text.match(
      /\b(value|placeholder|title|alt)=["']([^"']*?[\u4e00-\u9fa5]+[^"']*?)["']/g
    );
    let attributeText = "";
    if (attributeMatches) {
      attributeText = attributeMatches
        .map((match) => {
          // Extract the value part
          const m = match.match(/=["'](.*?)["']/);
          return m ? m[1] : "";
        })
        .join(" ");
    }

    // 3. Strip all HTML tags to get text content
    let contentText = text.replace(/<[^>]*>/g, " ");

    // 4. Remove EJS tags
    contentText = contentText.replace(/<%[\s\S]*?%>/g, "");

    // 5. 最终仅保留中文字符：本函数的产物只作为中文衬线字体（KingHwaOldSong）子集化的输入
    const chineseOnly = (contentText + attributeText).match(/[\u4e00-\u9fa5]/g);
    return chineseOnly ? chineseOnly.join("") : "";
  }

  // Helper to recursively collect strings from an object
  collectTextFromData(data) {
    let text = "";
    if (typeof data === "string") {
      text += data;
    } else if (Array.isArray(data)) {
      data.forEach((item) => {
        text += this.collectTextFromData(item);
      });
    } else if (typeof data === "object" && data !== null) {
      Object.values(data).forEach((value) => {
        text += this.collectTextFromData(value);
      });
    }
    return text;
  }

  async generate() {
    if (!this.pages || this.pages.length === 0) {
      logger.warn("No pages configured in config.site.pages");
      return;
    }

    for (const pageConfig of this.pages) {
      const { name, template, output, data: pageData, fontOutput } = pageConfig;

      logger.log(`Generating page: ${name} (${output})`);

      // Merge page data with some global defaults
      const data = {
        WEBSITE_TITLE: config.website.title,
        WEBSITE_TITLE_SUFFIX: config.website.url,
        WEBSITE_NAV_BRAND: config.gallery.navBrand,
        WEBSITE_LOGO: config.gallery.logo,
        WEBSITE_FONT: config.website.font,
        FULL_YEAR: new Date().getFullYear(),
        AUTHOR: config.defaultAuthor || "Author",
        NAV_LINKS: config.site.nav || [], // Inject global navigation
        LINKS: config.site.nav || [], // Alias for templates using LINKS
        ...pageData,
      };

      const outputPath = path.join(WEB_DIR, output);

      // Determine template path to read content for font analysis
      // templateRenderer.resolveTemplatePath logic is slightly internal,
      // but we know it looks in rootDirs.
      // We'll try to resolve it similarly to read the file content.
      const possibleDirs = [SITE_TEMPLATES_DIR, TEMPLATES_DIR];
      let templateContent = "";

      for (const dir of possibleDirs) {
        const fullPath = path.join(dir, template);
        if (fs.existsSync(fullPath)) {
          templateContent = fs.readFileSync(fullPath, "utf-8");
          break;
        }
      }

      if (!templateContent) {
        logger.warn(`Could not find template file for analysis: ${template}`);
      }

      // 1. Extract text from HTML template (strip tags)
      const templateText = this.extractTextFromHtml(templateContent);

      // 2. Extract text from data
      const dataText = this.collectTextFromData(pageData);

      const navText = config.site.nav.map((l) => l.text).join("");

      // 3. Combine and extract Chinese characters
      // We pass the full text to renderWithFont, but let's be specific if we want
      // actually, renderWithFont just calls fontManager.generateSubset which takes "text".
      // It's better to pass the raw text and let fontManager handle filtering if it does,
      // but here we specifically want to ensure we catch everything.
      // However, fontManager likely takes a string and subsets based on unique chars.
      // Let's pass the combined text.
      const fullText =
        templateText +
        navText +
        this.extractChineseChars(dataText) +
        this.extractChineseChars(config.gallery.navBrand || "");

      const fontOutputDir = fontOutput ? path.join(WEB_DIR, fontOutput) : null;

      await templateRenderer.renderWithFont(template, data, {
        outputPath: outputPath,
        fontText: fullText,
        fontOutputDir: fontOutputDir,
      });
    }
  }
}

module.exports = new PageGenerator();
