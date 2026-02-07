const { marked } = require("marked");
const sanitizeHtml = require("sanitize-html");
const assert = require("assert");

console.log("Running Markdown Rendering Tests...");

// Test 1: Basic Markdown Rendering
const markdownInput = "# Hello World\nThis is a **bold** text.";
const expectedHtmlPartial = "<h1>Hello World</h1>";
const rawHtml = marked.parse(markdownInput);

try {
    assert.ok(rawHtml.includes("<h1>Hello World</h1>"), "Should render H1");
    assert.ok(rawHtml.includes("<strong>bold</strong>"), "Should render bold");
    console.log("✅ Test 1 Passed: Basic Markdown Rendering");
} catch (e) {
    console.error("❌ Test 1 Failed:", e.message);
    process.exit(1);
}

// Test 2: XSS Sanitization
const maliciousMarkdown = "Click [here](javascript:alert('XSS')) <script>alert('XSS')</script>";
const sanitizedHtml = sanitizeHtml(marked.parse(maliciousMarkdown));

try {
    assert.ok(!sanitizedHtml.includes("<script>"), "Should remove script tags");
    assert.ok(!sanitizedHtml.includes("javascript:alert"), "Should remove javascript links");
    console.log("✅ Test 2 Passed: XSS Sanitization");
} catch (e) {
    console.error("❌ Test 2 Failed:", e.message);
    process.exit(1);
}

// Test 3: Graceful handling of empty input
const emptyInput = "";
const emptyOutput = sanitizeHtml(marked.parse(emptyInput));

try {
    assert.strictEqual(emptyOutput.trim(), "", "Should return empty string for empty input");
    console.log("✅ Test 3 Passed: Empty Input Handling");
} catch (e) {
    console.error("❌ Test 3 Failed:", e.message);
    process.exit(1);
}

console.log("All tests passed successfully!");
