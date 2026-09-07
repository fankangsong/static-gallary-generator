const fs = require("fs");
const path = require("path");
const { PROJECT_ROOT, WEB_DIR } = require("./constants");
const { logger } = require("./utils");

const INPUT_CSS = path.join(PROJECT_ROOT, "styles", "tailwind.css");
const CONFIG_FILE = path.join(PROJECT_ROOT, "tailwind.config.js");
const OUTPUT_CSS = path.join(WEB_DIR, "assets", "css", "tailwind.css");

class StyleManager {
  constructor() {
    // 同一次进程内只构建一次（gallery / site 可能在同一流程里多次触发）
    this.built = false;
    this.result = null;
  }

  /**
   * 扫描模板与产物，构建期生成静态 Tailwind CSS。
   * @param {{ silent?: boolean }} options
   * @returns {Promise<{ outputPath: string, sizeKb: number, durationMs: number } | null>}
   */
  async build(options = {}) {
    const { silent = false } = options;

    if (this.built) return this.result;
    this.built = true;

    let postcss;
    let tailwindcss;
    let autoprefixer;
    try {
      postcss = require("postcss");
      tailwindcss = require("tailwindcss");
      autoprefixer = require("autoprefixer");
    } catch (e) {
      logger.error(
        "Tailwind 依赖缺失，无法生成静态 CSS。请执行：pnpm add -D tailwindcss@3.4.17 @tailwindcss/typography postcss autoprefixer",
      );
      logger.error(e.message);
      process.exitCode = 1;
      return null;
    }

    if (!fs.existsSync(INPUT_CSS)) {
      logger.error(`Tailwind 输入样式不存在: ${INPUT_CSS}`);
      process.exitCode = 1;
      return null;
    }

    const config = this.loadConfig();

    // content 使用相对路径（与 Tailwind CLI 惯例一致），相对 process.cwd() 解析
    const previousCwd = process.cwd();
    if (previousCwd !== PROJECT_ROOT) process.chdir(PROJECT_ROOT);

    const startedAt = Date.now();
    try {
      const css = await fs.promises.readFile(INPUT_CSS, "utf-8");
      const plugins = [tailwindcss(config)];
      if (autoprefixer) plugins.push(autoprefixer());

      const result = await postcss(plugins).process(css, {
        from: INPUT_CSS,
        to: OUTPUT_CSS,
      });

      await fs.promises.mkdir(path.dirname(OUTPUT_CSS), { recursive: true });
      await fs.promises.writeFile(OUTPUT_CSS, result.css, "utf-8");

      const durationMs = Date.now() - startedAt;
      const sizeKb = +(Buffer.byteLength(result.css, "utf-8") / 1024).toFixed(1);
      this.result = { outputPath: OUTPUT_CSS, sizeKb, durationMs };

      if (!silent) {
        logger.success(
          `Tailwind CSS generated: ${path.relative(PROJECT_ROOT, OUTPUT_CSS)} (${sizeKb} KB, ${durationMs} ms)`,
        );
      }
      return this.result;
    } catch (e) {
      logger.error("Tailwind CSS 生成失败：", e.message);
      process.exitCode = 1;
      return null;
    } finally {
      if (process.cwd() !== previousCwd) process.chdir(previousCwd);
    }
  }

  loadConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
      logger.warn(`未找到 ${path.basename(CONFIG_FILE)}，使用内置默认配置。`);
      return {
        content: [
          "./templates/**/*.html",
          "./templates/**/*.ejs",
          "./templates/assets/js/*.js",
          "./core/**/*.js",
          "./web/**/*.html",
        ],
        plugins: [require("@tailwindcss/typography")],
      };
    }
    return require(CONFIG_FILE);
  }
}

module.exports = new StyleManager();
