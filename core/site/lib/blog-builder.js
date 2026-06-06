const fs = require("fs");
const path = require("path");
const config = require("../../common/lib/config");
const blogManager = require("./blog-manager");
const htmlGenerator = require("./html-generator");
const { CONFIG_DIR } = require("../../common/lib/constants");
const { logger } = require("../../common/lib/utils");

async function buildBlog(allText, albums) {
  logger.log("Processing Blog...");

  const posts = await blogManager.process();

  for (const post of posts) {
    htmlGenerator.generatePostHtml(post);
    allText += post.title + post.summary;
  }

  htmlGenerator.generateBlogIndexHtml(posts);

  const navItems = albums.map((a) => ({ title: a.title, link: a.link }));
  navItems.push({
    title: config.site.blog?.title,
    link: "blog/index.html",
  });

  // const navJsonPath = path.join(CONFIG_DIR, "nav.json");
  // fs.writeFileSync(navJsonPath, JSON.stringify(navItems, null, 2));
  // logger.success(`Generated nav.json with ${navItems.length} items`);

  albums.forEach((a) => (allText += a.title));

  return { allText, posts };
}

module.exports = {
  buildBlog,
};
