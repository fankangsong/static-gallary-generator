const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CLEAR_DIR = [path.resolve(__dirname, "..", "web")];

async function clear(targetDir) {
  try {
    if (fs.existsSync(targetDir)) {
      console.log(`🗑 Clearing directory ${targetDir}...`);

      // Attempt to remove the directory and its contents entirely
      try {
        fs.rmSync(targetDir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      } catch (rmError) {
        console.warn(`⚠️ fs.rmSync failed: ${rmError.message}`);
        // Fallback for Windows EPERM/ENOTEMPTY issues
        if (process.platform === "win32") {
          console.log("⚠️ Trying Windows 'rmdir' command fallback...");
          try {
            execSync(`rmdir /s /q "${targetDir}"`);
          } catch (execError) {
            throw new Error(`System command failed: ${execError.message}`);
          }
        } else {
          throw rmError;
        }
      }

      // Recreate the empty directory
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`✅ Cleared and recreated ${targetDir}`);
    } else {
      console.log(`Directory ${targetDir} does not exist. Creating it...`);
      fs.mkdirSync(targetDir, { recursive: true });
    }
    console.log("✅ Clear done.");
  } catch (error) {
    console.error("❌ Clear error:", error);
  }
}

CLEAR_DIR.forEach((dir) => clear(dir));
