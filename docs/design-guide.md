# 设计规范

本文档定义项目的视觉与样式设计规范，确保生成的静态相册页面风格一致。

## 颜色系统

### 主题色

| 用途 | 颜色值 | Tailwind 类 |
|------|--------|-------------|
| 默认背景 | `#ffffff` | `bg-white` |
| 杂志背景 | `#fdfbf7` | `bg-[#fdfbf7]` (暖色调纸张质感) |
| 主文字 | `#111827` | `text-gray-900` |
| 次级文字 | `#6b7280` | `text-gray-500` |
| 辅助文字 | `#9ca3af` | `text-gray-400` |

### 链接颜色

```css
a:link, a:visited { color: rgb(240, 80, 55); }      /* 主链接 - 红色 */
a:hover, a:focus  { color: rgb(247, 147, 131); }    /* hover - 浅红 */
```

### 渐变

- **Hero 渐变**: `bg-gradient-to-b from-black/40 via-transparent to-black/80`
- **Caption 渐变**: `bg-gradient-to-t from-black/60 to-transparent`

## 字体系统

### 字体栈

```css
font-family: 'Courier New', Courier, [自定义字体], monospace;
```

自定义字体通过 `generator/config.json` → `website.font` 配置，生成时自动加载。

### 字体渲染

```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### 字号规范

| 元素 | 默认模板 | 杂志模板 | Tailwind |
|------|----------|----------|----------|
| Hero 标题 | 5xl-8xl | 3.5rem | `text-5xl md:text-7xl lg:text-8xl` |
| 分组标题 | 2xl | 3xl | `text-2xl` / `text-3xl` |
| 正文 | prose-lg | prose-xl | `prose-lg` / `prose-xl` |
| Caption | 0.9rem | 0.9rem | 自定义 |
| Footer | sm | sm | `text-sm` |

### 字间距

- **标题**: `tracking-tight` 或 `tracking-wide`
- **大写标签**: `tracking-widest` / `tracking-[0.2em]`

## 布局与间距

### 容器宽度

| 用途 | 最大宽度 |
|------|----------|
| 页面主容器 | `max-w-7xl` (1280px) |
| Hero 内容 | `max-w-4xl` (896px) |
| 正文内容 | `max-w-3xl` (768px) / `max-w-2xl` (672px) |
| 杂志网格 | `max-w-[1600px]` |

### 导航栏

- **高度**: `h-20` (80px)
- **内边距**: `px-4 sm:px-6 lg:px-8`

### 响应式断点

| 断点 | 最小宽度 |
|------|----------|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |

### 图片网格

瀑布流布局配置：

```
columns-1 sm:columns-2 md:columns-3 lg:columns-4
gap-4                    (默认模板)
column-gap: 40px         (杂志模板，CSS 自定义)
```

## 动画与过渡

### 过渡时长

| 场景 | 时长 | Tailwind |
|------|------|----------|
| 快速交互 | 300ms | `duration-300` |
| 中等动画 | 500ms | `duration-500` |
| 入场动画 | 700ms | `duration-700` |
| 图片缩放 | 1000ms | `duration-1000` |

### 常用动画效果

**Hero 入场动画：**
```html
<!-- 背景 -->
opacity-0 → opacity-100, scale-105 → scale-100

<!-- 标题 -->
translate-y-8 opacity-0 → translate-y-0 opacity-100
```

**图片 Hover：**
```css
transform: scale(105%);
transition: transform 700ms;
filter: brightness(0.95);  /* 杂志模板 */
```

**导航栏滚动效果：**
- 滚动 > 50px: `bg-white/90 backdrop-blur-md shadow-sm text-gray-900`
- 滚动 <= 50px: `text-white` (透明背景)

## 组件样式

### 导航栏

**固定定位：**
```html
fixed top-0 left-0 right-0 z-50 transition-all duration-300
```

**Logo 容器：**
- 默认模板: `p-2 bg-white/80 rounded-lg`
- 杂志模板: `flex items-center group`

### 移动端菜单

**面板样式：**
```html
w-full md:w-96
bg-gray-950 md:bg-gray-900/90 md:backdrop-blur-2xl
shadow-2xl
transform translate-x-full transition-transform duration-500
```

**菜单项：**
```html
py-4 px-6 rounded-2xl
text-white/50 hover:text-white hover:bg-white/5
```

### Hero 区域

- **高度**: `h-screen` (全屏)
- **背景**: 模糊遮罩 + 渐变叠加
- **内容定位**: `absolute bottom-0`，距底部 `pb-24 md:pb-32`

### 图片卡片

**默认模板：**
```html
rounded-lg shadow-sm hover:shadow-xl
transition-shadow duration-300
overflow-hidden
```

**杂志模板：**
```html
/* 无圆角阴影，简洁风格 */
magazine-img: transition filter 0.3s
magazine-caption: margin-top 12px, text-align left
```

### PhotoSwipe Caption

自定义 lightbox caption 样式：

```html
absolute bottom-0 left-0 right-0 p-6
bg-gradient-to-t from-black/80 to-transparent
text-white text-lg md:text-xl (标题)
text-white/50 text-xs (元信息)
```

### 分割线

```html
<!-- 组分隔 -->
<div class="w-16 h-px bg-gray-200"></div>

<!-- 正文分隔 -->
<div class="w-24 h-px bg-gray-300 mx-auto"></div>
```

### Footer

```html
text-center pb-8
text-gray-500 text-sm tracking-widest uppercase
```

## 滚动条样式

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.2); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background-color: rgba(0, 0, 0, 0.4); }
```

## Prose 样式 (Typography Plugin)

用于渲染 Markdown 内容 (`content.md`)：

```html
prose prose-lg prose-stone
prose-headings:font-bold prose-headings:text-black
prose-h1:text-4xl prose-h1:text-center
prose-h2:border-b prose-h2:pb-2
prose-p:text-justify prose-p:leading-relaxed
prose-blockquote:border-l-4 prose-blockquote:pl-4 prose-blockquote:italic
prose-img:rounded-xl prose-img:shadow-lg
prose-a:text-blue-600 hover:prose-a:underline
```

## 模板对比

| 属性 | Default 模板 | Magazine 模板 |
|------|-------------|---------------|
| 背景 | `bg-white` | `bg-[#fdfbf7]` (暖色) |
| Hero | 全屏背景图 + 渐变 | 文字居中 + 分隔线 |
| 图片样式 | 圆角 + 阴影 + hover 效果 | 无装饰 + brightness hover |
| Caption | hover 显示 | 常驻显示 |
| 网格间距 | 16px | 40px |
| 导航栏 | 深色主题 | 浅色主题 |
| 正文宽度 | max-w-3xl | max-w-2xl |

## 设计原则

1. **极简主义**: 减少装饰元素，突出内容本身
2. **响应式优先**: 移动端体验优先，渐进增强桌面端
3. **平滑过渡**: 所有状态变化使用 CSS transition
4. **留白充足**: 大量使用 padding/margin 创造呼吸感
5. **一致性**: 相同类元素保持统一样式变量