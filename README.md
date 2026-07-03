# Exam Prep Ultra

打开网址就能刷题，支持导入 Word / Markdown / PDF 题库，即选即判，刷到刻进 DNA。

## 在线访问

[https://learnercodez.github.io/exam-prep-ultra/](https://learnercodez.github.io/exam-prep-ultra/)

## 功能

- **4种题型**：听力、段落匹配、选词填空、阅读
- **4种模式**：顺序练习、随机刷题、错题本、收藏夹
- **即选即判**：选择后立即显示对错 + 正确答案 + 翻译
- **导入题库**：支持 Markdown / Word (.docx) / PDF 文件
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
├── README.md
├── AGENTS.md
├── docs/
│   └── PRD.md
└── src/              ← GitHub Pages 根目录
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   ├── app.js
    │   ├── parser-md.js
    │   ├── parser-docx.js
    │   └── parser-pdf.js
    ├── lib/
    │   ├── mammoth.min.js
    │   ├── pdf.min.js
    │   └── pdf.worker.min.js
    └── data/
        ├── default.json
        └── sample-bank.md
```

## 文档

- [PRD — 产品需求文档](docs/PRD.md)
