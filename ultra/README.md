# Exam Prep Ultra

打开网址就能刷题，支持导入 Word / Markdown / PDF / 粘贴文本题库，即选即判，刷到刻进 DNA。

**Ultra 版本**：全新全栈架构，新增用户系统、好友共享题库、管理面板、离线兼容。

## 在线访问

☁️ **[https://exam-prep-ultra.pages.dev/](https://exam-prep-ultra.pages.dev/)**

## 功能

### 刷题核心
- **多题型**：听力、段落匹配、选词填空、阅读、单选题、多选题、判断题，tab 从题库自动生成
- **4 种模式**：顺序练习、随机刷题、错题本、收藏夹
- **即选即判**：选择后立即显示对错 + 正确答案
- **答案编辑**：刷题时可修改正确答案
- **题目导航**：点击题号跳转任意题目
- **键盘快捷键**：`1-4` 选答案、`←→` 翻页、`F` 收藏、`A-O` 选词

### 题库管理
- **多种导入**：文件上传（Markdown / Word / PDF）+ 粘贴文本
- **追加题目**：导入时选择追加到现有题库
- **题库管理**：侧栏切换、重命名、删除
- **离线可用**：数据存浏览器本地，断网仍可刷题

### 🆕 用户系统
- **注册 / 登录**：邮箱 + 密码，自动登录保持 7 天
- **云端题库**：登录后可创建云端题库，设公开或私密
- **未登录可用**：不登录也能正常刷题，所有功能不受限

### 🆕 好友系统
- **搜索用户**：按昵称或邮箱搜索
- **发送请求**：对方接受后成为好友
- **好友题库共享**：好友的私有题库互相可见
- **自动接受**：如果对方已向你发送请求，你发请求时自动成为好友

### 🆕 管理面板
- **用户管理**：查看所有用户、题库数量，可删除用户
- **题库管理**：查看所有题库、可见性，可删除题库
- **仅管理员可见**：普通用户看不到管理入口

## 快速开始

### 刷题
1. 打开网页即可刷题，默认题库已内置
2. 点左上角 ☰ 打开侧栏切换题库
3. 选答案后立即显示对错和正确答案

### 导入自己的题库
**方式一：文件上传** — 点右上角"+ 导入"，上传 .md / .docx / .pdf 文件

**方式二：粘贴文本** — 在导入弹窗的文本框粘贴题目内容，点"解析粘贴内容"

**方式三：追加题目** — 导入时在"导入到"下拉框选已有题库；或点侧栏题库旁的 + 按钮

### 支持的题目格式

**单选题：**
```
1. 题干内容（  ）
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：C
```

**多选题：**（答案为多字母）
```
1. 题干内容____
A. 选项A
B. 选项B
C. 选项C
D. 选项D
答案：BCD
```

**判断题：**
```
1. 题干内容
正确答案：对
```

> 答案行也支持写在最后一个选项后面（如 `D. 格雷码正确答案：CD`），会自动识别。

### 快捷键

| 按键 | 功能 |
|------|------|
| `1`-`4` | 选择选项 |
| `←` `→` | 上一题 / 下一题 |
| `F` | 收藏 / 取消收藏 |
| `A`-`O` | 选词填空选词 |

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 原生 HTML/CSS/JS（无框架，无构建） |
| 后端 | Cloudflare Pages Functions（Workers） |
| 数据库 | Cloudflare D1（SQLite） |
| 缓存/Session | Cloudflare KV |
| 题目存储 | Cloudflare KV（JSON 大文件） |
| 部署 | Cloudflare Pages |
| 文档解析 | mammoth.js（Word）、pdf.js（PDF） |

## 项目结构

```
ultra/
├── index.html              — 主页面
├── _worker.js              — Workers 统一路由入口
├── _redirects              — SPA 路由规则
├── wrangler.toml           — Cloudflare 配置
├── schema.sql              — D1 建表 SQL
├── seed.sql                — 种子数据（管理员 + 默认题库）
├── package.json            — npm 脚本（dev/deploy/db 等）
├── css/
│   └── style.css
├── js/
│   ├── app.js              — 主逻辑（题库加载、答题、渲染）
│   ├── api.js              — API 统一封装
│   ├── auth-ui.js          — 登录/注册弹窗
│   ├── friends-ui.js       — 好友管理弹窗
│   ├── admin-ui.js         — 管理员面板
│   ├── parser-md.js        — Markdown/文本解析
│   ├── parser-docx.js      — Word 解析
│   └── parser-pdf.js       — PDF 解析
├── functions/
│   ├── _middleware.js       — 认证中间件
│   └── api/
│       ├── auth/            — register, login, logout, me
│       ├── banks/           — index, [id], [id]/questions
│       ├── users/           — search
│       ├── friends/         — index, request, accept, reject
│       └── admin/           — users, banks
├── scripts/
│   └── gen-admin-hash.js   — 生成管理员密码哈希
├── data/
│   ├── default.json        — 内置默认题库
│   └── sample-bank.md      — 题库格式示例
├── docs/                   — 文档
└── notes/                  — 开发笔记
```

## 开发

### 本地开发

```bash
cd ultra
npm install        # 安装依赖（wrangler）
npm run dev        # 启动本地开发服务器
```

### 部署

```bash
npm run deploy     # 部署到 Cloudflare Pages 生产环境
```

### 数据库操作

```bash
npm run db:schema  # 建表
npm run db:seed    # 插入种子数据
npm run db:reset   # 重置数据库（删表 + 重建 + 种子）
npm run gen:admin  # 生成管理员密码哈希
```

## 文档

- [部署笔记](docs/D_ultra/DEPLOY.md) — 部署流程、Wrangler 命令、种子数据说明
- [分批实施笔记](notes/notes1_ultra_2.0/分批实施笔记.md) — 全栈升级 4 批实施思路与设计决策
- [AGENTS.md](AGENTS.md) — 开发指南

## 架构设计

### 请求流程

```
浏览器请求
  │
  ├─ /api/* ─→ _worker.js（Workers 入口）
  │              ├─ 中间件：解析 session cookie → 查 KV → 查 D1 → 注入 user
  │              └─ Handler：处理请求，读写 D1/KV
  │
  └─ 其他 ──→ 静态资源（HTML/CSS/JS/JSON）
                └─ SPA 路由：_redirects → index.html
```

### 数据存储

| 数据 | 存储位置 | 说明 |
|------|----------|------|
| 用户/好友/题库元数据 | D1 | 关系查询（好友可见性） |
| Session token | KV (SESSION) | token → user_id，7 天过期 |
| 题目 JSON | KV (QUESTIONS) | 单文件最大 25MB |
| 答题记录/收藏 | localStorage | 个人数据，不同步服务端 |

### 离线兼容

- 未登录用户：完全本地运行，不依赖网络
- 登录用户：API 失败时自动降级到 localStorage 缓存
- 题库加载：本地 → API + 缓存 → npoint 三级 fallback

## 版本历史

### v2.0 — Ultra（当前版本）

全栈升级。基于 Cloudflare（D1 + KV + Pages Functions）构建后端，新增用户系统、好友共享题库、管理面板、离线兼容。前端保持纯 vanilla JS。

技术架构：纯静态 SPA → Cloudflare 全栈

### v1.0 — Classic

初始版本。基于 data.js 内置题库的纯刷题工具，支持听力/段落匹配/选词填空/阅读四种题型，Python 脚本解析 Word 生成题库数据。

源码见 [v1.0 Release](https://github.com/learnerCodeZ/exam-prep-ultra/releases/tag/v1.0)。
