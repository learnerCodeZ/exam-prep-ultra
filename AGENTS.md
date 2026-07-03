# AGENTS.md

## 项目概述

期末刷题宝典 Ultra — 纯前端在线刷题工具，支持导入 Word/Markdown/PDF/粘贴文本题库，部署在 GitHub Pages，题库数据存在 npoint.io。

## 技术约束

- 纯前端：HTML/CSS/JS，无框架，无构建工具
- 不写后端代码，不使用需要服务器的数据库
- 题库存储：npoint.io（只读下发）+ localStorage（用户数据）
- 第三方库仅限：mammoth.js（Word）、pdf.js（PDF），其余手写
- 代码风格：简洁、无多余抽象、注释只写 WHY

## 代码结构

- `index.html` — 单页应用入口
- `css/style.css` — 全部样式
- `js/app.js` — 主逻辑：渲染、交互、状态管理
- `js/parser-md.js` — Markdown/纯文本题库解析（含单选、多选、判断、听力、匹配、填空、阅读）
- `js/parser-docx.js` — Word 题库解析（调用 mammoth.js）
- `js/parser-pdf.js` — PDF 题库解析（调用 pdf.js）
- `lib/` — 第三方库（mammoth.min.js, pdf.min.js, pdf.worker.min.js）
- `data/default.json` — 内置 fallback 题库

## 数据格式

题库 JSON 统一结构：

```json
{
  "id": "college-english",
  "name": "大学英语4（默认）",
  "questions": [
    {
      "id": "tl_1",
      "type": "listening",
      "typeName": "听力",
      "number": 1,
      "stem": "第1题",
      "options": [{"letter": "A", "text": "Option text", "zh": "中文翻译"}],
      "answer": "C"
    },
    {
      "id": "xctk_1",
      "type": "fillblank",
      "typeName": "选词填空",
      "passage": "...",
      "wordBank": [{"letter": "A", "text": "word"}],
      "blanks": {"26": "C"}
    },
    {
      "id": "dlpp_1",
      "type": "matching",
      "typeName": "段落匹配",
      "passages": {"A": "段落文本", "B": "..."},
      "options": [{"letter": "A", "text": "..."}],
      "answer": "A"
    },
    {
      "id": "dx_1",
      "type": "reading",
      "typeName": "单选题",
      "stem": "题干",
      "options": [{"letter": "A", "text": "..."}],
      "answer": "C"
    }
  ]
}
```

题型由 `typeName` 动态显示，UI 渲染按题目结构判断：
- 有 `wordBank` → 选词填空 UI
- 有 `passages` → 段落匹配 UI
- 其余 → 选择题 UI（判断题也用选择题 UI，选项为 对/错）

答案格式：单选为单字母 `"C"`，多选为多字母 `"CD"`，判断为 `"A"`(对)/`"B"`(错)，无答案为 `""`

## 关键决策

- 题型动态化：tab 从 question.typeName 自动生成，不硬编码
- UI 按结构渲染：根据 wordBank/passages 有无决定 UI 模式，不依赖 type 字段
- 导入方式：文件上传 + 粘贴文本，支持创建新题库或追加到现有题库
- 答案编辑：保存在 localStorage，覆盖默认答案
- 无答案题目：显示"已作答 · 无答案"，不计对错
- npoint 宕机降级：前端内置 default.json，首次加载后缓存到 localStorage

## 注意事项

- localStorage 容量约 5-10MB，大量题库导入需提示用户
- Word 双栏排版会导致 mammoth 丢失右栏内容，需用户注意
- 移动端适配是必须的，多数学生会用手机刷题
- 多选题目前 UI 为单选交互，后续需加多选提交功能
