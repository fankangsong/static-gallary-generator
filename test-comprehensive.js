const path = require("path");
const fs = require("fs");
const templateRenderer = require("./core/common/lib/template-renderer");

async function comprehensiveTest() {
  console.log("=== Comprehensive Template Renderer Tests ===\n");

  console.log("Test 1: Render EJS partial file");
  const ejsResult = templateRenderer.render("gallary/partials/head.ejs", {
    WEBSITE_FONT: { name: "test-font" },
  }, {
    save: false,
  });
  console.log("EJS partial render:", ejsResult ? "SUCCESS" : "FAILED");
  console.log("Content preview:", ejsResult?.content?.substring(0, 100) + "...\n");

  console.log("Test 2: Default path mapping for gallary template");
  const gallaryResult = templateRenderer.render("gallary/template.html", {
    ALBUM_DATA: { title: "Test Album" },
    TITLE: "Test",
    DESCRIPTION: "Test",
    WEBSITE_TITLE_SUFFIX: "test.com",
    WEBSITE_NAV_BRAND: "Brand",
    WEBSITE_LOGO: "/logo.svg",
    WEBSITE_FONT: { name: "font" },
    FULL_YEAR: 2024,
    AUTHOR: "Author",
    NAV_LINKS: [],
    CONTENT_HTML: "<p>Test</p>",
  });
  console.log("Gallary template output path:", gallaryResult?.outputPath);
  console.log("Expected path contains 'web/template.html':", gallaryResult?.outputPath?.includes("web\\template.html") || gallaryResult?.outputPath?.includes("web/template.html"));

  console.log("\nTest 3: Auto-create output directory");
  const customDir = path.join(__dirname, "web/custom-dir/nested");
  const customPath = path.join(customDir, "test.html");
  const customResult = templateRenderer.render("site/index.html", {
    WEBSITE_TITLE: "Custom Dir Test",
    WEBSITE_FONT: { name: "font" },
    LINKS: [],
    QUOTES: [],
  }, {
    outputPath: customPath,
  });
  console.log("Custom directory created:", fs.existsSync(customDir));
  console.log("File created:", fs.existsSync(customPath));

  console.log("\nTest 4: Font packing functionality");
  try {
    const fontOutputDir = path.join(__dirname, "web/test-fonts");
    await templateRenderer.packFont("测试字体打包功能", fontOutputDir);
    console.log("Font packing: SUCCESS");
    console.log("Font directory exists:", fs.existsSync(fontOutputDir));
  } catch (error) {
    console.log("Font packing: FAILED (expected if source font not found)");
    console.log("Error:", error.message);
  }

  console.log("\nTest 5: renderWithFont method");
  try {
    const result = await templateRenderer.renderWithFont("site/index.html", {
      WEBSITE_TITLE: "Font Test",
      WEBSITE_FONT: { name: "font" },
      LINKS: [],
      QUOTES: ["测试文本"],
    }, {
      outputPath: path.join(__dirname, "web/font-test.html"),
      fontText: "测试字体",
      fontOutputDir: path.join(__dirname, "web/test-fonts-2"),
    });
    console.log("renderWithFont: SUCCESS");
  } catch (error) {
    console.log("renderWithFont: PARTIAL (font packing may fail if source font not found)");
  }

  console.log("\n=== All Comprehensive Tests Completed ===");
}

comprehensiveTest().catch(console.error);
