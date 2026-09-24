const fs = require("fs");
const { WEB_DIR } = require("../common/lib/constants");
const { logger } = require("../common/lib/utils");
const resourceManager = require("../common/lib/resource-manager");
const styleManager = require("../common/lib/style-manager");
const pageGenerator = require("./lib/page-generator");

/**
 * 首页（时间轴）单独构建：只做首页需要的那三件事，不碰博客、旅行 markers、sitemap 与其余静态页。
 * 改 data-source/timeline.json 或 templates/site/index.html 后用它快速迭代。
 *
 *   1. 发布 /assets/**（common.css、favicon 等首页引用的静态资源）
 *   2. 只渲染 config.site.pages 里 name=index 的那一页
 *      —— 发布 data-source/timeline 的照片 → 内联 JSON 到 #tl-data → 重裁 /assets/fonts/index/
 *   3. 构建 tailwind.css（首页 head 里引了它，与 build:gallary / build:site 末尾一致）
 */
async function run() {
  logger.log("🚀 Starting home page build...");

  if (!fs.existsSync(WEB_DIR)) fs.mkdirSync(WEB_DIR, { recursive: true });

  resourceManager.copyResources({ silent: true });

  await pageGenerator.generate({ only: ["index"] });

  await styleManager.build();

  logger.success("Home page build complete!");
}

module.exports = { run };
