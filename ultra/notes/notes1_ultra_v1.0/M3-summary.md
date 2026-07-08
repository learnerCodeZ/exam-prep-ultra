# M3 完成总结 — Word/PDF 导入

> 阶段目标：支持用户导入 Word (.docx) 和 PDF (.pdf) 题库文件。

## 交付内容

| 文件 | 作用 | 大小 |
|------|------|------|
| `src/lib/mammoth.min.js` | 浏览器端 Word (.docx) → 纯文本 | 642KB |
| `src/lib/pdf.min.js` | 浏览器端 PDF 文本提取 | 320KB |
| `src/lib/pdf.worker.min.js` | pdf.js 的 Web Worker | 1087KB |
| `src/js/parser-docx.js` | Word 解析器（mammoth → parseMarkdownBank） | ~10 行 |
| `src/js/parser-pdf.js` | PDF 解析器（pdf.js → parseMarkdownBank） | ~25 行 |
| `src/js/parser-md.js` | 新增自动检测题型逻辑 | +30 行 |
| `src/index.html` | 引入第三方库 + 更新导入弹窗 | 更新 |
| `src/js/app.js` | 导入流程支持 .md/.docx/.pdf | 更新 |

## 技术栈

- **mammoth.js**：浏览器端 docx → 纯文本提取，不依赖服务器
- **pdf.js (Mozilla)**：浏览器端 PDF 渲染/文本提取，业界标准
- **Web Worker**：pdf.js 使用 Worker 线程处理 PDF，不阻塞 UI
- **FileReader.readAsArrayBuffer()**：读取二进制文件（Word/PDF）
- **Promise 链**：异步文件解析

## 核心知识点

### 1. mammoth.js：浏览器端 Word 解析

mammoth 只做一件事：把 .docx 文件转成文本/HTML。在浏览器中通过 ArrayBuffer 传入：

```javascript
function parseDocxBank(arrayBuffer, bankName) {
  return mammoth.extractRawText({ arrayBuffer: arrayBuffer })
    .then(function(result) {
      var text = result.value;  // 提取的纯文本
      return parseMarkdownBank(text, bankName);
    });
}
```

**学习点**：
- `extractRawText()` 只提取文本，不保留格式——正合我们需求
- `convertToHtml()` 会保留段落/粗体等格式，适合需要富文本的场景
- mammoth 也能在 Node.js 中使用（`npm install mammoth`），方便调试

### 2. pdf.js：浏览器端 PDF 解析

pdf.js 是 Mozilla 出品的 PDF 渲染引擎，能提取每页文本：

```javascript
function parsePdfBank(arrayBuffer, bankName) {
  // 设置 Worker 路径（必须）
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

  return pdfjsLib.getDocument({ data: arrayBuffer }).promise
    .then(function(pdf) {
      var textPromises = [];
      for (var i = 1; i <= pdf.numPages; i++) {
        textPromises.push(
          pdf.getPage(i).then(function(page) {
            return page.getTextContent().then(function(content) {
              // content.items 是文本片段数组
              return content.items.map(function(item) {
                return item.str;
              }).join(' ');
            });
          })
        );
      }
      return Promise.all(textPromises);
    })
    .then(function(pages) {
      var text = pages.join('\n\n');
      return parseMarkdownBank(text, bankName);
    });
}
```

**学习点**：
- **Web Worker**：pdf.js 用 Worker 处理 PDF 解码，避免冻结 UI。`GlobalWorkerOptions.workerSrc` 必须指向 worker 文件
- **分页提取**：`getPage(i)` 返回单页，`getTextContent()` 提取文本内容
- **items 数组**：PDF 文本不是连续字符串，而是由很多 `str` 片段组成（PDF 的文本块可能被拆碎），用 `.join(' ')` 拼接
- **Promise.all**：所有页面并行提取，等待全部完成

### 3. FileReader 的两种读取模式

```javascript
// Markdown：读取为文本
reader.readAsText(file, 'utf-8');

// Word/PDF：读取为二进制 ArrayBuffer
reader.readAsArrayBuffer(file);
```

**学习点**：
- `readAsText` 适合文本文件，指定编码防止乱码
- `readAsArrayBuffer` 适合二进制文件（docx 本质是 zip 包，pdf 是二进制格式）
- 还有 `readAsDataURL`（转 base64，适合图片预览）和 `readAsBinaryString`（已废弃，用 ArrayBuffer 代替）

### 4. 统一解析策略：提取文本 → 复用 Markdown 解析器

核心设计：Word/PDF 都先提取纯文本，然后复用 `parseMarkdownBank`。

```
.docx ──mammoth──→ 纯文本 ──┐
.pdf  ──pdf.js───→ 纯文本 ──┼──parseMarkdownBank──→ 题库 JSON
.md   ───────────── 纯文本 ──┘
```

**为什么能复用？** 因为 Word/PDF 提取出的文本格式和 Markdown 题库格式相似：
- 题号 `1.` `41)` 格式一样
- 选项 `A. text` 格式一样
- 中文翻译标记正确答案的逻辑一样

**复用的好处**：解析逻辑只写一份，维护成本低。

### 5. 自动检测题型（无 # 标题时）

Word/PDF 提取的文本没有 `# 听力` 这种标题，需要自动检测：

```javascript
function autoDetectAndParse(text, questions) {
  // 选词填空：含 __X) word__ 标记
  if (/_+\s*[A-O][\)\.]\s*\S+/.test(text) && /\d{2}[\)\.]/.test(text)) {
    parseFillBlank(text, questions);
    return;
  }
  // 段落匹配：含 (X) 答案标记 + 字母段落
  if (/\(([A-H])\)/.test(text) && /[A-H][\.\)]\s*.{20,}/.test(text)) {
    parseMatching(text, questions);
    return;
  }
  // 阅读：题号 + ) + 选项
  if (/\d{2}[\)]\s*.+/.test(text)) {
    parseReading(text, questions);
    return;
  }
  // 默认当听力
  parseListening(text, questions);
}
```

**学习点**：
- 用特征词/正则模式区分内容类型——这是文本分类的基本思路
- 检测顺序有讲究：选词填空的 `_+X)` 最特殊，优先检测；段落匹配的 `(X)` 次之
- 不完美但实用：Word/PDF 格式千差万别，100% 准确不可能，PRD 也提到"提供预览编辑步骤"

### 6. pdf.js 版本选择：传统脚本 vs ES Module

| 版本 | 格式 | 引入方式 |
|------|------|----------|
| pdfjs-dist@3.x | `pdf.min.js` | `<script src>` 直接引入 |
| pdfjs-dist@4.x | `pdf.min.mjs` | `<script type="module">` |

我们选 v3.x，因为纯 HTML 项目用传统 `<script>` 更简单，不需要构建工具。

**学习点**：
- `.mjs` 后缀表示 ES Module，需要 `import` 语法
- 传统 `.js` 后缀用 `var pdfjsLib = ...` 暴露全局变量
- 无构建工具的项目优先选传统脚本版本

## 踩坑记录

### 坑 1：pdf.js ESM 版本不兼容传统 script

下载了 v4.x 的 `.mjs` 文件，浏览器报错 `pdfjsLib is not defined`。改用 v3.x 的传统脚本版本解决。

### 坑 2：Word 文件没有 # 标题

mammoth 提取的文本没有 `# 听力` 标题，`parseMarkdownBank` 以为没有题型区块，解析出 0 题。加了 `autoDetectAndParse` 自动检测。

### 坑 3：真实 Word 文件解析率不完美

用 v1.0 的真实 Word 文件测试：
- 听力.docx：31/40 题（部分题目格式不标准）
- 阅读.docx：68/82 题
- 段落匹配.docx：识别为听力（格式差异大）
- 选词填空.docx：1/8 题

这是预期内的——Word 格式千差万别，PRD 也说"解析结果可能不完美，需提供预览编辑步骤"。后续 M4 可以加手动编辑。

## 调试方法论

1. **Node 端预调试**：mammoth 有 Node 版本，可以先用 Node 跑通再移到浏览器
2. **分步验证**：先验证 mammoth 提取的文本长什么样，再验证 parseMarkdownBank 能否解析
3. **真实数据测试**：用 v1.0 的 4 个 Word 文件做端到端测试
4. **HTTP 服务器验证**：所有库文件通过 `curl` 确认可加载

## 项目流程回顾

```
M2（Markdown 导入）
  ↓ 复用 parseMarkdownBank
M3 加入 Word/PDF 导入
  ├─ mammoth.js：docx → 文本
  ├─ pdf.js：pdf → 文本
  └─ 统一入口：文本 → parseMarkdownBank → 题库 JSON
  ↓ 加 autoDetectAndParse
无 # 标题也能解析
```

**最大收获**：掌握了浏览器端文件处理的完整链路——FileReader 读取 → 第三方库解析 → 复用已有解析器 → localStorage 持久化。"提取 → 复用"的策略大幅减少了代码量。
