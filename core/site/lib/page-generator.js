const fs = require("fs");
const path = require("path");
const config = require("../../common/lib/config");
const {
  WEB_DIR,
  TEMPLATES_DIR,
  SITE_TEMPLATES_DIR,
  PROJECT_ROOT,
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

  // 读取页面数据源 JSON（路径相对仓库根目录，如首页的 data-source/timeline.json）
  // —— 既作为模板渲染数据（locals.DATA_FILE），也是字体子集的取字来源
  readDataFile(relativePath) {
    if (!relativePath) return null;
    const filePath = path.join(PROJECT_ROOT, relativePath);
    if (!fs.existsSync(filePath)) {
      logger.warn(`Data file not found, skipped: ${relativePath}`);
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      logger.error(`Failed to parse data file: ${relativePath}`, err);
      return null;
    }
  }

  // 发布页面依赖的静态资产：from 相对仓库根目录，to 相对 web/（如首页要用的 timeline 照片）
  // ext：可选扩展名白名单（如 [".jpg", ".jpeg"]）。配了它，目录里其它文件（比如时间轴素材目录里
  // 的 content.md 原文）不会被发布到站点产物；不配置则整棵目录原样拷贝（与原来的行为一致）。
  publishAssets(publish) {
    if (!Array.isArray(publish)) return;
    publish.forEach((item) => {
      const { from, to, ext } = item || {};
      if (!from || !to) return;
      const src = path.join(PROJECT_ROOT, from);
      if (!fs.existsSync(src)) {
        logger.warn(`Publish source not found, skipped: ${from}`);
        return;
      }

      const allowed =
        Array.isArray(ext) && ext.length
          ? new Set(ext.map((suffix) => String(suffix).toLowerCase()))
          : null;
      const options = { recursive: true };
      if (allowed) {
        options.filter = (srcPath) => {
          try {
            if (fs.statSync(srcPath).isDirectory()) return true;
          } catch (err) {
            return false;
          }
          return allowed.has(path.extname(srcPath).toLowerCase());
        };
      }

      fs.cpSync(src, path.join(WEB_DIR, to), options);
      logger.log(
        `Published assets: ${from} → web/${to}${allowed ? `（仅 ${[...allowed].join(" / ")}）` : ""}`,
      );
    });
  }

  // options.only：只渲染指定 name 的页面（如 ["index"] 单独构建首页，见 core/site/home.js）
  async generate(options = {}) {
    if (!this.pages || this.pages.length === 0) {
      logger.warn("No pages configured in config.site.pages");
      return;
    }

    const only =
      Array.isArray(options.only) && options.only.length ? options.only : null;
    const pages = only
      ? this.pages.filter((page) => only.includes(page.name))
      : this.pages;

    if (only) {
      const unknown = only.filter(
        (name) => !this.pages.some((page) => page.name === name),
      );
      unknown.forEach((name) =>
        logger.warn(`Page not found in config.site.pages: ${name}`),
      );
    }

    for (const pageConfig of pages) {
      const {
        name,
        template,
        output,
        data: pageData,
        fontOutput,
        dataFile,
        publish,
      } = pageConfig;

      logger.log(`Generating page: ${name} (${output})`);

      // 页面依赖的静态资产（如首页的照片）先发布到 web/ 下
      this.publishAssets(publish);

      // 数据驱动页面：构建期读取 JSON（首页 = data-source/timeline.json）
      const dataFileContent = this.readDataFile(dataFile);

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
        DATA_FILE: dataFileContent, // dataFile 的原文（模板内联用；同时参与字体取字）
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
      //    注意：脚本与样式块会被剥掉，所以 JS 运行时才渲染的文案（如日期里的「年月日」）
      //    必须由 pageData 的 UI_TEXT 之类的字段补上，否则子集缺字、这些字会回退到系统宋体。
      const templateText = this.extractTextFromHtml(templateContent);

      // 2. Extract text from data
      const dataText = this.collectTextFromData(pageData);

      // 2b. Extract text from the page's data file（数据驱动页面：正文来自 JSON，
      //     模板里取不到，必须按这份 JSON 取字）
      const dataFileText = this.collectTextFromData(dataFileContent);

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
        this.extractChineseChars(dataFileText) +
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
