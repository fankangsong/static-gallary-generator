const fs = require("fs");
const path = require("path");
const config = require("./core/common/lib/config");
const homeBuild = require("./core/site/home");

/**
 * 首页单独构建（pnpm build:home）的契约测试：
 *   1. 只渲染首页，不重写其它页面
 *   2. 数据源 data-source/timeline.json 内联进 #tl-data，且按日期倒序（左新右旧）
 *   3. data-source/timeline 下的照片被发布到 web/assets/timeline/
 *   4. 生成首页字体子集（远小于源字体），且覆盖 JSON 里出现的全部中文字
 *      —— 这条是「从 .json 合成首页字体集」的核心断言，用极简 cmap 解析直接查码点
 *   5. 内联脚本里「缓存的图片同步 complete」这条路径不会把 null parentNode 传给 sizeStack
 *      —— 这是线上刷新空白（TypeError: ... 'inner.clientWidth'）的回归断言
 */

// 极简 TTF cmap 解析：只回答「某个码点有没有字形」，用于校验子集覆盖
function readCmapCodes(buffer) {
  const codes = new Set();
  const numTables = buffer.readUInt16BE(4);
  let cmapOffset = 0;

  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buffer.toString("ascii", rec, rec + 4) === "cmap") {
      cmapOffset = buffer.readUInt32BE(rec + 8);
      break;
    }
  }
  if (!cmapOffset) return codes;

  const subCount = buffer.readUInt16BE(cmapOffset + 2);
  for (let i = 0; i < subCount; i++) {
    const rec = cmapOffset + 4 + i * 8;
    const sub = cmapOffset + buffer.readUInt32BE(rec + 4);
    const format = buffer.readUInt16BE(sub);

    if (format === 4) {
      const segX2 = buffer.readUInt16BE(sub + 6);
      const segs = segX2 / 2;
      const endBase = sub + 14;
      const startBase = endBase + segX2 + 2;
      const deltaBase = startBase + segX2;
      const rangeBase = deltaBase + segX2;

      for (let s = 0; s < segs; s++) {
        const end = buffer.readUInt16BE(endBase + s * 2);
        const start = buffer.readUInt16BE(startBase + s * 2);
        const delta = buffer.readInt16BE(deltaBase + s * 2);
        const rangeOffset = buffer.readUInt16BE(rangeBase + s * 2);
        if (start === 0xffff) continue;

        for (let c = start; c <= end; c++) {
          let gid;
          if (rangeOffset === 0) {
            gid = (c + delta) & 0xffff;
          } else {
            const at = rangeBase + s * 2 + rangeOffset + (c - start) * 2;
            if (at + 1 >= buffer.length) continue;
            gid = buffer.readUInt16BE(at);
            if (gid !== 0) gid = (gid + delta) & 0xffff;
          }
          if (gid) codes.add(c);
        }
      }
    } else if (format === 12) {
      const groups = buffer.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const at = sub + 16 + g * 12;
        const start = buffer.readUInt32BE(at);
        const end = buffer.readUInt32BE(at + 4);
        for (let c = start; c <= end; c++) codes.add(c);
      }
    }
  }
  return codes;
}

async function testHomeBuild() {
  console.log("=== Testing home page build (build:home) ===\n");

  let pass = 0;
  let fail = 0;
  const check = (name, ok, detail = "") => {
    console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
    if (ok) pass++;
    else fail++;
  };

  const webDir = path.join(__dirname, "web");
  const indexPath = path.join(webDir, "index.html");
  const aboutPath = path.join(webDir, "about/index.html");
  const aboutMtime = fs.existsSync(aboutPath) ? fs.statSync(aboutPath).mtimeMs : null;

  await homeBuild.run();

  // 1. 产物存在，且引用的是子集而不是 33MB 源字体
  check("生成 web/index.html", fs.existsSync(indexPath));
  const html = fs.readFileSync(indexPath, "utf-8");
  // 只看「字体引用」本身：preload 与 @font-face 都指向子集目录，且不再引源字体路径
  // （模板 CSS 注释里出现「京華老宋体」是正常的，不能拿字面量当判据）
  check(
    "首页引 /assets/fonts/index/ 子集（未引源字体）",
    /href="\/assets\/fonts\/index\/[^"]+\.ttf"/.test(html) &&
      /url\('\/assets\/fonts\/index\/[^']+\.ttf'\)/.test(html) &&
      !html.includes("templates/assets/fonts"),
  );

  // 首页样式全部内联、不用任何 Tailwind 类；若仍引这份 79KB 的渲染阻塞样式，
  // 浏览器要等它下载完才首次绘制，刷新时会先白屏一下（见 head.ejs 的 tailwind: false）
  check("首页不引 tailwind.css（避免渲染阻塞样式拖慢首屏）", !html.includes("/assets/css/tailwind.css"));

  // 2. 数据内联 + 日期倒序（左新右旧）
  const match = /<script id="tl-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  check("数据内联进 #tl-data（无前端 fetch）", !!match && !html.includes('fetch("./timeline.json"'));
  const records = match ? JSON.parse(match[1].replace(/\\u003c/g, "<")) : [];
  const isEmpty = records.length === 0;

  if (isEmpty) {
    // 3a. 空数据：退化成一句空状态文案，导航与刻度轨保留，且不再用兜底弹层
    check("空数据渲染空状态文案", html.includes("这个人很懒，太久没更新了。"));
    check("空状态保留顶部导航", html.includes('class="nav-inner"') && html.includes("/about/"));
    check("空状态不显示操作提示行", !html.includes('class="hint"'));
    check("空状态不用兜底弹层（#boot 默认 hidden）", /id="boot" hidden/.test(html));
  } else {
    // 3b. 非空：条数、顺序（左新右旧）、照片发布
    check("记录条数 > 0", records.length > 0, `${records.length} 条`);
    const dates = records.map((r) => String(r.date || "").slice(0, 10));
    check(
      "记录按日期倒序（最新在最左）",
      dates.every((d, i) => i === 0 || dates[i - 1] >= d),
      dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : "",
    );

    const photos = records.flatMap((r) => r.photos || []);
    if (photos.length) {
      const missing = photos.filter(
        (p) => !fs.existsSync(path.join(webDir, "assets/timeline", p)),
      );
      check(
        "data-source/timeline 的照片已发布到 web/assets/timeline",
        missing.length === 0,
        `${photos.length} 张${missing.length ? "，缺 " + missing.join(",") : ""}`,
      );
    } else {
      console.log("ℹ️ 跳过「照片发布」：当前数据没有图片");
    }
  }

  // 4. 回归：图片命中 HTTP 缓存时 img.complete 为 true，buildCard 会在 card 尚未 appendChild
  //    时同步调用 applyRatio → sizeStack(card.parentNode)。parentNode 此时为 null，
  //    直接传进去会抛 "null is not an object (evaluating 'inner.clientWidth')"，
  //    render() 在清空 TRACK 之后中断，表现就是刷新后内容区空白（本地无缓存故不复现）。
  //    因此：同步路径必须仍在，且每一处 sizeStack(card.parentNode) 都要有 parentNode 判空。
  const bareCalls = (html.match(/sizeStack\(card\.parentNode\)/g) || []).length;
  const guardedCalls = (html.match(/if \(card\.parentNode\) sizeStack\(card\.parentNode\)/g) || []).length;
  check(
    "缓存的图片同步命中时 sizeStack 拿到的是已挂载的 parentNode",
    /if\s*\(\s*img\.complete\s*\)\s*applyRatio\(/.test(html) &&
      bareCalls > 0 &&
      bareCalls === guardedCalls,
    `sizeStack(card.parentNode) ${bareCalls} 处，其中判空 ${guardedCalls} 处`,
  );

  // 5. 字体子集：体积合理 + 覆盖 JSON 的全部中文字
  const subsetPath = path.join(webDir, "assets/fonts/index", `${config.website.font.name}.ttf`);
  const sourcePath = path.join(__dirname, config.website.font.source);
  check("生成首页字体子集", fs.existsSync(subsetPath));

  if (fs.existsSync(subsetPath) && fs.existsSync(sourcePath)) {
    const subSize = fs.statSync(subsetPath).size;
    const srcSize = fs.statSync(sourcePath).size;
    check(
      "子集远小于源字体",
      subSize > 10 * 1024 && subSize < srcSize / 10,
      `${(subSize / 1024).toFixed(0)}KB vs ${(srcSize / 1024 / 1024).toFixed(1)}MB`,
    );

    const codes = readCmapCodes(fs.readFileSync(subsetPath));
    const need = new Set();
    const collect = (text) => {
      for (const ch of text) {
        if (/[\u4e00-\u9fa5]/.test(ch)) need.add(ch.codePointAt(0));
      }
    };
    collect(JSON.stringify(records));
    // JS 运行时才渲染的文案（构建期从模板里取不到），在 config 的 UI_TEXT 里补
    collect(config.site.pages.find((p) => p.name === "index")?.data?.UI_TEXT || "");
    // 空状态那句文案写在模板里，构建期会一起取字：空数据时顺便断言它没回退到系统字体
    if (isEmpty) collect("这个人很懒，太久没更新了。");

    const lacked = [...need].filter((c) => !codes.has(c));
    check(
      "子集覆盖数据 JSON + UI_TEXT 里的全部中文字",
      lacked.length === 0,
      `${need.size} 字${lacked.length ? "，缺：" + lacked.map((c) => String.fromCodePoint(c)).join("") : ""}`,
    );
  }

  // 6. 只构建首页：其它页面不被重写
  if (aboutMtime) {
    check(
      "不重写其它页面（web/about/index.html 未变）",
      fs.statSync(aboutPath).mtimeMs === aboutMtime,
    );
  } else {
    console.log("ℹ️ 跳过「不重写其它页面」：web/about/index.html 尚不存在");
  }

  console.log(`\n=== ${fail === 0 ? "All tests passed" : fail + " test(s) failed"} (${pass}/${pass + fail}) ===`);
  if (fail) process.exitCode = 1;
}

testHomeBuild().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
