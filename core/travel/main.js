const { logger } = require("../common/lib/utils");
const { buildMarkers, LOCAL_KML_PATH } = require("./build-markers");

/**
 * update:travel 命令入口。
 * core/main.js 分发时传入整个 argv 数组：args[0] 为命令名，args[1] 为可选 KML 来源
 * （URL 或本地路径）；未提供时回退 config.site.travel.kmlUrl，再回退本地壳文件。
 */
async function run(args = []) {
  const source = typeof args[1] === "string" && args[1] ? args[1] : null;
  logger.log(`🗺️  更新足迹数据（来源: ${source || LOCAL_KML_PATH}）`);

  try {
    const result = await buildMarkers({ source });
    if (!result) {
      // buildMarkers 内部已记录原因（无数据源 / 解析 0 点），以非 0 退出码告知 CI
      process.exitCode = 1;
    }
  } catch (err) {
    logger.error(`更新足迹数据失败: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = { run };
