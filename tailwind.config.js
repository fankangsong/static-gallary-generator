/**
 * Tailwind 配置（H2：替换 Play CDN 为构建期静态 CSS）
 *
 * 说明：
 * - content 使用相对路径，由 core/common/lib/style-manager.js 在 PROJECT_ROOT 下解析
 * - 刻意不扫描 templates/assets/js/vendor/** 与 templates/assets/data/**，
 *   其中有 globe.gl.min.js(1.88MB)、highlight.min.js、tailwindcss.js 等大文件
 * - web/**\/*.html 为构建产物，扫描它可以捕获 markdown 正文里内联 HTML 用到的类名
 *   （博客源文件在仓库外的 ../blog-post，无法通过模板扫描覆盖）
 */
module.exports = {
  content: [
    "./templates/**/*.html",
    "./templates/**/*.ejs",
    "./templates/assets/js/*.js",
    "./core/**/*.js",
    "./web/**/*.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
