const path = require("path");
const config = require("../../common/lib/config");
const { WEB_DIR } = require("../../common/lib/constants");
const { logger } = require("../../common/lib/utils");
const templateRenderer = require("../../common/lib/template-renderer");

class HtmlGenerator {
  generatePostHtml(post) {
    const templateName = config.blog.template || "blog/post";

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
      NAV_LINKS: config.site.nav || [],
    };

    const htmlPath = path.join(post.destDir, post.filename);

    templateRenderer.render(templateName + ".html", data, {
      outputPath: htmlPath,
    });

    logger.log(`  📝 Generated Blog Post: ${post.link}`);
  }

  async generateBlogIndexHtml(posts) {
    const templateName = config.blog.indexTemplate || "blog/index";

    // Update posts links to include date directory if needed
    const postsWithUpdatedLinks = posts.map((post) => {
      return post;
    });

    // Group posts by month
    const postsByMonth = {};
    postsWithUpdatedLinks.forEach((post) => {
      const monthKey = post.date.substring(0, 7); // YYYY-MM
      if (!postsByMonth[monthKey]) {
        postsByMonth[monthKey] = [];
      }
      postsByMonth[monthKey].push(post);
    });

    const groupedPosts = Object.keys(postsByMonth)
      .sort((a, b) => b.localeCompare(a))
      .map((monthKey) => {
        const parts = monthKey.split("-");
        let year = parts[0];
        let month = parts[1];

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
      NAV_LINKS: config.site.nav || [],
    };

    const blogIndexDir = path.join(WEB_DIR, "blog");
    const htmlPath = path.join(blogIndexDir, "index.html");

    // Font subsetting
    const navLinks = config.site.nav || [];
    const navText = navLinks.map((l) => l.text).join("");
    const text =
      posts.map((p) => p.title + (p.summary || "")).join("\n") +
      (config.defaultAuthor || "") +
      navText;

    await templateRenderer.renderWithFont(templateName + ".html", data, {
      outputPath: htmlPath,
      fontText: text,
      fontOutputDir: path.join(WEB_DIR, "assets/fonts/site/"),
    });

    logger.log(`🌐 Generated web/blog/index.html with ${posts.length} posts`);
  }
}

module.exports = new HtmlGenerator();
