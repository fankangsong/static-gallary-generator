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

class HtmlGenerator {
  generatePostHtml(post) {
    const templateName = config.blog.template || "blog_post";
    let templatePath = path.join(SITE_TEMPLATES_DIR, `${templateName}.html`);

    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(COMMON_TEMPLATES_DIR, `${templateName}.html`);
    }

    if (!fs.existsSync(templatePath)) {
      logger.error(`Template not found: ${templatePath}`);
      return;
    }

    const htmlTemplate = fs.readFileSync(templatePath, "utf-8");

    const data = {
      POST: post,
      TITLE: post.title,
      CONTENT_HTML: post.content,
      SUMMARY: post.summary,
      DATE: post.date,
      COVER: post.cover,
      DESCRIPTION:
        post.summary ||
        config.website.blogDescription ||
        config.website.description ||
        "Blog Post",
      WEBSITE_TITLE_SUFFIX: config.website.url,
      WEBSITE_NAV_BRAND: config.gallery.navBrand,
      WEBSITE_LOGO: config.gallery.logo,
      WEBSITE_FONT: config.website.font,
      FULL_YEAR: new Date().getFullYear(),
      AUTHOR: post.author || config.defaultAuthor,
      NAV_LINKS: config.site.index?.links || [],
    };

    const options = {
      root: [SITE_TEMPLATES_DIR, COMMON_TEMPLATES_DIR, GALLERY_TEMPLATES_DIR],
      filename: templatePath,
    };

    const htmlContent = ejs.render(htmlTemplate, data, options);
    const htmlPath = path.join(post.destDir, post.filename);
    fs.writeFileSync(htmlPath, htmlContent);
    logger.log(`  📝 Generated Blog Post: ${post.link}`);
  }

  async generateBlogIndexHtml(posts) {
    const templateName = config.blog.indexTemplate || "blog_index";
    let templatePath = path.join(SITE_TEMPLATES_DIR, `${templateName}.html`);

    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(COMMON_TEMPLATES_DIR, `${templateName}.html`);
    }

    if (!fs.existsSync(templatePath)) {
      logger.warn(`Blog index template not found: ${templatePath}`);
      return;
    }

    const htmlTemplate = fs.readFileSync(templatePath, "utf-8");

    // Ensure blog output dir exists (web/blog)
    const blogIndexDir = path.join(WEB_DIR, "blog");
    if (!fs.existsSync(blogIndexDir)) {
      fs.mkdirSync(blogIndexDir, { recursive: true });
    }

    // Update posts links to include date directory if needed
    // Assuming post.date is YYYY-MM-DD and structure is web/blog/YYYY-MM-DD/filename
    const postsWithUpdatedLinks = posts.map((post) => {
      // If post.link already contains the full relative path, we might not need to change it.
      // But let's ensure it matches the directory structure web/blog/DATE/filename
      // Currently post.link is likely just the filename or date/filename depending on how it was constructed.
      // Let's check where post.link is constructed -> blog-manager.js
      return post;
    });

    // Group posts by month
    const postsByMonth = {};
    postsWithUpdatedLinks.forEach((post) => {
      // post.date format is YYYY-MM-DD
      const monthKey = post.date.substring(0, 7); // YYYY-MM
      if (!postsByMonth[monthKey]) {
        postsByMonth[monthKey] = [];
      }
      postsByMonth[monthKey].push(post);
    });

    const groupedPosts = Object.keys(postsByMonth)
      .sort((a, b) => b.localeCompare(a)) // Sort months descending
      .map((monthKey) => {
        // monthKey format expected: YYYY-MM
        // But sometimes it might be just YYYY if folder structure is not strict YYYY-MM
        const parts = monthKey.split("-");
        let year = parts[0];
        let month = parts[1];

        // Fallback if month is undefined (e.g. folder is just "2023")
        if (!month) {
          month = "All"; 
        }

        let monthLabel = "";
        if (month && month !== "All") {
             monthLabel = `${year}年${month}月`;
        } else {
             monthLabel = `${year}年`; 
        }

        return {
          monthLabel: monthLabel,
          year: year,
          month: month === "All" ? "" : month, 
          posts: postsByMonth[monthKey], 
        };
      });

    const data = {
      POSTS: postsWithUpdatedLinks,
      GROUPED_POSTS: groupedPosts,
      TITLE: config.site.blog?.title || "随笔",
      DESCRIPTION: config.site.blog?.description || "随笔",
      WEBSITE_TITLE_SUFFIX: config.website.url,
      WEBSITE_NAV_BRAND: config.gallery.navBrand,
      WEBSITE_LOGO: config.gallery.logo,
      WEBSITE_FONT: config.website.font,
      FULL_YEAR: new Date().getFullYear(),
      AUTHOR: config.defaultAuthor,
      WEBSITE_BRAND_DESCRIPTION: config.gallery.brandDescription,
      NAV_LINKS: config.site.index?.links || [],
    };

    const options = {
      root: [SITE_TEMPLATES_DIR, COMMON_TEMPLATES_DIR, GALLERY_TEMPLATES_DIR],
      filename: templatePath,
    };

    const htmlContent = ejs.render(htmlTemplate, data, options);
    const htmlPath = path.join(blogIndexDir, "index.html");
    fs.writeFileSync(htmlPath, htmlContent);
    logger.log(`🌐 Generated web/blog/index.html with ${posts.length} posts`);

    // 为首页生成字体子集
    const navLinks = config.site.index?.links || [];
    const navText = navLinks.map((l) => l.text).join("");
    const text =
      posts.map((p) => p.title).join("\n") + (config.defaultAuthor || "") + navText;

    try {
      await fontManager.generateSubset(
        text,
        path.join(WEB_DIR, "assets/fonts/site/"),
      );
    } catch (e) {
      logger.error(`Failed to generate font for blog index:`, e);
    }
  }
}

module.exports = new HtmlGenerator();
