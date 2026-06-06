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

    // 4. Remove all whitespace, newlines, and non-Chinese characters (optional, but requested to clean up)
    // The user specifically mentioned removing class names, punctuation, etc.
    // Ideally we just want Chinese characters for the font subsetter.
    // But fontManager.generateSubset usually handles unique char extraction.
    // If we want to clean up the "fullText" log or input, we can do it here.
    // However, the font subsetter needs *all* characters that need to be rendered in that font.
    // If the font is a Chinese font, it likely only cares about Chinese chars + maybe punctuation.
    // Let's implement a cleaner that keeps Chinese, English, Numbers and Punctuation but removes HTML attributes residue if any.
    // Actually, simple strip tags might leave "class="foo"".
    // The previous regex `text.replace(/<[^>]*>/g, " ")` is good but doesn't remove attributes if the tag is malformed or split?
    // No, standard regex handles standard tags.
    // The user's example shows "class="w-24..."". This implies some tags weren't stripped correctly or
    // the text content had things that look like attributes?
    // Wait, `replace(/<[^>]*>/g, " ")` should remove `<div class="...">`.
    // If the user sees `class=...` in the output, it means the regex failed or the input wasn't a valid tag.
    // OR, it might be EJS tags? `<% ... %>`

    // Remove EJS tags
    contentText = contentText.replace(/<%[\s\S]*?%>/g, "");

    // To be safe and clean, let's just extract Chinese characters if the goal is ONLY Chinese font subsetting.
    // If the font includes English, we need English too.
    // Assuming the font is "KingHwaOldSong", it's likely a primary Chinese font.
    // The user said: "其中有class、中英文混合，标点符号、空格、换行符，这些都要剔除掉。" -> "Remove class, mixed English, punctuation, spaces, newlines".
    // This strongly implies we ONLY want Chinese characters.

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
