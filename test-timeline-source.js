const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseContent, parseCoordLine } = require("./core/timeline/lib/content-parser");
const { parseDirName, scanSource } = require("./core/timeline/lib/source-scanner");
const timelineMain = require("./core/timeline/main");
const pageGenerator = require("./core/site/lib/page-generator");

/**
 * build:timeline 的契约测试：
 *   1. md 解析：标题 / 正文 / 位置区块（坐标 + 地址）与各种容错
 *   2. 目录名解析：2026-09-21 / 2026-09-21 0730 / 2026-09-21-1830，非法日期与非法时间
 *   3. 目录扫描：图片自然序、非日期目录与散落文件被跳过并计数
 *   4. CLI 产出：写到指定文件、日期倒序、空字段不写键、photos 前缀
 *   5. publishAssets 的 ext 过滤：只发布图片，md 原文不进产物
 *
 * 全程使用一次性 fixture（os.tmpdir + data-source 下的临时目录），结束即清理。
 */

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  if (ok) pass++;
  else fail++;
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "timeline-src-"));
const tmpOut = path.join(tmpRoot, "generated.json");
const repoFixtures = [
  path.join(__dirname, "data-source/.timeline-test-src"),
  path.join(__dirname, "web/assets/timeline/__test__"),
  path.join(__dirname, "web/assets/timeline/__test__all"),
];

function writeFixture(relPath, content) {
  const target = path.join(tmpRoot, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf-8");
}

function fixtureMd({ title, paragraphs = [], locationTitle = "## 位置信息：", block = null }) {
  const parts = [];
  if (title) parts.push(`# ${title}`, "");
  paragraphs.forEach((p) => parts.push(p, ""));
  if (block) parts.push(locationTitle, "", "```", ...block, "```");
  return parts.join("\n") + "\n";
}

async function main() {
  console.log("=== Testing timeline source → timeline.json (build:timeline) ===\n");

  /* ---------------- 1. md 解析 ---------------- */
  const full = parseContent(
    fixtureMd({
      title: "晨跑之后的湖面",
      paragraphs: ["六点出门，白堤上已经有雾。", "跑到断桥折返，太阳刚从保俶塔后面露头。"],
      block: ["113.123456,22.123456", "广东省深圳市盐田区大梅沙"],
    }),
    { context: "case-full" },
  );
  check("解析标题（首个 # 标题）", full.title === "晨跑之后的湖面", full.title);
  check("解析正文（空行分隔的两段）", full.text === "六点出门，白堤上已经有雾。\n\n跑到断桥折返，太阳刚从保俶塔后面露头。", JSON.stringify(full.text));
  check("解析地址（代码块第二行）", full.location === "广东省深圳市盐田区大梅沙", full.location);
  check("解析坐标（经度,纬度）", JSON.stringify(full.coord) === "[113.123456,22.123456]", JSON.stringify(full.coord));

  const swapped = parseContent(
    fixtureMd({ paragraphs: ["正文。"], block: ["22.5,113.5", "浙江省杭州市西湖区"] }),
    { context: "case-swapped" },
  );
  check("坐标写成「纬度,经度」时自动交换", JSON.stringify(swapped.coord) === "[113.5,22.5]", JSON.stringify(swapped.coord));

  const noBlock = parseContent(fixtureMd({ paragraphs: ["只有正文，没有位置区块。"] }), { context: "case-no-block" });
  check("缺位置区块时 location / coord 缺省", noBlock.location === "" && noBlock.coord === null);
  check("缺位置区块时正文完整保留", noBlock.text === "只有正文，没有位置区块。", JSON.stringify(noBlock.text));

  const textOnly = parseContent(
    fixtureMd({ paragraphs: ["正文第一段。", "正文第二段。"], block: ["浙江省杭州市西湖区"] }),
    { context: "case-text-block" },
  );
  check("代码块首行不是坐标时整块作地址", textOnly.location === "浙江省杭州市西湖区" && textOnly.coord === null, textOnly.location);

  const crlf = parseContent("# 标题\r\n\r\n正文。\r\n\r\n## 位置：\r\n\r\n```\r\n1.5,2.5\r\n某地\r\n```\r\n", { context: "case-crlf" });
  check("兼容 CRLF 换行", crlf.title === "标题" && crlf.text === "正文。" && crlf.location === "某地", `${crlf.title}|${crlf.text}|${crlf.location}`);

  check("全角逗号坐标可用", JSON.stringify(parseCoordLine("113.1，22.2").coord) === "[113.1,22.2]");
  check("坐标行不是两个数时不误判", parseCoordLine("广东省深圳市").coord === null);

  /* ---------------- 2. 目录名解析 ---------------- */
  check("目录名 2026-09-21 → 只有日期", JSON.stringify(parseDirName("2026-09-21")) === '{"date":"2026-09-21","time":""}', JSON.stringify(parseDirName("2026-09-21")));
  check("目录名 2026-09-21 0730 → 07:30", parseDirName("2026-09-21 0730").time === "07:30");
  check("目录名 2026-09-21-1830 → 18:30", parseDirName("2026-09-21-1830").time === "18:30");
  check("目录名 2026-09-21 18:30 → 18:30", parseDirName("2026-09-21 18:30").time === "18:30");
  check("非法日期 2026-02-30 被拒", parseDirName("2026-02-30") === null);
  check("非法时间 2026-09-21 2560 被拒", parseDirName("2026-09-21 2560") === null);
  check("非日期目录 notes 被拒", parseDirName("notes") === null);

  /* ---------------- 3. 目录扫描 ---------------- */
  writeFixture(
    "2026-09-21 0730/content.md",
    fixtureMd({ title: "晨跑之后的湖面", paragraphs: ["正文一段。"], block: ["113.1,22.1", "广东省深圳市盐田区大梅沙"] }),
  );
  ["p1.jpg", "p2.jpg", "p10.jpg"].forEach((name) => writeFixture(`2026-09-21 0730/${name}`, "x"));
  writeFixture("2026-09-21 0730/note.txt", "不是图片");

  writeFixture("2026-09-25/content.md", fixtureMd({ paragraphs: ["没有图片的一条。"] }));
  writeFixture("2026-09-18/content.md", fixtureMd({ paragraphs: ["坐标写反的一条。"], block: ["22.5,113.5", "浙江省杭州市西湖区"] }));
  writeFixture("2026-09-06/content.md", fixtureMd({ paragraphs: ["只有正文。"] }));
  writeFixture("2026-09-11/content.md", fixtureMd({ paragraphs: ["地址块里没有坐标。"], block: ["上海市黄浦区"] }));
  writeFixture("notes/readme.md", "不是日期目录");
  writeFixture("2026-13-40/content.md", "非法日期目录");
  writeFixture("readme.txt", "散落在根目录的文件");

  const scan = scanSource(tmpRoot);
  check("扫描出 5 条记录", scan.records.length === 5, `${scan.records.length} 条`);
  check(
    "跳过非日期目录 / 非法日期 / 根目录散落文件",
    scan.skipped.length === 3 && scan.skipped.some((s) => s.name === "notes") && scan.skipped.some((s) => s.name === "2026-13-40"),
    JSON.stringify(scan.skipped),
  );
  const withImages = scan.records.find((r) => r.dirName === "2026-09-21 0730");
  check(
    "图片按文件名自然序（p1 < p2 < p10），且只收图片",
    JSON.stringify(withImages.images) === '["p1.jpg","p2.jpg","p10.jpg"]',
    JSON.stringify(withImages.images),
  );
  check("目录名里的时间被解析", withImages.time === "07:30", withImages.time);
  check("无 md 时不报错（本次都有 md，这里只验证字段缺省路径）", scan.records.find((r) => r.dirName === "2026-09-06").location === "");

  /* ---------------- 4. CLI 产出 ---------------- */
  check(
    "photos 前缀取自 config 的 publish 映射",
    timelineMain.resolvePhotoPrefix("data-source/timeline/org") === "org",
    timelineMain.resolvePhotoPrefix("data-source/timeline/org"),
  );
  const record = timelineMain.toRecord({ date: "2026-09-21", time: "07:30", dirName: "2026-09-21 0730", images: ["p1.jpg"], title: "T", text: "", location: "", coord: null }, "org");
  check("空字段不写键（text/location/coord 均缺省）", !("text" in record) && !("location" in record) && !("coord" in record), JSON.stringify(record));
  check("photos 路径 = 前缀/目录名/文件名", record.photos[0] === "org/2026-09-21 0730/p1.jpg", record.photos[0]);

  await timelineMain.run(["build:timeline", `--src=${tmpRoot}`, `--out=${tmpOut}`]);
  check("CLI 写出生成文件", fs.existsSync(tmpOut));
  const generated = JSON.parse(fs.readFileSync(tmpOut, "utf-8"));
  const dates = generated.map((r) => `${r.date}${r.time ? " " + r.time : ""}`);
  check(
    "生成结果按日期倒序（最新在前）",
    JSON.stringify(dates) === JSON.stringify(["2026-09-25", "2026-09-21 07:30", "2026-09-18", "2026-09-11", "2026-09-06"]),
    dates.join(" > "),
  );
  check("坐标写反的那条已交换", JSON.stringify(generated.find((r) => r.date === "2026-09-18").coord) === "[113.5,22.5]");
  check("无位置区块的那条不带 location / coord", !("location" in generated.find((r) => r.date === "2026-09-06")));

  /* ---------------- 5. publishAssets 的 ext 过滤 ---------------- */
  const srcFixture = path.join(__dirname, "data-source/.timeline-test-src");
  fs.mkdirSync(path.join(srcFixture, "2026-09-21 0730"), { recursive: true });
  fs.writeFileSync(path.join(srcFixture, "2026-09-21 0730/content.md"), "# 标题\n", "utf-8");
  fs.writeFileSync(path.join(srcFixture, "2026-09-21 0730/p1.jpg"), "x");
  fs.writeFileSync(path.join(srcFixture, "2026-09-21 0730/p2.png"), "x");

  pageGenerator.publishAssets([
    { from: "data-source/.timeline-test-src", to: "assets/timeline/__test__", ext: [".jpg", ".jpeg", ".png", ".webp"] },
  ]);
  check(
    "publish 带 ext：只发布图片，md 原文不进产物",
    fs.existsSync(path.join(__dirname, "web/assets/timeline/__test__/2026-09-21 0730/p1.jpg")) &&
      fs.existsSync(path.join(__dirname, "web/assets/timeline/__test__/2026-09-21 0730/p2.png")) &&
      !fs.existsSync(path.join(__dirname, "web/assets/timeline/__test__/2026-09-21 0730/content.md")),
  );

  pageGenerator.publishAssets([{ from: "data-source/.timeline-test-src", to: "assets/timeline/__test__all" }]);
  check(
    "publish 不带 ext：整棵拷贝（向后兼容）",
    fs.existsSync(path.join(__dirname, "web/assets/timeline/__test__all/2026-09-21 0730/content.md")),
  );

  console.log(`\n=== ${fail === 0 ? "All tests passed" : fail + " test(s) failed"} (${pass}/${pass + fail}) ===`);
  if (fail) process.exitCode = 1;
}

/**
 * 清理 fixture。部分环境会把 fs.rmSync 接管到「回收站」（safe-delete 垫片），
 * 回收站操作失败时会抛错，这里降级为 unlinkSync + rmdirSync 的递归删除，
 * 并保证清理失败不影响测试结论（只告警）。
 */
function removeTree(target, manualOnly = false) {
  if (!fs.existsSync(target)) return;

  if (!manualOnly) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      if (!fs.existsSync(target)) return;
    } catch (err) {
      console.warn(`⚠️  rmSync 清理失败，改用递归删除：${target}`);
    }
  }
  if (!fs.existsSync(target)) return;

  try {
    if (fs.lstatSync(target).isDirectory()) {
      fs.readdirSync(target).forEach((entry) => removeTree(path.join(target, entry), true));
      fs.rmdirSync(target);
    } else {
      fs.unlinkSync(target);
    }
  } catch (err) {
    console.warn(`⚠️  清理残留失败（可手工删除）：${target}`);
  }
}

main()
  .catch((err) => {
    console.error("Test crashed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    [tmpRoot, ...repoFixtures].forEach((target) => removeTree(target));
  });
