const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const config = require("./config");
const {
  TEMPLATES_DIR,
  WEB_DIR,
  COMMON_TEMPLATES_DIR,
  GALLERY_TEMPLATES_DIR,
  SITE_TEMPLATES_DIR,
} = require("./constants");
const { logger } = require("./utils");
const fontManager = require("./font-manager");

class TemplateRenderer {
  constructor() {
    this.rootDirs = [
      TEMPLATES_DIR,
      SITE_TEMPLATES_DIR,
      GALLERY_TEMPLATES_DIR,
      COMMON_TEMPLATES_DIR,
    ];
  }

  resolveTemplatePath(templatePath) {
    if (path.isAbsolute(templatePath)) {
      return templatePath;
    }

    for (const rootDir of this.rootDirs) {
      const fullPath = path.join(rootDir, templatePath);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    const absolutePath = path.resolve(TEMPLATES_DIR, templatePath);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }

    return null;
  }

  getDefaultOutputPath(templatePath) {
    let absoluteTemplatePath = templatePath;
    if (!path.isAbsolute(templatePath)) {
      absoluteTemplatePath = this.resolveTemplatePath(templatePath);
    }

    if (!absoluteTemplatePath) {
      return null;
    }

    const relativeToTemplates = path.relative(TEMPLATES_DIR, absoluteTemplatePath);
    
    let outputRelative = relativeToTemplates;
    
    if (relativeToTemplates.startsWith("site" + path.sep)) {
      outputRelative = relativeToTemplates.replace(/^site[\/\\]/, "");
    } else if (relativeToTemplates.startsWith("gallary" + path.sep)) {
      outputRelative = relativeToTemplates.replace(/^gallary[\/\\]/, "");
    }

    if (outputRelative.endsWith(".ejs")) {
      outputRelative = outputRelative.replace(/\.ejs$/, ".html");
    }

    return path.join(WEB_DIR, outputRelative);
  }

  render(templatePath, data = {}, options = {}) {
    const resolvedPath = this.resolveTemplatePath(templatePath);
    
    if (!resolvedPath) {
      logger.error(`Template not found: ${templatePath}`);
      return null;
    }

    if (!fs.existsSync(resolvedPath)) {
      logger.error(`Template file does not exist: ${resolvedPath}`);
      return null;
    }

    const htmlTemplate = fs.readFileSync(resolvedPath, "utf-8");

    const ejsOptions = {
      root: this.rootDirs,
      filename: resolvedPath,
      ...options.ejsOptions,
    };

    let htmlContent;
    try {
      htmlContent = ejs.render(htmlTemplate, data, ejsOptions);
    } catch (error) {
      logger.error(`Failed to render template: ${resolvedPath}`, error);
      return null;
    }

    const outputPath = options.outputPath || this.getDefaultOutputPath(resolvedPath);

    if (options.save !== false && outputPath) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, htmlContent);
      logger.log(`📄 Rendered: ${path.relative(WEB_DIR, outputPath)}`);
    }

    return {
      content: htmlContent,
      outputPath: outputPath,
    };
  }

  async renderBatch(templates) {
    const results = [];
    
    for (const template of templates) {
      const { templatePath, data, options } = template;
      const result = this.render(templatePath, data, options);
      results.push(result);
    }

    return results;
  }

  async packFont(text, outputDir = null) {
    if (!text || typeof text !== "string") {
      logger.warn("No text provided for font packing");
      return;
    }

    try {
      await fontManager.generateSubset(text, outputDir);
      logger.success(`Font subset generated successfully`);
    } catch (error) {
      logger.error("Failed to generate font subset:", error);
      throw error;
    }
  }

  async renderWithFont(templatePath, data = {}, options = {}) {
    const result = this.render(templatePath, data, options);

    if (!result) {
      return null;
    }

    if (options.fontText) {
      const fontOutputDir = options.fontOutputDir || null;
      await this.packFont(options.fontText, fontOutputDir);
    }

    return result;
  }
}

module.exports = new TemplateRenderer();
