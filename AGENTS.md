# AGENTS.md

## 项目概述

期末刷题宝典 Ultra — 纯前端在线刷题工具，支持导入 Word/Markdown/PDF 题库，部署在 GitHub Pages，题库数据存在 npoint.io。

## 技术约束

- 纯前端：HTML/CSS/JS，无框架，无构建工具
- 不写后端代码，不使用需要服务器的数据库
- 题库存储：npoint.io（只读下发）+ localStorage（用户数据）
- 第三方库仅限：mammoth.js（Word）、pdf.js（PDF），其余手写
- 代码风格：简洁、无多余抽象、注释只写 WHY

## 代码结构

- `src/index.html` — 单页应用入口
- `src/css/style.css` — 全部样式
- `src/js/app.js` — 主逻辑：渲染、交互、状态管理
- `src/js/parser-md.js` — Markdown 题库解析
- `src/js/parser-docx.js` — Word 题库解析（调用 mammoth.js）
- `src/js/parser-pdf.js` — PDF 题库解析（调用 pdf.js）
- `src/lib/` — 第三方库（mammoth.min.js, pdf.min.js）
- `data/default.json` — 内置 fallback 题库

## 数据格式

题库 JSON 统一结构：

```json
[
  {
    "id": "tl_1",
    "type": "listening",
    "typeName": "听力",
    "number": 1,
    "stem": "第1题",
    "options": [
      {"letter": "A", "text": "Option text", "zh": "中文翻译"}
    ],
    "answer": "C"
  }
]
```

题型 type 值：`listening`（听力）、`matching`（段落匹配）、`fillblank`（选词填空）、`reading`（阅读）

## 关键决策

- 题库只读：npoint.io 仅做下发，用户无法直接修改线上题库
- 答案编辑：保存在 localStorage，覆盖默认答案
- 导入题库：浏览器端解析文件 → localStorage，不经过服务器
- npoint 宕机降级：前端内置 default.json，首次加载后缓存到 localStorage

## 注意事项

- localStorage 容量约 5-10MB，大量题库导入需提示用户
- Word/PDF 解析结果可能不完美，需提供预览编辑步骤
- 移动端适配是必须的，多数学生会用手机刷题
