const path = require("path");
const templateRenderer = require("./core/common/lib/template-renderer");

async function testTemplateRenderer() {
  console.log("=== Testing Template Renderer ===\n");

  console.log("Test 1: Render HTML template with default output path");
  const result1 = templateRenderer.render("site/index.html", {
    WEBSITE_TITLE: "Test Page",
    WEBSITE_FONT: { name: "test-font" },
    LINKS: [
      { text: "首页", url: "/" },
      { text: "博客", url: "/blog" },
    ],
    QUOTES: ["测试引用一", "测试引用二"],
  });
  console.log("Result 1:", result1 ? "SUCCESS" : "FAILED");
  console.log("Output path:", result1?.outputPath);

  console.log("\nTest 2: Render with custom output path");
  const result2 = templateRenderer.render("site/404.html", {
    TITLE: "404 Not Found",
    DESCRIPTION: "Page not found",
    WEBSITE_TITLE_SUFFIX: "test.com",
    WEBSITE_NAV_BRAND: "Test Brand",
    WEBSITE_LOGO: "/assets/logo.svg",
    WEBSITE_FONT: { name: "test-font" },
    FULL_YEAR: new Date().getFullYear(),
    AUTHOR: "Test Author",
    NAV_LINKS: [],
  }, {
    outputPath: path.join(__dirname, "web/test-404.html"),
  });
  console.log("Result 2:", result2 ? "SUCCESS" : "FAILED");
  console.log("Output path:", result2?.outputPath);

  console.log("\nTest 3: Batch render");
  const templates = [
    {
      templatePath: "site/index.html",
      data: { 
        WEBSITE_TITLE: "Batch Test 1", 
        WEBSITE_FONT: { name: "font" }, 
        LINKS: [{ text: "首页", url: "/" }],
        QUOTES: ["测试"],
      },
      options: { outputPath: path.join(__dirname, "web/batch-test-1.html") },
    },
    {
      templatePath: "site/404.html",
      data: { 
        TITLE: "Batch Test 2", 
        DESCRIPTION: "Test", 
        WEBSITE_TITLE_SUFFIX: "test.com", 
        WEBSITE_NAV_BRAND: "Brand", 
        WEBSITE_LOGO: "/logo.svg", 
        WEBSITE_FONT: { name: "font" }, 
        FULL_YEAR: 2024,
        AUTHOR: "Test Author",
        NAV_LINKS: [],
      },
      options: { outputPath: path.join(__dirname, "web/batch-test-2.html") },
    },
  ];
  const results = await templateRenderer.renderBatch(templates);
  console.log("Batch results:", results.filter(r => r !== null).length, "/", results.length, "templates rendered successfully");

  console.log("\n=== All Tests Completed ===");
}

testTemplateRenderer().catch(console.error);
