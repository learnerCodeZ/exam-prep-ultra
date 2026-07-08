# AGENTS.md

## 项目概述

期末刷题宝典 Ultra — 全栈在线刷题工具，支持导入 Word/Markdown/PDF/粘贴文本题库，部署在 Cloudflare Pages，后端使用 D1 + KV + Pages Functions。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 原生 HTML/CSS/JS（无框架，无构建） |
| 后端 | Cloudflare Pages Functions（Workers） |
| 数据库 | Cloudflare D1（SQLite）— 用户/好友/题库元数据 |
| 缓存/Session | Cloudflare KV (SESSION) — token → user_id，7 天过期 |
| 题目存储 | Cloudflare KV (QUESTIONS) — JSON 大文件，单值最大 25MB |
| 部署 | Cloudflare Pages |
| 文档解析 | mammoth.js（Word）、pdf.js（PDF） |

## 代码结构

### 前端

- `index.html` — 单页应用入口
- `css/style.css` — 全部样式
- `js/app.js` — 主逻辑：渲染、交互、状态管理
- `js/api.js` — API 统一封装（fetch + 错误处理 + 自动降级）
- `js/auth-ui.js` — 登录/注册弹窗
- `js/friends-ui.js` — 好友管理弹窗
- `js/admin-ui.js` — 管理员面板
- `js/parser-md.js` — Markdown/纯文本题库解析（含单选、多选、判断、听力、匹配、填空、阅读）
- `js/parser-docx.js` — Word 题库解析（调用 mammoth.js）
- `js/parser-pdf.js` — PDF 题库解析（调用 pdf.js）
- `lib/` — 第三方库（mammoth.min.js, pdf.min.js, pdf.worker.min.js）
- `data/default.json` — 内置 fallback 题库

### 后端

- `_worker.js` — Workers 统一路由入口
- `functions/_middleware.js` — 认证中间件（解析 session cookie → 查 KV → 查 D1 → 注入 user）
- `functions/api/auth/` — register, login, logout, me
- `functions/api/banks/` — index, [id], [id]/questions
- `functions/api/users/` — search
- `functions/api/friends/` — index, request, accept, reject
- `functions/api/admin/` — users, banks

### 配置 & 数据

- `wrangler.toml` — Cloudflare 配置（D1 + KV 绑定）
- `schema.sql` — D1 建表 SQL（users, friends, banks）
- `seed.sql` — 种子数据（管理员 + 默认题库）
- `scripts/gen-admin-hash.js` — 生成管理员密码 PBKDF2 哈希
- `_redirects` — SPA 路由规则

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

## 数据存储

| 数据 | 存储位置 | 说明 |
|------|----------|------|
| 用户/好友/题库元数据 | D1 | 关系查询（好友可见性） |
| Session token | KV (SESSION) | token → user_id，7 天过期 |
| 题目 JSON | KV (QUESTIONS) | 单文件最大 25MB |
| 答题记录/收藏 | localStorage | 个人数据，不同步服务端 |

## 请求流程

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

## 关键决策

- 题型动态化：tab 从 question.typeName 自动生成，不硬编码
- UI 按结构渲染：根据 wordBank/passages 有无决定 UI 模式，不依赖 type 字段
- 离线兼容：未登录用户完全本地运行；登录用户 API 失败时自动降级到 localStorage 缓存
- 题库加载三级 fallback：本地 → API + 缓存 → npoint
- 密码安全：PBKDF2 哈希，不存明文
- Session：KV 存储 token，7 天过期，HttpOnly + Secure Cookie
- 纯 vanilla JS，不引入框架

## 注意事项

- localStorage 容量约 5-10MB，大量题库导入需提示用户
- Word 双栏排版会导致 mammoth 丢失右栏内容，需用户注意
- 移动端适配是必须的，多数学生会用手机刷题
- D1 免费额度：5M 读/100K 写/天，注意用量
- KV 免费额度：100K 读/1K 写/天
