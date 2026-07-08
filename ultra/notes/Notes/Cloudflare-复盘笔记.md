# Cloudflare 复盘笔记

> 日期：2026-07-07
> 主题：Cloudflare 官网、免费服务及刷题宝典部署方案总结

---

## 1. Cloudflare 官网

| 项目 | 地址 |
|------|------|
| **国际官网** | [https://www.cloudflare.com](https://www.cloudflare.com) |
| **中国站** | [https://www.cloudflare-cn.com](https://www.cloudflare-cn.com) |
| **控制台（Dashboard）** | [https://dash.cloudflare.com](https://dash.cloudflare.com) |
| **开发者文档** | [https://developers.cloudflare.com](https://developers.cloudflare.com) |

> **注**：中国站（.cn）有独立的运营主体（Cloudflare 与京东云合作），中国站的产品线和免费套餐可能与国际版不同。本项目使用国际版 `cloudflare.com` 的免费套餐。

### 注册步骤

```
1. 打开 https://dash.cloudflare.com/sign-up
2. 输入邮箱 → 设置密码 → 验证邮箱
3. 注册后自动进入 Dashboard
4. 免费账号即包含 Pages / Workers / D1 / R2 / KV 的免费额度
```

---

## 2. 项目涉及的核心 Cloudflare 产品

### 2.1 Cloudflare Pages —— 静态网站托管

**对标**：GitHub Pages、Netlify、Vercel

**核心能力**：托管静态文件（HTML/CSS/JS），全球 CDN 加速，自动 HTTPS

**本项目用途**：托管刷题宝典的前端 SPA 文件（index.html / css / js / lib / data）

| 要点 | 说明 |
|------|------|
| 部署方式 | 关联 GitHub 仓库自动部署，或直接拖拽上传 |
| 自定义域名 | 支持绑定自己的域名，自动签发免费 SSL 证书 |
| 分支预览 | 每个 PR 自动生成预览链接 |
| 目录配置 | 项目的 ultra/ 子目录设为 Root directory |
| SPA 路由 | 需创建 `_redirects` 文件：`/* /index.html 200` |
| 免费额度 | 无限带宽 + 500 次构建/月 |

### 2.2 Cloudflare Workers / Pages Functions —— 服务端函数

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

### 2.3 Cloudflare D1 —— 无服务器 SQLite 数据库

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

### 2.4 Cloudflare R2 —— 对象存储

**对标**：AWS S3、阿里云 OSS

**核心能力**：存储任意文件（JSON / 图片 / 视频），零出站流量费

**为什么适合本项目**：
- 题库是 JSON 大文件（190 题约 700KB），不适合存 D1
- R2 按 Key 直接读取单个题库，适合"按需加载"场景
- **零出站费**：在中国地区访问不额外收费

| 资源 | 免费额度 |
|------|---------|
| 存储 | 10 GB |
| A 类操作（写/上传） | 100 万次/月 |
| B 类操作（读/下载） | 1000 万次/月 |
| 出站流量 | **免费（无 egress 费用）** |

### 2.5 Cloudflare KV —— 键值存储

**对标**：Redis、Memcached

**核心能力**：全球分布式键值缓存，亚毫秒级读取

**本项目用途**：存储用户会话（session token），替代 D1 存 session

**注意**：KV 是最终一致性，写入后全球传播需要几秒到几十秒。存会话令牌没问题（登录后几秒内生效），但不适合存关系数据（用户、好友、题库权限）。

| 资源 | 免费额度 |
|------|---------|
| 存储 | 1 GB |
| 读操作 | 100 万次/月 |
| 写操作 | 100 万次/月 |

---

## 3. 本项目的架构总览

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
│  │ data/          │   │                          │      │
│  └──────────────────┘   └──────────┬───────────────┘      │
└────────────────────────────────────┼───────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────┐
              ▼                      ▼                  ▼
      ┌──────────────┐      ┌──────────────┐    ┌──────────┐
      │    D1        │      │     R2       │    │   KV     │
      │  (数据库)    │      │  (题库文件)   │    │ (会话)   │
      │              │      │              │    │          │
      │ ● 用户表     │      │ default.json  │    │ session_  │
      │ ● 好友关系表  │      │ user1_bank1  │    │ 令牌     │
      │ ● 题库元数据  │      │ user1_bank2  │    │          │
      │ ● 会话(可选) │      │ user2_bank1  │    │          │
      └──────────────┘      └──────────────┘    └──────────┘
```

---

## 4. 学习要点

### 4.1 纯静态 SPA → 全栈应用的关键转变

| 维度 | 改造前（GitHub Pages） | 改造后（Cloudflare） |
|------|:---------------------:|:-------------------:|
| 服务端 | 无 | **Pages Functions** |
| 数据库 | 无 | **D1** |
| 文件存储 | npoint.io | **R2** |
| 用户系统 | 无 | **自定义 auth** |
| 会话管理 | 无 | **KV** |
| 数据持久化 | localStorage（浏览器） | D1 + R2（云端） |

### 4.2 D1 vs KV vs R2 的选择逻辑

| 数据类型 | 存哪里 | 原因 |
|---------|:------:|------|
| 用户账号、好友关系、题库元数据 | **D1** | 关系型，需要 SQL 查询和 JOIN |
| 题库 JSON 文件（大块数据） | **R2** | 对象存储，按 Key 读 |
| 会话令牌（临时数据） | **KV**（或 D1） | 轻量、快读、不需要持久化 |
| 用户答题记录 | **localStorage** | 仍然是浏览器端数据，无需上云 |

### 4.3 密码安全

- 本项目使用 **PBKDF2 + SHA-256**（Web Crypto API 原生支持）
- Workers 环境中可用 `crypto.subtle.deriveKey`，无需额外依赖
- 不要用 `bcryptjs` 在 Workers 里跑（太重，可能在 10ms CPU 限制内跑不完）
- 永远不存明文密码

### 4.4 权限模型

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

### 4.5 SPA 路由处理

纯前端 SPA 在 Cloudflare Pages 上需要处理路径回退：

```
# _redirects 文件（放在 ultra/ 目录根）
/*    /index.html   200
```

这确保用户直接刷新 `/banks/123` 这样的路径时，始终返回 `index.html`，由前端 JS 解析路径。

### 4.6 wrangler.toml 配置（参考）

```toml
# wrangler.toml（放在 ultra/ 目录）
name = "exam-prep-ultra"
pages_build_output_dir = "."

[[d1_databases]]
binding = "DB"
database_name = "exam-prep-db"
database_id = "你的数据库ID"

[[r2_buckets]]
binding = "QUESTIONS"
bucket_name = "exam-questions"

[[kv_namespaces]]
binding = "SESSION"
id = "你的KV命名空间ID"
```

---

## 5. 常用命令

### Wrangler CLI（Cloudflare 的命令行工具）

```bash
# 安装
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建 D1 数据库
wrangler d1 create exam-prep-db

# 执行 SQL（初始化表结构）
wrangler d1 execute exam-prep-db --file schema.sql

# 查询数据
wrangler d1 execute exam-prep-db --command "SELECT * FROM users;"

# 创建 R2 存储桶
wrangler r2 bucket create exam-questions

# 上传文件到 R2
wrangler r2 object put exam-questions/default.json --file data/default.json

# 获取 R2 文件
wrangler r2 object get exam-questions/default.json

# 创建 KV 命名空间
wrangler kv:namespace create "SESSION"

# 本地开发（运行 Pages + Functions）
wrangler pages dev ./

# 部署
wrangler pages publish ./
```

### Pages Dashboard 操作

```
1. 登录 https://dash.cloudflare.com
2. 左侧菜单 → Workers & Pages
3. 点击 Pages 项目 → 可查看部署状态、绑定资源、自定义域名
4. "Settings" → "Functions" → 绑定 D1 / R2 / KV
```

---

## 6. 踩坑点

| 序号 | 踩坑 | 原因 | 解决 |
|:----:|------|------|------|
| 1 | Workers 10ms CPU 限制 | 免费 Worker 最多跑 10ms CPU 时间 | 保持后端逻辑轻量；题库解析放浏览器端 |
| 2 | D1 冷启动 200-500ms | D1 是无服务器数据库，首次请求需唤醒 | 用户感知为正常加载，不影响使用 |
| 3 | SPA 刷新 404 | Pages 默认找不到文件路径时返回 404 | 加 `_redirects` 文件回退到 index.html |
| 4 | Pages Functions 路径规则 | `functions/api/banks/[id].js` 匹配 `/api/banks/123` | 文件名 `[id].js` 是 Pages Functions 的动态路由语法 |
| 5 | R2 直接公开访问 | R2 默认不对外公开，需要签名 URL 或 Workers 代理 | 通过 Pages Functions 读取 R2 后返回给前端 |
| 6 | KV 最终一致性 | KV 写入后全球传播需要时间 | 会话令牌用 KV 没问题；权限校验用 D1（强一致） |
| 7 | 文件路径大小写 | Linux 环境区分大小写（Cloudflare 构建环境是 Linux） | 确保 import 路径与实际文件名大小写一致 |
| 8 | npoint.io 迁移 | 旧数据在 npoint.io 上，用户也有本地缓存 | 先用 wrangler r2 上传 default.json，再改前端代码指向 API |

---

## 7. 关键知识链接

| 文档 | 地址 |
|------|------|
| Cloudflare Pages 文档 | https://developers.cloudflare.com/pages/ |
| Pages Functions 文档 | https://developers.cloudflare.com/pages/functions/ |
| D1 文档 | https://developers.cloudflare.com/d1/ |
| R2 文档 | https://developers.cloudflare.com/r2/ |
| KV 文档 | https://developers.cloudflare.com/kv/ |
| Wrangler CLI 文档 | https://developers.cloudflare.com/workers/wrangler/ |
| Web Crypto API（密码哈希） | https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API |
