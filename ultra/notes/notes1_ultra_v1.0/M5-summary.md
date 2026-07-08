# M5 完成总结 — GitHub Pages 部署上线

> 阶段目标：将应用部署到 GitHub Pages，公网可访问。

## 交付内容

| 改动 | 说明 |
|------|------|
| 文件结构从 `src/` 迁移到根目录 | GitHub Pages 从根目录部署 |
| 添加 `.nojekyll` | 禁用 Jekyll 处理，防止 README 覆盖 index.html |
| 代码推送到 GitHub | https://github.com/learnerCodeZ/exam-prep-ultra |
| 线上可访问 | https://learnercodez.github.io/exam-prep-ultra/ |

## 技术栈

- **GitHub Pages**：免费静态网站托管，自动 HTTPS
- **Jekyll**：GitHub Pages 默认的静态站点生成器
- **.nojekyll**：禁用 Jekyll 处理的标记文件
- **git filter-branch**：重写 git 历史的工具
- **git force push**：覆盖远程历史

## 核心知识点

### 1. GitHub Pages 的两种部署方式

| 方式 | 部署目录 | 适用场景 |
|------|----------|----------|
| 从根目录 `/` 部署 | 仓库根目录 | 项目本身就是网站 |
| 从 `/docs` 部署 | 仓库的 docs 目录 | 项目有源码+文档，只发布文档 |

**学习点**：我们的项目没有构建步骤，所有文件直接就是网站，所以从根目录部署最简单。

### 2. Jekyll 是什么？为什么它"捣乱"

GitHub Pages 默认用 **Jekyll** 处理仓库——它会：
- 把 `.md` 文件转成 HTML
- 用 README.md 作为首页
- 应用主题模板

这正是我们看到的问题：访问 `/` 显示的是 Jekyll 渲染的 README，而不是我们的 `index.html`。

**解决方法**：在仓库根目录放一个空的 `.nojekyll` 文件，GitHub Pages 就会跳过 Jekyll，直接原样提供文件。

```
.nojekyll    ← 空文件，告诉 GitHub "别用 Jekyll"
index.html   ← 直接作为首页
css/         ← 原样提供
js/          ← 原样提供
```

**学习点**：
- Jekyll 适合博客/文档站点，但不适合纯前端 SPA
- `.nojekyll` 是 GitHub Pages 的"逃生舱口"，让你完全控制输出
- 文件名以 `.` 开头是 Unix 的隐藏文件惯例

### 3. 部署失败的排查过程

```
第一次尝试：从 /docs 部署 → Jekyll 渲染了 README → 失败
第二次尝试：加 .nojekyll 到 /docs → 部署本身失败 → .nojekyll 没生效
第三次尝试：所有文件移到根目录 + .nojekyll → 成功
```

**学习点**：
- GitHub Pages 有部署延迟（1-2分钟），需要等
- 部署失败时 `.nojekyll` 不会被部署，所以不会生效——形成"死锁"
- 用 `curl` 检查线上文件是否存在是最直接的验证方式

### 4. git filter-branch：重写历史

需要从所有提交中删除 `Co-Authored-By` 行：

```bash
git filter-branch -f --msg-filter 'sed "/Co-Authored-By: Claude Haiku 4.5/d"' HEAD
git push --force
```

**学习点**：
- `filter-branch` 重写整个提交历史，生成新的 commit hash
- `--msg-filter` 对每条提交信息执行 shell 命令
- `sed "/pattern/d"` 删除匹配的行
- 重写历史后必须 `--force` push，因为远程的 commit hash 已过期
- **force push 是危险操作**：如果其他人已基于旧历史开发，会造成冲突

### 5. SSL 连接问题的排查

push 时遇到 `schannel: failed to receive handshake, SSL/TLS connection failed`：

```bash
GIT_CURL_VERBOSE=1 git push --force
```

**学习点**：
- `GIT_CURL_VERBOSE=1` 打开 git 的 HTTP 调试日志，能看到完整的请求/响应
- 这个错误通常是代理或网络不稳定导致的，重试即可
- Windows 上的 git 用 `schannel`（Windows 原生 SSL），和 Linux 的 OpenSSL 不同

### 6. curl 验证线上状态

```bash
# 检查页面内容
curl -s https://example.com/ | head -10

# 检查文件是否可访问
curl -sI https://example.com/data/default.json | head -3

# 检查 .nojekyll 是否部署
curl -sI https://example.com/.nojekyll | head -2
```

**学习点**：
- `curl -s` 静默模式（不显示进度），`-I` 只取 header，`-sI` 组合
- 200 = 成功，404 = 不存在，301/302 = 重定向
- 部署验证不需要浏览器，`curl` 更快更可靠

## 踩坑记录

### 坑 1：Jekyll 渲染 README 覆盖 index.html

GitHub Pages 用 Jekyll 默认处理，把 README.md 渲染成首页。加 `.nojekyll` 解决。

### 坑 2：/docs 部署时 .nojekyll 没生效

部署失败时 `.nojekyll` 文件也不会被部署，形成死锁。最终改用根目录部署。

### 坑 3：git mv src docs 导致路径嵌套

`git mv src docs` 把 src 移到 docs 下面变成了 `docs/src/`，而不是把 src 内容变成 docs 内容。需要先 `cp -r src/* docs/`，再 `rm -rf src`。

## 项目流程回顾

```
M4（答案编辑 + UI 打磨）
  ↓ 迁移到根目录
M5 部署上线
  ├─ src/ → 根目录（GitHub Pages 要求）
  ├─ .nojekyll（禁用 Jekyll）
  ├─ git filter-branch（清理提交历史）
  ├─ GitHub Pages 配置：main 分支根目录
  └─ 线上验证：https://learnercodez.github.io/exam-prep-ultra/
```

**最大收获**：理解了 GitHub Pages 的工作机制——Jekyll 是默认处理引擎，`.nojekyll` 是逃生舱口。部署问题不是代码 bug，而是平台配置问题。排查时用 `curl` 直接验证线上文件比浏览器更高效。

## 完整项目结构（最终版）

```
exam-prep-ultra/
├── .nojekyll           ← 禁用 Jekyll
├── .gitignore
├── README.md
├── AGENTS.md
├── index.html          ← 单页应用入口
├── css/style.css
├── js/
│   ├── app.js          ← 主逻辑
│   ├── parser-md.js    ← Markdown 解析
│   ├── parser-docx.js  ← Word 解析
│   └── parser-pdf.js   ← PDF 解析
├── lib/
│   ├── mammoth.min.js
│   ├── pdf.min.js
│   └── pdf.worker.min.js
├── data/
│   ├── default.json    ← 内置题库（190题）
│   └── sample-bank.md  ← 示例 Markdown 题库
└── docs/
    └── PRD.md
```
