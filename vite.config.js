import { defineConfig } from "vite";

export default defineConfig({
  // 配置开发服务器
  server: {
    // 端口号
    port: 3000,
    // 自动打开浏览器
    open: false,
    // 开启热更新 (默认开启，这里显式配置)
    hmr: true,
    // 监听所有地址，方便局域网访问
    host: true,
  },
  // 项目根目录 (默认为 process.cwd())
  root: "./web",
  // 静态资源服务目录
  publicDir: "public",
});
