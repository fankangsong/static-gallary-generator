const fs = require("fs");
const path = require("path");
const config = require("../../common/lib/config");
const { WEB_DIR } = require("../../common/lib/constants");
const { logger } = require("../../common/lib/utils");

class SitemapGenerator {
  generate(albums, posts) {
    const baseUrl = config.website.url.startsWith("http")
      ? config.website.url
      : `https://${config.website.url}`;

    const urls = [];

    // 1. Static Pages
    urls.push({ loc: `${baseUrl}/`, priority: "1.0", changefreq: "daily" });
    urls.push({
      loc: `${baseUrl}/photography/`,
      priority: "0.8",
      changefreq: "weekly",
    });
    urls.push({
      loc: `${baseUrl}/blog/`,
      priority: "0.8",
      changefreq: "weekly",
    });
    urls.push({
      loc: `${baseUrl}/travel/`,
      priority: "0.8",
      changefreq: "monthly",
    });

    // 2. Albums
    albums.forEach((album) => {
      urls.push({
        loc: `${baseUrl}/photography/${album.id}/`,
        priority: "0.6",
        changefreq: "monthly",
        lastmod: album.date ? album.date.replace(/\./g, "-") : undefined,
      });
    });

    // 3. Blog Posts
    posts.forEach((post) => {
      // post.link is like "2023-10-27/title.html"
      // we want /blog/2023-10-27/title.html
      urls.push({
        loc: `${baseUrl}/blog/${post.link}`,
        priority: "0.6",
        changefreq: "monthly",
        lastmod: post.date, // YYYY-MM-DD
      });
    });

    // Generate XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    urls.forEach((u) => {
      xml += `
  <url>
    <loc>${u.loc}</loc>`;
      if (u.lastmod) {
        xml += `
    <lastmod>${u.lastmod}</lastmod>`;
      }
      if (u.changefreq) {
        xml += `
    <changefreq>${u.changefreq}</changefreq>`;
      }
      if (u.priority) {
        xml += `
    <priority>${u.priority}</priority>`;
      }
      xml += `
  </url>`;
    });

    xml += `
</urlset>`;

    // Write file
    const outputPath = path.join(WEB_DIR, "sitemap.xml");
    fs.writeFileSync(outputPath, xml);
    logger.success(`Generated sitemap.xml at ${outputPath} with ${urls.length} URLs`);
  }
}

module.exports = new SitemapGenerator();
