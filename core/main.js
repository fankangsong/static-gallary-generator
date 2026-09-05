const fs = require("fs");
const path = require("path");
const { logger } = require("./common/lib/utils");
const galleryMain = require("./gallery/main");
const siteMain = require("./site/main");
const picturesMain = require("./pictures/main");
const travelMain = require("./travel/main");

async function clearBuild() {
  logger.log("🧹 Clearing generated files...");
  const { WEB_DIR, TEMP_DIR } = require("./common/lib/constants");

  if (fs.existsSync(WEB_DIR)) {
    fs.rmSync(WEB_DIR, { recursive: true, force: true });
    logger.log(`Removed ${WEB_DIR}`);
  }

  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    logger.log(`Removed ${TEMP_DIR}`);
  }
  logger.success("Clean complete.");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "index:gallary":
    case "build:gallary":
      await galleryMain.run(args);
      break;
    case "build:site":
    case "build:blog":
      await siteMain.run(args);
      break;
    case "build:pictures":
      await picturesMain.run(args);
      break;
    case "update:travel":
      await travelMain.run(args);
      break;
    case "clear":
      await clearBuild();
      break;
    default:
      logger.error(
        "Unknown command. Available: index:gallary, build:gallary, build:site, build:pictures, update:travel, clear",
      );
      process.exit(1);
  }
}

main().catch((err) => logger.error(err));
