# Exam Prep Ultra

打开网址就能刷题，支持导入 Word / Markdown / PDF / 粘贴文本题库，即选即判，刷到刻进 DNA。

## 在线访问

[https://learnercodez.github.io/exam-prep-ultra/](https://learnercodez.github.io/exam-prep-ultra/)

## 功能

- **多题型**：听力、段落匹配、选词填空、阅读、单选题、多选题、判断题，tab 从题库自动生成
- **4种模式**：顺序练习、随机刷题、错题本、收藏夹
- **即选即判**：选择后立即显示对错 + 正确答案；无答案题显示"无答案"不计对错
- **多种导入**：文件上传（Markdown / Word / PDF）+ 粘贴文本
- **追加题目**：导入时可选择追加到现有题库，侧栏也有 + 按钮快捷追加
- **题库管理**：侧栏切换、重命名、删除题库
- **答案编辑**：可在刷题时修改答案，保存到本地
- **题目导航**：点击题号跳转任意题目
- **零注册**：打开即用，数据存浏览器本地
- **键盘快捷键**：1-4 选答案、←→ 翻页、F 收藏

## 技术栈

- 原生 HTML/CSS/JS（无框架，无构建）
- npoint.io（题库 JSON 存储）
- mammoth.js（Word 解析）
- pdf.js（PDF 解析）
- GitHub Pages（部署）

## 项目结构

```
exam-prep-ultra/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js           — 主逻辑
│   ├── parser-md.js     — 文本/Markdown 解析（单选/多选/判断/听力/匹配/填空/阅读）
│   ├── parser-docx.js   — Word 解析
│   └── parser-pdf.js    — PDF 解析
├── lib/
│   ├── mammoth.min.js
│   ├── pdf.min.js
│   └── pdf.worker.min.js
├── data/
│   ├── default.json     — 内置题库
│   └── sample-bank.md   — 题库格式示例
├── PRD.md               — 产品需求文档
├── AGENTS.md            — 开发指南
└── README.md
```

## 文档

- [PRD — 产品需求文档](PRD.md)
- [AGENTS — 开发指南](AGENTS.md)
