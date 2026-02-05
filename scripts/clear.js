const fs = require("fs");
const path = require("path");

const CLEAR_DIR = ["web/config", "web/data", "web/fonts", "web/images"];

async function clear() {
  try {
    const htmlFiles = fs.readdirSync(path.resolve(__dirname, "..", "web"));
    htmlFiles.forEach((file) => {
      if (file.endsWith(".html")) {
        const absPath = path.resolve(__dirname, "..", "web", file);
        fs.rmSync(absPath, { recursive: true, force: true });
        console.log(`Clear ${absPath}`);
      }
    });
    CLEAR_DIR.forEach((dir) => {
      const absPath = path.resolve(__dirname, "..", dir);
      fs.rmSync(absPath, { recursive: true, force: true });
      console.log(`Clear ${absPath}`);
    });
    console.log("Clear done.");
  } catch (error) {
    console.error("Clear error:", error);
  }
}
clear();
