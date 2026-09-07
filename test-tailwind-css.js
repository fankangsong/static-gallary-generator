// H2 优化测试：Tailwind Play CDN -> 构建期静态 CSS
// 运行：node test-tailwind-css.js
// 断言任一失败即抛错，退出码非 0（遵循 L1：测试需带断言、失败可感知）
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const constants = require("./core/common/lib/constants");
const styleManager = require("./core/common/lib/style-manager");

const OUTPUT_CSS = path.join(constants.WEB_DIR, "assets", "css", "tailwind.css");
let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (e) {
    console.error(`❌ ${name}\n   ${e.message}`);
    throw e;
  }
}

// 1. 源码里不应再有 Play CDN 引用
check("templates 与 core 中已无 Play CDN 引用", () => {
  const roots = [constants.TEMPLATES_DIR, path.join(constants.PROJECT_ROOT, "core")];
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
        continue;
      }
      if (!/\.(html|ejs|js)$/.test(entry.name)) continue;
      const content = fs.readFileSync(p, "utf-8");
      if (/cdn\.tailwindcss|js\/vendor\/tailwindcss\.js/.test(content)) hits.push(p);
    }
  };
  roots.forEach(walk);
  assert.deepStrictEqual(hits, [], `仍存在引用：${hits.join(", ")}`);
});

check("vendor/tailwindcss.js 已删除", () => {
  const vendor = path.join(constants.ASSETS_DIR, "js", "vendor", "tailwindcss.js");
  assert.ok(!fs.existsSync(vendor), `文件仍存在：${vendor}`);
});

// 2. 两个 head.ejs 引入静态 CSS
check("两个 head.ejs 引入 /assets/css/tailwind.css 且位于 common.css 之后", () => {
  for (const rel of ["templates/gallary/partials/head.ejs", "templates/site/partials/head.ejs"]) {
    const file = path.join(constants.PROJECT_ROOT, rel);
    const content = fs.readFileSync(file, "utf-8");
    assert.ok(
      content.includes('href="/assets/css/tailwind.css"'),
      `${rel} 未引入 tailwind.css`
    );
    assert.ok(
      content.indexOf("/assets/css/common.css") <
        content.indexOf("/assets/css/tailwind.css"),
      `${rel} 中 tailwind.css 必须在 common.css 之后`
    );
  }
});

// 3. 构建并校验产物
(async () => {
  const result = await styleManager.build();

  check("styleManager.build() 返回产物信息", () => {
    assert.ok(result, "构建返回 null");
    assert.ok(result.sizeKb > 0, "产物为空");
    assert.strictEqual(result.outputPath, OUTPUT_CSS);
  });

  check("产物文件存在且远小于 Play CDN（488KB）", () => {
    assert.ok(fs.existsSync(OUTPUT_CSS), `产物不存在：${OUTPUT_CSS}`);
    assert.ok(result.sizeKb < 488, `产物 ${result.sizeKb}KB 未小于 488KB`);
  });

  const css = fs.readFileSync(OUTPUT_CSS, "utf-8");

  check("含 preflight 基础样式", () => {
    assert.ok(/\*,\s*::before,\s*::after|\bbox-sizing:\s*border-box/.test(css), "缺少 preflight");
  });

  check("含 typography 插件的 prose 类", () => {
    assert.ok(css.includes(".prose"), "缺少 .prose");
    assert.ok(css.includes("prose-headings"), "缺少 prose-headings 修饰符");
  });

  check("覆盖模板中的任意值类与运行时注入类", () => {
    // 任意值：templates/gallary/index_template.html:25 的 bg-[#F9F9F9]
    assert.ok(css.includes("F9F9F9"), "缺少 bg-[#F9F9F9]");
    // 任意值：templates/gallary/template.html:29 的 z-[60]
    assert.ok(css.includes("z-"), "缺少任意 z-index 类");
    // 运行时注入：templates/assets/js/gallery.js 的 translate-x-full / bg-white/90
    assert.ok(css.includes("translate-x-full"), "缺少 translate-x-full");
    // gradients：gallery.js:168 的 bg-gradient-to-t from-black/80
    assert.ok(css.includes("from-black"), "缺少 from-black/80");
    // footerClass：templates/gallary/template_magazine.html:255 的 bg-[#fdfbf7]
    assert.ok(css.includes("fdfbf7"), "缺少 bg-[#fdfbf7]");
  });

  check("已生成的页面不再引用 Play CDN", () => {
    if (!fs.existsSync(constants.WEB_DIR)) return;
    const hits = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith(".html") && fs.readFileSync(p, "utf-8").includes("tailwindcss.js"))
          hits.push(p);
      }
    };
    walk(constants.WEB_DIR);
    assert.deepStrictEqual(hits, [], `产物仍引用 CDN：${hits.join(", ")}`);
  });

  console.log(`\n🎉 H2 测试全部通过（${passed} 项），产物 ${result.sizeKb} KB / ${result.durationMs} ms`);
})().catch(() => {
  console.error("\n💥 H2 测试失败");
  process.exitCode = 1;
});
