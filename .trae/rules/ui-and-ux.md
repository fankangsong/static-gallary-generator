## UI and UX Design Principles

主要指导 AI 进行界面设计和交互体验的构建。

### 1. 技术选型与实现方式

- **TailwindCSS**: 必须使用 TailwindCSS 作为唯一的样式解决方案。
- **Utility-First**: 直接在 HTML 标签中使用 Utility classes，避免编写自定义 CSS 文件。
- **Static HTML**: UI 结构基于静态 HTML 构建，保持语义化和可访问性。

### 2. 设计风格指南

- **简洁现代**: 追求简洁、干净的视觉风格，留白充足。
- **响应式设计 (Responsive)**: 必须优先考虑移动端体验，使用 Tailwind 的响应式前缀（如 `md:`, `lg:`）适配不同屏幕。
- **交互体验**: 使用简单的 CSS transition 实现平滑的交互效果（如 hover, focus 状态）。

### 3. UI 模板示例

**基本页面结构**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App Title</title>
    <!-- 引入 Tailwind -->
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-gray-50 text-gray-900 font-sans antialiased">
    <!-- 导航栏 -->
    <nav class="bg-white shadow-sm sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <span class="text-xl font-bold text-blue-600">Logo</span>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主内容 -->
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div class="px-4 py-6 sm:px-0">
        <div
          class="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center"
        >
          <p class="text-gray-500">Content Area</p>
        </div>
      </div>
    </main>
  </body>
</html>
```
