const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");
const config = require("../../common/lib/config");
const { logger } = require("../../common/lib/utils");
const { PROJECT_ROOT, WEB_DIR } = require("../../common/lib/constants");
const fontManager = require("../../common/lib/font-manager");

class BlogManager {
  constructor() {
    // Config should provide absolute or relative path to blog source
    // Assuming config.blog.dir is relative to project root or generator root
    // Let's resolve it against PROJECT_ROOT
    this.blogSourceDir = config.blog.dir
      ? path.resolve(PROJECT_ROOT, config.blog.dir)
      : path.join(PROJECT_ROOT, "blog_source");
    this.webBlogDir = path.join(WEB_DIR, "blog");
  }

  async process() {
    if (!fs.existsSync(this.blogSourceDir)) {
      logger.warn(`Blog source directory not found: ${this.blogSourceDir}`);
      return [];
    }

    const posts = [];
    // Structure: blog_source/YYYY-MM-DD/
    const dateDirs = fs.readdirSync(this.blogSourceDir);

    for (const dateDir of dateDirs) {
      const datePath = path.join(this.blogSourceDir, dateDir);
      if (!fs.statSync(datePath).isDirectory()) continue;

      // Inside dateDir, find .md file
      const files = fs.readdirSync(datePath);
      for (const file of files) {
        if (path.extname(file).toLowerCase() === ".md") {
          const post = await this.processPost(dateDir, file, datePath);
          if (post) posts.push(post);
        }
      }
    }

    // Sort by date descending
    return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async processPost(dateDir, filename, sourcePath) {
    const title = path.parse(filename).name;
    // Output: web/blog/YYYY-MM-DD/
    const targetDir = path.join(this.webBlogDir, dateDir);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Read Content
    const mdContent = fs.readFileSync(path.join(sourcePath, filename), "utf-8");
    const htmlContent = marked.parse(mdContent);

    // Summary
    const summary = this.extractSummary(htmlContent);

    // Assets handling
    // Copy all non-md files to targetDir
    const assets = fs.readdirSync(sourcePath).filter((f) => !f.endsWith(".md"));
    let cover = null;

    for (const asset of assets) {
      const srcAsset = path.join(sourcePath, asset);
      const destAsset = path.join(targetDir, asset);

      if (fs.statSync(srcAsset).isFile()) {
        fs.copyFileSync(srcAsset, destAsset);

        // Find first image as cover
        if (
          !cover &&
          [".jpg", ".png", ".jpeg", ".webp", ".gif"].includes(
            path.extname(asset).toLowerCase(),
          )
        ) {
          // Path relative to web root (for index page usage)
          // index page is at web/blog/index.html
          // image is at web/blog/YYYY-MM-DD/image.jpg
          // relative path: YYYY-MM-DD/image.jpg
          cover = `${dateDir}/${asset}`;
        }
      }
    }

    // Generate Font Subset for this post
    // Font output: web/blog/YYYY-MM-DD/fonts/fontname.ttf
    const fontDir = path.join(targetDir, "fonts");
    if (!fs.existsSync(fontDir)) {
      fs.mkdirSync(fontDir, { recursive: true });
    }

    const fontFilename = `${title}.ttf`;
    const navLinks = config.site.index?.links || [];
    const navText = navLinks.map((l) => l.text).join("");
    const text = title + mdContent + summary + (config.defaultAuthor || "") + navText;

    try {
      await fontManager.generateSubset(text, fontDir);
    } catch (e) {
      logger.error(`Failed to generate font for blog post ${title}:`, e);
    }

    return {
      id: `${dateDir}-${title}`,
      title,
      date: dateDir,
      author: config.defaultAuthor,
      content: htmlContent,
      summary,
      cover, // Relative to blog root (web/blog)
      link: `${dateDir}/${title}.html`, // Relative to blog root
      fontPath: `fonts/${fontFilename}`, // Relative to the HTML file
      destDir: targetDir,
      filename: `${title}.html`,
    };
  }

  extractSummary(html) {
    const match = html.match(/<p>(.*?)<\/p>/);
    return match
      ? match[1].replace(/<[^>]+>/g, "").substring(0, 200) + "..."
      : "";
  }
}

module.exports = new BlogManager();
