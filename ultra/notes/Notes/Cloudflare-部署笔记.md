# Cloudflare 部署完全笔记

> 合并自《Cloudflare 复盘笔记》+《部署笔记》，面向小白复习用。
> 涵盖：Cloudflare 是什么、核心产品、项目架构、部署全流程、踩坑点。

---

## 一、Cloudflare 是什么

### 一句话

Cloudflare 是一家提供**全球 CDN + 边缘计算**的云服务商。你可以把网站部署上去，它负责在全球加速访问、提供数据库/存储/后端函数等能力，免费额度对小项目完全够用。

### 类比理解

- **传统部署**：租一台服务器（阿里云 ECS），自己装系统、装数据库、配 Nginx、配域名——像买地盖房子
- **Cloudflare**：直接把代码丢上去，域名、HTTPS、CDN、数据库全帮你搞定——像住精装公寓

### 官网地址

| 项目 | 地址 |
|------|------|
| **国际官网** | https://www.cloudflare.com |
| **中国站** | https://www.cloudflare-cn.com |
| **控制台（Dashboard）** | https://dash.cloudflare.com |
| **开发者文档** | https://developers.cloudflare.com |

> **注**：中国站（.cn）有独立的运营主体（Cloudflare 与京东云合作），产品线和免费套餐可能与国际版不同。本项目使用国际版 `cloudflare.com` 的免费套餐。

### 注册步骤

```
1. 打开 https://dash.cloudflare.com/sign-up
2. 输入邮箱 → 设置密码 → 验证邮箱
3. 注册后自动进入 Dashboard
4. 免费账号即包含 Pages / Workers / D1 / KV 的免费额度
```

---

## 二、核心概念先导

在了解具体产品之前，先搞懂几个概念。

### 2.1 前端 vs 后端

- **前端**：用户看到的部分——页面、按钮、样式。运行在**浏览器**里。技术：HTML/CSS/JS
- **后端**：用户看不到的部分——处理登录、存数据、查数据库。运行在**服务器**里。技术：Node.js/Python/Java 等

本项目 v3.0 之前是**纯前端**（没有后端），v3.0 加了 Cloudflare 后端。

### 2.2 SPA 是什么

SPA = Single Page Application（单页应用）。

传统网站点击链接会跳转到新页面，每个页面都从服务器重新加载。SPA 只有**一个 HTML 页面**（index.html），点击链接时不会跳转，而是由 JavaScript 动态替换页面内容。

- 优势：切换流畅、体验像原生 App
- 代价：首屏加载稍慢，且需要特殊处理路由（否则刷新页面会 404，见第 6.5 节）

本项目就是 SPA——只有 `index.html` 一个页面，所有切换靠 JS 完成。

### 2.3 服务器 vs 无服务器（Serverless）

- **传统服务器**：租一台一直开着的机器，你的代码在上面跑，按月付费。没人访问也在花钱
- **无服务器（Serverless）**：你不管理服务器，代码只在有人访问时才运行，按调用次数付费。没人访问就不花钱

Cloudflare Workers/Pages Functions 就是 Serverless——你只写函数，Cloudflare 负责运行。

### 2.4 边缘计算

传统云服务器在某个固定机房（如上海），全国用户都访问这个机房，远的地方就慢。

边缘计算把你的代码部署到**全球几百个节点**，用户访问时由最近的节点响应，所以很快。Cloudflare 就是边缘计算。

---

## 三、项目涉及的核心 Cloudflare 产品

### 3.1 Cloudflare Pages —— 静态网站托管

**对标**：GitHub Pages、Netlify、Vercel

**核心能力**：托管静态文件（HTML/CSS/JS），全球 CDN 加速，自动 HTTPS

**本项目用途**：托管刷题宝典的前端 SPA 文件（index.html / css / js / lib / data）

| 要点 | 说明 |
|------|------|
| 部署方式 | 关联 GitHub 仓库自动部署，或用 wrangler 命令行部署 |
| 自定义域名 | 支持绑定自己的域名，自动签发免费 SSL 证书 |
| 分支预览 | 每个 PR 自动生成预览链接 |
| 目录配置 | 项目的 ultra/ 子目录设为 Root directory |
| SPA 路由 | 需创建 `_redirects` 文件：`/* /index.html 200` |
| 免费额度 | 无限带宽 + 500 次构建/月 |

### 3.2 Cloudflare Workers / Pages Functions —— 服务端函数

**对标**：AWS Lambda、Vercel Functions

**核心能力**：在 Cloudflare 边缘节点运行 JavaScript 代码，无需管理服务器

**Pages Functions 与 Standalone Workers 的区别**：

| 对比 | Pages Functions | Standalone Workers |
|:----:|:---------------:|:------------------:|
| 部署方式 | 和 Pages 一起部署 | 独立部署 |
| 域名 | 和前端同域名 | 独立的 workers.dev 子域名 |
| CORS | 不需要（同源） | 需要配置 CORS 头 |
| 适用场景 | 前端+API 一体 | 独立的微服务/API |

**推荐**：使用 **Pages Functions**，前端和 API 一起部署，更简单。

**免费额度**：10 万请求/天，10ms CPU 时间/请求，128MB 内存

### 3.3 Cloudflare D1 —— 无服务器 SQLite 数据库

**对标**：AWS RDS、SQLite 自建

**核心能力**：关系型数据库，支持 SQL 查询，自动备份

**为什么适合本项目**：
- 用户数据（账号、好友关系）是典型的关系型数据
- 需要 JOIN 查询（如"查询好友的题库"）
- 免费 500MB 完全够用

**注意**：首次查询有冷启动延迟（200-500ms），之后很快（<10ms）

| 资源 | 免费额度 |
|------|---------|
| 存储 | 500 MB |
| 读操作 | 500 万次/月 |
| 写操作 | 10 万次/月 |
| 数据库数 | 10 个 |

### 3.4 Cloudflare R2 —— 对象存储（本项目未使用）

**对标**：AWS S3、阿里云 OSS

**核心能力**：存储任意文件（JSON / 图片 / 视频），零出站流量费

**为什么最终没用 R2**：R2 需要绑信用卡才能用，我们的题目 JSON 最大才 700KB，用 KV 完全够用，不需要绑卡。

| 资源 | 免费额度 |
|------|---------|
| 存储 | 10 GB |
| A 类操作（写/上传） | 100 万次/月 |
| B 类操作（读/下载） | 1000 万次/月 |
| 出站流量 | **免费（无 egress 费用）** |

### 3.5 Cloudflare KV —— 键值存储

**对标**：Redis、Memcached

**核心能力**：全球分布式键值缓存，亚毫秒级读取

**本项目用途**：
- SESSION 命名空间：存储用户会话（session token → user_id）
- QUESTIONS 命名空间：存储题目 JSON 大文件

**注意**：KV 是最终一致性，写入后全球传播需要几秒到几十秒。存会话令牌没问题（登录后几秒内生效），但不适合存关系数据（用户、好友、题库权限）。

| 资源 | 免费额度 |
|------|---------|
| 存储 | 1 GB |
| 读操作 | 100 万次/月 |
| 写操作 | 100 万次/月 |

### 3.6 D1 vs KV vs R2 选择逻辑

| 数据类型 | 存哪里 | 原因 |
|---------|:------:|------|
| 用户账号、好友关系、题库元数据 | **D1** | 关系型，需要 SQL 查询和 JOIN |
| 题库 JSON 文件（大块数据） | **KV** | 按键读取，简单快速，不需要绑卡 |
| 会话令牌（临时数据） | **KV** | 轻量、快读、不需要持久化 |
| 用户答题记录 | **localStorage** | 浏览器端数据，无需上云 |

> **为什么 R2 → KV？** R2 需要绑信用卡才能开通。KV 不需要绑卡，单值最大 25MB，我们的 default.json 才 700KB，完全够用。读取方式也更简单：KV 直接返回字符串，R2 需要 `await obj.text()` 两步。

---

## 四、项目架构总览

### 4.1 架构图

```
┌───────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                        │
│                                                           │
│  前端文件                      API 后端                     │
│  ┌──────────────────┐   ┌──────────────────────────┐      │
│  │ index.html       │   │ /functions/api/           │      │
│  │ css/style.css    │   │  ├─ auth/ (登录/注册)     │      │
│  │ js/app.js        │   │  ├─ banks/ (题库 CRUD)    │      │
│  │ js/api.js        │   │  ├─ friends/ (好友操作)    │      │
│  │ js/parser-*.js   │   │  ├─ users/ (用户搜索)     │      │
│  │ lib/             │   │  └─ admin/ (管理面板)     │      │
│  │ data/            │   │                          │      │
│  └──────────────────┘   └──────────┬───────────────┘      │
└────────────────────────────────────┼───────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────┐
              ▼                      ▼                  ▼
      ┌──────────────┐      ┌──────────────┐    ┌──────────┐
      │    D1        │      │     KV       │    │   KV     │
      │  (数据库)    │      │ (题目文件)   │    │ (会话)   │
      │              │      │ QUESTIONS    │    │ SESSION  │
      │ ● 用户表     │      │              │    │          │
      │ ● 好友关系表  │      │ banks/       │    │ token →  │
      │ ● 题库元数据  │      │  default.json│    │ user_id  │
      └──────────────┘      └──────────────┘    └──────────┘
```

### 4.2 请求流程

```
浏览器请求
  │
  ├─ /api/* ─→ _worker.js（Workers 统一路由入口）
  │              ├─ 中间件：解析 session cookie → 查 KV → 查 D1 → 注入 user
  │              └─ Handler：处理请求，读写 D1/KV
  │
  └─ 其他 ──→ 静态资源（HTML/CSS/JS/JSON）
                └─ SPA 路由：_redirects → index.html
```

### 4.3 纯静态 SPA → 全栈应用的关键转变

| 维度 | 改造前（GitHub Pages，v2.0） | 改造后（Cloudflare，v3.0） |
|------|:---------------------:|:-------------------:|
| 服务端 | 无 | **Pages Functions** |
| 数据库 | 无 | **D1** |
| 文件存储 | npoint.io | **KV** |
| 用户系统 | 无 | **自定义 auth** |
| 会话管理 | 无 | **KV** |
| 数据持久化 | localStorage（浏览器） | D1 + KV（云端） |

### 4.4 数据存储一览

| 数据 | 存储位置 | 说明 |
|------|----------|------|
| 用户/好友/题库元数据 | D1 | 关系查询（好友可见性） |
| Session token | KV (SESSION) | token → user_id，7 天过期 |
| 题目 JSON | KV (QUESTIONS) | 单值最大 25MB |
| 答题记录/收藏 | localStorage | 个人数据，不同步服务端 |

---

## 五、部署全流程（手把手）

### 整体流程图

```
登录 Cloudflare
    │
    ▼
创建云端资源（D1 数据库 + 2 个 KV 命名空间）
    │
    ▼
填入 wrangler.toml（告诉项目用哪些资源）
    │
    ▼
生成管理员密码哈希，填入 seed.sql
    │
    ▼
建表（schema.sql → D1）
    │
    ▼
种子数据（seed.sql → D1）
    │
    ▼
上传默认题库（default.json → KV）
    │
    ▼
本地测试
    │
    ▼
部署到 Cloudflare Pages
    │
    ▼
线上验证 ✅
```

### 前提条件

- Node.js 18+ 已安装
- Cloudflare 账号已注册
- 项目代码已 clone 到本地

### 第 1 步：登录

```bash
cd ultra
npx wrangler login
```

弹浏览器，点授权。成功后 wrangler 记住你的身份，后续命令都带着你的权限。

> **什么是 npx？** npx 是 Node.js 自带的工具，可以临时下载并运行一个 npm 包，不需要全局安装。`npx wrangler login` = 临时下载 wrangler，然后执行 login。好处：不用 `npm install -g wrangler`，不会污染全局环境。

> **什么是 wrangler？** Wrangler 是 Cloudflare 官方的命令行工具，用来在本地开发、管理资源、部署项目到 Cloudflare。类比：Git 管理代码版本，命令行工具是 `git`；Wrangler 管理 Cloudflare 上的资源，命令行工具是 `npx wrangler`。

### 第 2 步：创建云端资源

Cloudflare 提供三种存储，我们的项目用了两种：

| 资源 | 用途 | 类比 |
|------|------|------|
| **D1** | 关系型数据库，存用户/好友/题库元数据 | MySQL |
| **KV** (SESSION) | 存登录 session（token → 用户ID） | Redis |
| **KV** (QUESTIONS) | 存题目的 JSON 大文件 | 对象存储 |

创建命令：

```bash
npx wrangler d1 create exam-prep-db          # 创建数据库
npx wrangler kv namespace create SESSION      # 创建 session 存储
npx wrangler kv namespace create QUESTIONS    # 创建题目存储
```

每个命令执行后会输出一个 ID，类似 `e7c2a462-2b73-468b-8c4a-e1258509d3f5`，**这个 ID 是资源的唯一标识，后面要用**。

### 第 3 步：填入 wrangler.toml

`wrangler.toml` 是项目的配置文件，告诉 Cloudflare："我的项目要用哪些资源"。

```toml
name = "exam-prep-ultra"
compatibility_date = "2024-12-01"
pages_build_output_dir = "./"

# 顶层：本地开发用
[[d1_databases]]
binding = "DB"              # 代码里用 env.DB 访问
database_name = "exam-prep-db"
database_id = "第2步获得的数据库ID"

[[kv_namespaces]]
binding = "SESSION"          # 代码里用 env.SESSION 访问
id = "第2步获得的SESSION ID"

[[kv_namespaces]]
binding = "QUESTIONS"        # 代码里用 env.QUESTIONS 访问
id = "第2步获得的QUESTIONS ID"

# env.production：线上部署用（必须重复声明，否则线上绑定会丢失！）
[[env.production.d1_databases]]
binding = "DB"
database_name = "exam-prep-db"
database_id = "同上"

[[env.production.kv_namespaces]]
binding = "SESSION"
id = "同上"

[[env.production.kv_namespaces]]
binding = "QUESTIONS"
id = "同上"
```

**⚠️ 关键踩坑**：必须同时声明顶层和 `env.production`，否则部署时绑定会丢失，线上 `env.DB` 就是 undefined！

### 第 4 步：生成管理员密码哈希

```bash
node scripts/gen-admin-hash.js admin123
# 输出：8cECt69wvlVRL3Y+4hvxLQ==:pHc1HUC6qQHyxMFOdRFiYLNg8f4eQp5MSbPOYXu95KU=
```

复制输出的哈希值，替换 `seed.sql` 中的 `__ADMIN_HASH_PLACEHOLDER__`。

**为什么不直接在 seed.sql 里写明文密码？** 因为数据库里存的就是哈希，登录时用同样的算法算哈希再比对，永远不存明文。这个脚本做的事：
1. 生成 16 字节随机 salt
2. 用 PBKDF2-SHA256 算法对密码做 10 万次迭代
3. 输出 `salt:hash` 格式的字符串

> **什么是密码哈希？** 哈希是一种单向加密——明文变成密文，但密文不能反推回明文。即使数据库泄露，攻击者也看不到用户密码。PBKDF2 是一种慢哈希算法，故意算得很慢（10万次迭代），让暴力破解变得不现实。

### 第 5 步：建表

```bash
npx wrangler d1 execute exam-prep-db --remote --file=schema.sql
```

把 `schema.sql` 里的 SQL 发到云端 D1 执行，创建 3 张表：users、friends、banks。

类比：新买了一个 MySQL 数据库，先 `CREATE TABLE` 建好表结构。

> **`--remote` 是什么意思？** 不加 `--remote` 操作的是**本地**模拟环境（存在你电脑上）；加 `--remote` 操作的是**云端**真实环境。生产数据必须加 `--remote`，否则数据只写到你本地，线上访问不到。

### 第 6 步：种子数据

**种子数据**就是"初始数据"——建完数据库后，往空表里插入的最基本的数据，让系统第一次启动就能用。

类比：买了新手机 → 开机后有默认壁纸、默认铃声 = 种子数据。

```bash
npx wrangler d1 execute exam-prep-db --remote --file=seed.sql
```

种子数据包含：
- **管理员账号**：`admin@example.com`，没有管理员就无法登录管理面板
- **默认题库记录**：指向 KV 中的 `banks/default.json`，`is_default = 1` 表示系统自带题库

> **`INSERT OR IGNORE` 是什么？** `INSERT` 插入数据，`OR IGNORE` 表示如果这条数据已存在（主键冲突）就跳过不报错。好处：seed.sql 可以重复执行。

种子数据 vs 用户数据：

| | 种子数据 | 用户数据 |
|--|---------|---------|
| 什么时候产生 | 部署时一次性插入 | 用户注册/使用时产生 |
| 存在哪里 | seed.sql 文件 | 数据库 |
| 谁创建的 | 开发者 | 用户自己 |
| 例子 | 管理员账号、默认题库 | 普通用户、好友关系、用户创建的题库 |

### 第 7 步：上传默认题库

```bash
npx wrangler kv key put --namespace-id=第2步获得的QUESTIONS_ID --remote "banks/default.json" --path=data/default.json
```

把本地 `data/default.json`（700KB，191 道题）上传到云端 KV，key 是 `banks/default.json`。

线上代码通过 `env.QUESTIONS.get("banks/default.json")` 就能读到题目。

### 第 8 步：本地测试

```bash
npx wrangler pages dev .
```

验证清单：
- [ ] 打开 http://localhost:8788 → 页面正常加载
- [ ] 默认题库（大学英语4）题目正常显示
- [ ] 注册新账号 → 成功
- [ ] 登录 admin@example.com / 你设的密码 → 成功
- [ ] header 显示昵称 + 👥 + ⚙ 按钮
- [ ] 点 👥 → 好友弹窗，搜索用户正常
- [ ] 点 ⚙ → 管理面板，用户/题库列表正常
- [ ] 退出 → 回到"登录"按钮
- [ ] 未登录时刷题正常

### 第 9 步：部署到生产环境

```bash
# 首次：创建项目
npx wrangler pages project create exam-prep-ultra --production-branch=main

# 部署
npx wrangler pages deploy . --project-name=exam-prep-ultra --branch=main --commit-dirty=true
```

> `--commit-dirty=true` 表示允许部署未 git commit 的文件。正式项目建议先 commit 再部署。

部署成功后访问：👉 `https://exam-prep-ultra.pages.dev/`

### 第 10 步：生产环境验证

1. 访问 Cloudflare 给出的 URL
2. 注册一个普通用户账号
3. 用管理员账号登录，在管理面板确认普通用户存在
4. 搜索好友，发送/接受请求
5. 确认好友可见对方的私有题库
6. 确认离线（断网）仍可刷本地题库

---

## 六、关键知识点

### 6.1 密码安全

- 本项目使用 **PBKDF2 + SHA-256**（Web Crypto API 原生支持）
- Workers 环境中可用 `crypto.subtle.deriveKey`，无需额外依赖
- 不要用 `bcryptjs` 在 Workers 里跑（太重，可能在 10ms CPU 限制内跑不完）
- 永远不存明文密码

### 6.2 权限模型

```
可见性规则（从高到低）：
  1. is_default = 1 的题库 → 所有人可见（包括未登录）
  2. is_public = 1 的题库 → 所有人可见
  3. is_public = 0 的题库 → 仅自己 + 已接受的好友可见

好友关系机制：
  A 向 B 发请求 → B 接受 → 双方好友（双向关系）
  好友之间自动看到对方的私有题库
  超级管理员默认是所有用户的好友
```

### 6.3 SPA 路由处理

纯前端 SPA 在 Cloudflare Pages 上需要处理路径回退：

```
# _redirects 文件（放在 ultra/ 目录根）
/*    /index.html   200
```

这确保用户直接刷新 `/banks/123` 这样的路径时，始终返回 `index.html`，由前端 JS 解析路径。否则 Cloudflare 会去找 `/banks/123` 这个文件，找不到就 404。

### 6.4 常用 Wrangler 命令速查

| 操作 | 命令 |
|------|------|
| 登录 | `npx wrangler login` |
| 查看登录状态 | `npx wrangler whoami` |
| 创建 D1 数据库 | `npx wrangler d1 create <名称>` |
| 执行 SQL 文件 | `npx wrangler d1 execute <库名> --remote --file=xxx.sql` |
| 查询数据 | `npx wrangler d1 execute <库名> --remote --command "SELECT * FROM users;"` |
| 创建 KV 命名空间 | `npx wrangler kv namespace create <名称>` |
| 往 KV 写数据 | `npx wrangler kv key put --namespace-id=xxx --remote "键名" --path=本地文件` |
| 本地开发 | `npx wrangler pages dev .` |
| 部署 | `npx wrangler pages deploy . --project-name=xxx --branch=main` |

### 6.5 离线兼容

- 未登录用户：完全本地运行，不依赖网络
- 登录用户：API 失败时自动降级到 localStorage 缓存
- 题库加载：本地 → API + 缓存 → npoint 三级 fallback

---

## 七、踩坑点

| # | 踩坑 | 原因 | 解决 |
|:-:|------|------|------|
| 1 | Workers 10ms CPU 限制 | 免费 Worker 最多跑 10ms CPU 时间 | 保持后端逻辑轻量；题库解析放浏览器端 |
| 2 | D1 冷启动 200-500ms | D1 是无服务器数据库，首次请求需唤醒 | 用户感知为正常加载，不影响使用 |
| 3 | SPA 刷新 404 | Pages 默认找不到文件路径时返回 404 | 加 `_redirects` 文件回退到 index.html |
| 4 | Pages Functions 路径规则 | `functions/api/banks/[id].js` 匹配 `/api/banks/123` | 文件名 `[id].js` 是 Pages Functions 的动态路由语法 |
| 5 | wrangler.toml 绑定丢失 | 只声明顶层，没声明 `env.production` | 两处都声明，确保线上绑定不丢 |
| 6 | R2 需要绑卡 | R2 免费套餐仍需绑信用卡 | 改用 KV 存题目 JSON，不需要绑卡 |
| 7 | KV 最终一致性 | KV 写入后全球传播需要几秒 | 会话令牌用 KV 没问题；权限校验用 D1（强一致） |
| 8 | Cookie 本地不生效 | `wrangler pages dev` 默认用 HTTP，Cookie 设了 `Secure` | 本地测试时临时去掉 Secure 或用 `--https` 参数 |
| 9 | 文件路径大小写 | Linux 环境区分大小写（Cloudflare 构建环境是 Linux） | 确保 import 路径与实际文件名大小写一致 |
| 10 | npoint.io 迁移 | 旧数据在 npoint.io 上，用户也有本地缓存 | 先上传 default.json 到 KV，再改前端代码指向 API |

---

## 八、重新部署 / 数据库操作

### 日常部署（只改了代码）

```bash
cd ultra
npx wrangler pages deploy . --project-name=exam-prep-ultra --branch=main --commit-dirty=true
```

### 改了数据库结构（需要重建表）

```bash
# ⚠️ 会丢数据！生产环境慎用
npx wrangler d1 execute exam-prep-db --remote --command="DROP TABLE IF EXISTS banks; DROP TABLE IF EXISTS friends; DROP TABLE IF EXISTS users;"

# 重建
npx wrangler d1 execute exam-prep-db --remote --file=schema.sql
npx wrangler d1 execute exam-prep-db --remote --file=seed.sql
```

### 只改种子数据（如换管理员密码）

```bash
# 重新生成哈希
node scripts/gen-admin-hash.js 新密码

# 替换 seed.sql 中的哈希值后重新执行
npx wrangler d1 execute exam-prep-db --remote --file=seed.sql
```

### 数据库备份

```bash
npx wrangler d1 export exam-prep-db --remote --output=backup.sql
```

### 回滚部署

```bash
npx wrangler pages deployment list --project-name=exam-prep-ultra
npx wrangler pages deployment rollback --project-name=exam-prep-ultra
```

数据库回滚需要手动操作（建议部署前先 export 备份）。

### 快捷脚本（package.json 已配置）

```bash
npm run dev          # 本地开发
npm run deploy       # 部署到生产
npm run db:schema    # 建表
npm run db:seed      # 插入种子数据
npm run db:reset     # 重置数据库（删表 + 重建 + 种子）
npm run gen:admin    # 生成管理员密码哈希
```

---

## 九、知识链接

| 文档 | 地址 |
|------|------|
| Cloudflare Pages 文档 | https://developers.cloudflare.com/pages/ |
| Pages Functions 文档 | https://developers.cloudflare.com/pages/functions/ |
| D1 文档 | https://developers.cloudflare.com/d1/ |
| R2 文档 | https://developers.cloudflare.com/r2/ |
| KV 文档 | https://developers.cloudflare.com/kv/ |
| Wrangler CLI 文档 | https://developers.cloudflare.com/workers/wrangler/ |
| Web Crypto API（密码哈希） | https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API |
