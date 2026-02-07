## Coding Guidelines

### 核心架构原则

- **No Build Step**: 代码不经过任何编译或转换，直接部署到服务器。
- **Dependency Management**: 引入相关的库，统一使用 `<script>` 标签引入。
- **Module System**: 业务代码使用 `script` 标签引入，不使用 `import` 或 `require` 语句。
- **Global Scope**: 依赖库通过 CDN 引入后，直接使用其挂载在 `window` 上的全局变量（如 `axios`, `_`, `Vue`, `React` 等）。
- **Native Support**: 优先使用浏览器原生支持的 API (ES6+ is fine, but no modules).

### ❌ 错误示例 (Incorrect Implementation)

- **禁止模块化导入**:

  ```javascript
  import axios from "axios"; // Error
  const _ = require("lodash"); // Error
  ```
