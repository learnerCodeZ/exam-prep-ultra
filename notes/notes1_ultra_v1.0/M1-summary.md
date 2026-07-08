# M1 完成总结 — 核心刷题功能

> 阶段目标：搭建纯前端刷题应用的核心骨架，支持四种题型刷题、即选即判、数据持久化。

## 交付内容

| 文件 | 作用 | 行数 |
|------|------|------|
| `src/index.html` | 单页应用入口，含题库切换下拉、导入按钮、模态弹窗骨架 | ~70 |
| `src/css/style.css` | 全部样式（继承 v1.0 并扩展） | ~260 |
| `src/js/app.js` | 主逻辑：题库加载、渲染、交互、状态管理、持久化 | ~430 |
| `data/default.json` | 内置 fallback 题库（190 题，来自 v1.0） | 699KB |

## 技术栈

- **原生 HTML/CSS/JS**：无框架（React/Vue）、无构建工具（Webpack/Vite），打开即用
- **fetch API**：异步加载题库 JSON
- **localStorage**：浏览器本地存储，无需后端数据库
- **正则表达式**：解析选词填空 passage 中的答案标记
- **CSS Flexbox + Grid**：响应式布局
- **sticky 定位**：顶部导航栏吸顶

## 核心知识点

### 1. 题库加载的三级降级策略

```
npoint.io（线上）→ localStorage 缓存 → 内置 default.json
```

**为什么需要降级？** npoint.io 是免费第三方服务，可能宕机。降级链保证任何情况下都能刷题：

```javascript
async function loadDefaultBank() {
  if (NPOINT_URL) {
    try {
      const res = await fetch(NPOINT_URL);        // 1. 先试线上
      if (res.ok) {
        const bank = await res.json();
        localStorage.setItem(cacheKey, JSON.stringify(bank));  // 顺手缓存
        return bank;
      }
      throw new Error('npoint failed');
    } catch (e) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);      // 2. 降级到缓存
    }
  }
  const res = await fetch('data/default.json');   // 3. 最终兜底
  return await res.json();
}
```

**学习点**：网络请求永远要处理失败。`try/catch + 降级` 是前端健壮性的基本模式。

### 2. async/await 异步加载

题库加载是异步的（fetch 返回 Promise），所以 `init()` 用 `async`：

```javascript
(async function init() {
  const activeId = localStorage.getItem(LS.activeBank) || 'default';
  await loadBank(activeId);
})();
```

**学习点**：IIFE（立即调用函数表达式）+ `async`，让顶层代码能用 `await`。

### 3. localStorage 数据隔离

每个题库的答题数据用题库 id 作 key 前缀，互不污染：

```javascript
const LS = {
  wrong: (id) => 'ultra_wrong_' + id,
  right: (id) => 'ultra_right_' + id,
  fav: (id) => 'ultra_fav_' + id,
};
```

**学习点**：用函数生成 key 而非拼接字符串，避免拼写错误，也便于统一清理。

### 4. 正则表达式清洗选词填空 passage

这是 M1 最难的部分。passage 里的答案标记格式极不统一，有 3 种变体：

| 变体 | 示例 | 出现位置 |
|------|------|----------|
| Format A | `26C) chance` / `26D.complex` | xctk_4~9 |
| Format B | `__B) slump_ 31)` / `___C) aimless___ 32)` | xctk_1,2 |
| Format C | `A) financially 39)` | xctk_1 边界 |

三步正则清洗，把答案标记替换成 `【NUM】` 占位符：

```javascript
// Format A: NUM + [_\s]* + LETTER + [).] + word
cleanPassage.replace(/(\d{2})[\s_]*([A-O])[).\s]+([A-Za-z\-]+)[\s_]*/g, '【$1】 ');
// Format B: _+ LETTER ) word _* NUM )
cleanPassage.replace(/_+\s*([A-O])\s*[)\.]\s*([A-Za-z\-]+)\s*_*\s*(\d{2})\)/g, '【$3】 ');
// Format C: LETTER ) word NUM )
cleanPassage.replace(/([A-O])\s*[)\.]\s*([A-Za-z\-]+)\s+(\d{2})\)/g, '【$3】 ');
```

**学习点**：
- `[\s_]*` 匹配"任意空格或下划线"，应对格式不统一
- `$1` `$3` 是捕获组反向引用，从左到右数括号
- 答案不依赖 passage 解析，直接用 `blanks` 字段（更可靠）—— **解析和判定分离**，避免一处错误连锁

### 5. XSS 防护：escapeHtml

所有用户/题库内容渲染前都转义 HTML 特殊字符：

```javascript
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
```

**学习点**：题目文本来自外部（npoint/导入），若含 `<script>` 会执行。转义是前端安全基本功。

### 6. CSS sticky 吸顶导航

```css
.header { position: sticky; top: 0; z-index: 100; }
```

**学习点**：`sticky` 比 `fixed` 更友好——滚动时吸顶，但不会脱离文档流，不需要给 body 加 padding。

## 实现的功能

1. **题库加载**：三级降级
2. **题库切换**：顶部下拉菜单
3. **四种题型渲染**：听力、段落匹配、选词填空、阅读
4. **四种模式**：顺序练习、随机刷题、错题本、收藏夹
5. **即选即判**：选择后立即显示对错 + 正确答案 + 翻译
6. **题目导航**：点击题号弹出面板，颜色标记答题状态
7. **答题统计**：总题数/已答对/错题/收藏
8. **数据持久化**：每题库独立的错题/收藏/答题记录

## 关键决策

- **题库数据格式**：`{id, name, questions: [...]}` 包装格式，为多题库切换打基础
- **答案来源分离**：选词填空的判定用 `blanks` 字段，passage 只负责显示
- **npoint 未配置**：`NPOINT_URL` 留空，M5 部署时填入

## 待办

- 浏览器手动测试四种题型的完整交互
- 移动端适配验证

## 项目流程回顾

```
v1.0（单文件 data.js）
  ↓ 提取题库为 JSON
default.json（题库数据独立）
  ↓ 拆分 HTML/CSS/JS
ultra/src/（可维护的项目结构）
  ↓ 加入题库包装格式
多题库支持（为 M2 切换打基础）
```

**最大收获**：把 v1.0 的单文件泥球拆成清晰的三层（数据/逻辑/视图），并解决了选词填空这个最复杂的解析问题。
