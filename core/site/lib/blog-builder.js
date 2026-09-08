const blogManager = require("./blog-manager");
const htmlGenerator = require("./html-generator");
const { logger } = require("../../common/lib/utils");

/**
 * 构建博客：处理文章 + 生成文章页与博客索引页。
 * M6-d：移除无人消费的 allText 拼接与死 navItems（原 nav.json 写入已被注释）。
 */
async function buildBlog() {
  logger.log("Processing Blog...");

  const posts = await blogManager.process();

  for (const post of posts) {
    htmlGenerator.generatePostHtml(post);
  }

  htmlGenerator.generateBlogIndexHtml(posts);

  return { posts };
}

module.exports = {
  buildBlog,
};
