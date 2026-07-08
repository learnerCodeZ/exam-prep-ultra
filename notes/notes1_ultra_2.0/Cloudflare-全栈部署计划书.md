# Cloudflare 全栈部署计划书 —— 期末刷题宝典 Ultra

> 日期：2026-07-07
> 目标：从纯静态 SPA 升级为带用户系统的全栈应用，部署在 Cloudflare 免费套餐
> 状态：计划中

---

## 1. 需求总览

| 功能 | 说明 |
|------|------|
| **用户登录/注册** | 邮箱 + 密码注册登录，开箱即用 |
| **默认题库** | 所有人可见（公开），不可设为私密 |
| **私人题库** | 用户可以创建自己的题库，可设置公开/私密 |
| **题库可见规则** | 默认=公开；自己创建的=可切换公开/私密；好友的仓库互相可见 |
| **添加好友** | 搜索用户→发送好友请求→对方同意→成为好友 |
| **好友可见** | 加好友后，双方创建的题库全部互相可见 |
| **超级管理员** | 预设一个超级管理员账号，自动是所有人的好友 |

---

## 2. 架构方案

### 2.1 推荐方案

```
┌───────────────────────────────────────────────────┐
│               Cloudflare Pages                     │
│  (免费: 无限带宽, 500 构建/月)                     │
│                                                    │
│  前端 SPA: index.html + CSS + JS + lib/            │
│  API 后端: /functions/ 目录下的 Pages Functions     │
└────────────────────┬──────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌────────┐ ┌──────────┐
│  Cloudflare  │ │ R2     │ │   KV     │
│  D1 (SQLite) │ │ (题库  │ │ (会话    │
│              │ │  JSON) │ │  令牌)   │
│  • 用户       │ │        │ │          │
│  • 好友关系   │ │ 免费   │ │  免费    │
│  • 题库元数据 │ │ 10GB   │ │  100万   │
│  • 共享权限   │ │        │ │  读/月   │
│               │ │        │ │          │
│  免费 500MB   │ │        │ │          │
└──────────────┘ └────────┘ └──────────┘
```

### 2.2 为什么选这个方案

| 组件 | 选择 | 理由 |
|------|------|------|
| **托管** | Cloudflare Pages | 免费、全球 CDN、同一域名（无跨域问题） |
| **API 后端** | Pages Functions | 和前端同域名部署，无需额外 CORS 配置 |
| **关系数据库** | D1 (SQLite) | 关系型数据（用户/好友/题库元数据），免费 500MB 足够 |
| **题库文件存储** | R2 (对象存储) | 每个题库是大 JSON，适合 R2，免费 10GB |
| **会话令牌** | KV | 轻量临时数据，读写快 |

### 2.3 免费额度够用吗？

| 服务 | 免费额度 | 本项目的用量估算 | 结论 |
|------|---------|-----------------|:----:|
| Cloudflare Pages | 无限带宽，500 构建/月 | ~10 构建/月 | ✅ |
| D1 | 500MB, 500万读, 10万写/月 | 1MB, 3万读, 5千写/月 | ✅ |
| R2 | 10GB, 1000万读/月 | 100MB, 3万读/月 | ✅ |
| KV | 1GB, 100万读/月 | 1MB, 1万读/月 | ✅ |
| Workers/Pages Functions | 10万请求/天 | 1千请求/天 | ✅ |

**结论：免费套餐完全覆盖，零成本运营。**

---

## 3. 数据库设计（D1）

### 3.1 用户表（users）

```sql
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,              -- PBKDF2 哈希
  nickname    TEXT NOT NULL,
  role        TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  created_at  TEXT DEFAULT (datetime('now'))
);
```

### 3.2 好友关系表（friends）

```sql
CREATE TABLE friends (
  user_id     INTEGER NOT NULL,
  friend_id   INTEGER NOT NULL,
  status      TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
  created_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, friend_id),
  FOREIGN KEY (user_id)   REFERENCES users(id),
  FOREIGN KEY (friend_id) REFERENCES users(id)
);
```

**好友可见逻辑**：A 和 B 的 friendship 状态为 `'accepted'` 时，双方创建的私有题库对对方可见。

### 3.3 题库元数据表（banks）

```sql
CREATE TABLE banks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  is_default  INTEGER DEFAULT 0,         -- 1=默认题库（管理员创建）
  is_public   INTEGER DEFAULT 1,         -- 1=公开, 0=私密
  r2_key      TEXT NOT NULL,             -- R2 中的对象 key
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
```

**可见规则**：
| 条件 | 谁可以看到 |
|------|-----------|
| `is_default = 1` | 所有人（包括未登录用户） |
| `is_public = 1` | 所有人 |
| `is_public = 0` | 仅自己和已接受的好友 |

### 3.4 会话令牌表（可选，如果用 D1 存 session）

```sql
CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

> **注**：推荐用 KV 存储会话令牌（更快），但如果 KV 未配置，也可以用 D1 存。

---

## 4. API 设计（Pages Functions）

### 4.1 认证 API

| 方法 | 路径 | 认证 | 说明 |
|:----:|------|:----:|------|
| POST | `/api/auth/register` | ❌ | 注册（email, password, nickname） |
| POST | `/api/auth/login` | ❌ | 登录，返回 session token（写入 cookie） |
| POST | `/api/auth/logout` | ✅ | 登出，清除会话 |
| GET | `/api/auth/me` | ✅ | 获取当前用户信息 |

### 4.2 题库 API

| 方法 | 路径 | 认证 | 说明 |
|:----:|------|:----:|------|
| GET | `/api/banks` | ✅ | 获取当前用户可见的题库列表 |
| POST | `/api/banks` | ✅ | 创建新题库（name, is_public, questions） |
| GET | `/api/banks/:id` | ✅ | 获取题库详情（含可见性检查） |
| PUT | `/api/banks/:id` | ✅ | 更新题库属性（name, is_public） |
| DELETE | `/api/banks/:id` | ✅ | 删除自己的题库 |
| PUT | `/api/banks/:id/questions` | ✅ | 更新题库题目内容（写入 R2） |
| GET | `/api/banks/:id/questions` | ✅ | 获取题库题目（从 R2 读取） |

### 4.3 好友 API

| 方法 | 路径 | 认证 | 说明 |
|:----:|------|:----:|------|
| GET | `/api/users/search?q=` | ✅ | 搜索用户（按昵称或邮箱） |
| POST | `/api/friends/request` | ✅ | 发送好友请求（target_user_id） |
| POST | `/api/friends/accept` | ✅ | 接受好友请求（friend_id） |
| POST | `/api/friends/reject` | ✅ | 拒绝好友请求（friend_id） |
| GET | `/api/friends` | ✅ | 获取好友列表（含待处理请求） |
| DELETE | `/api/friends/:id` | ✅ | 删除好友 |

### 4.4 管理 API

| 方法 | 路径 | 认证 | 说明 |
|:----:|------|:----:|------|
| GET | `/api/admin/users` | 管理员 | 获取所有用户列表 |
| GET | `/api/admin/banks` | 管理员 | 获取所有题库 |
| DELETE | `/api/admin/users/:id` | 管理员 | 删除用户 |

---

## 5. 前端改动

### 5.1 新增文件

```
ultra/
├── functions/                    ← 新增：API 后端（Cloudflare Pages Functions）
│   ├── _middleware.js            ← 认证中间件（验证 session）
│   ├── api/
│   │   ├── auth/
│   │   │   ├── register.js
│   │   │   ├── login.js
│   │   │   ├── logout.js
│   │   │   └── me.js
│   │   ├── banks/
│   │   │   ├── index.js          ← GET/POST /api/banks
│   │   │   ├── [id].js           ← GET/PUT/DELETE /api/banks/:id
│   │   │   └── [id]/questions.js ← GET/PUT /api/banks/:id/questions
│   │   ├── friends/
│   │   │   ├── index.js          ← GET /api/friends
│   │   │   ├── request.js
│   │   │   ├── accept.js
│   │   │   └── reject.js
│   │   ├── users/
│   │   │   └── search.js
│   │   └── admin/
│   │       ├── users.js
│   │       └── banks.js
├── js/
│   ├── api.js                   ← 新增：封装所有 API 调用
│   ├── app.js                   ← 修改：增加登录/用户状态逻辑
│   ├── auth-ui.js               ← 新增：登录/注册弹窗 UI
│   ├── friends-ui.js            ← 新增：好友管理弹窗 UI
│   └── admin-ui.js              ← 新增：管理员面板 UI
├── css/
│   └── style.css                ← 修改：增加新组件的样式
├── wrangler.toml                ← 新增：Cloudflare 配置文件
└── _redirects                    ← 新增：SPA 路由重定向规则
```

### 5.2 核心改动：app.js

| 改动点 | 说明 |
|--------|------|
| `NPOINT_URL` 移除 | 改为通过 API 获取默认题库 |
| `state.user` 新增 | 当前登录用户信息（null 表示未登录） |
| `state.friendList` 新增 | 好友列表 |
| `state.pendingRequests` 新增 | 待处理的好友请求 |
| `init()` 增加 | 检查是否有有效 session（自动登录） |
| `loadBank()` 改造 | 从 API 加载题库（而非 localStorage / npoint） |
| `createBank()` 新增 | 创建题库的 UI 和 API 调用 |
| 侧栏改造 | 增加用户状态（头像/昵称/登出），好友入口，管理入口 |
| Header 改造 | 增加登录/注册按钮（未登录时显示） |

### 5.3 新增 UI 组件

**登录/注册弹窗**（auth-ui.js）
```
┌───────────────────────────┐
│  📝 登录 / 注册            │
│                           │
│  [邮箱]                    │
│  [密码]                    │
│  [昵称]  ← 注册时显示       │
│                           │
│  [登录] [切换到注册]        │
└───────────────────────────┘
```

**好友管理弹窗**（friends-ui.js）
```
┌───────────────────────────┐
│  👥 我的好友               │
│                           │
│  [搜索用户...] [搜索]       │
│                           │
│  ── 好友列表 ──            │
│  • 小明 ─ 查看他的题库 [X]  │
│  • 小红 ─ 查看她的题库 [X]  │
│                           │
│  ── 待处理请求 ──           │
│  • 小花  [接受] [拒绝]      │
└───────────────────────────┘
```

**管理员面板**（admin-ui.js）
```
┌───────────────────────────┐
│  ⚙️ 管理面板               │
│                           │
│  ── 用户管理 ──            │
│  • 小明 (user)  [删除]     │
│  • 小红 (user)  [删除]     │
│                           │
│  ── 所有题库 ──            │
│  • 大学英语4 (默认)        │
│  • 小明的四级题库          │
└───────────────────────────┘
```

---

## 6. 超级管理员机制

### 6.1 创建方式

**方案**：在项目部署时，通过 Wrangler 命令直接写入 D1 数据库：

```bash
# 创建超级管理员（密码后期可通过管理员 API 修改）
wrangler d1 execute DB_NAME --command \
  "INSERT INTO users (email, password, nickname, role) \
   VALUES ('admin@example.com', 'HASHED_PASSWORD', '超级管理员', 'admin');"
```

### 6.2 自动好友机制

超级管理员注册后，系统自动将其与**所有用户**建立已接受的好友关系：

```javascript
// 在用户注册的 API 中增加逻辑：
async function onUserRegister(newUserId) {
  // 1. 查询超级管理员
  const admin = await db.prepare(
    "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
  ).first();

  // 2. 自动建立与管理员的好友关系
  if (admin) {
    await db.prepare(
      "INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')"
    ).bind(newUserId, admin.id).run();

    await db.prepare(
      "INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')"
    ).bind(admin.id, newUserId).run();
  }
}
```

这样，新注册用户自动能看到超级管理员创建的"默认题库"。

### 6.3 默认题库归属

默认题库 `owner_id = 超级管理员.id`，`is_default = 1`，不可修改为私密。

---

## 7. 数据迁移（从 npoint.io 到 R2）

### 7.1 步骤

```bash
# 1. 上传默认题库到 R2
wrangler r2 object put exam-questions/default.json --file data/default.json

# 2. 在 D1 中创建默认题库记录
wrangler d1 execute DB_NAME --command \
  "INSERT INTO banks (owner_id, name, is_default, is_public, r2_key) \
   VALUES (1, '大学英语4（默认）', 1, 1, 'default.json');"
```

### 7.2 向后兼容

部署后，未登录用户仍然可以刷题（默认题库所有人可见）。

---

## 8. 费用总结

| 服务 | 免费额度 | 超出费用 |
|------|---------|---------|
| Cloudflare Pages | 无限带宽，500构建/月 | 超出部分按量计费（几乎不会超） |
| D1 | 500MB，500万读+10万写/月 | $0.75/GB 存储，$0.05/百万读 |
| R2 | 10GB，1000万读/月 | $0.015/GB/月，$0.36/百万次操作 |
| KV | 1GB，100万读/月 | $0.50/GB/月 |

**总结：100 个用户以内，月费 = 0 元。**

---

## 9. 实施步骤

### 第1步：搭建 Cloudflare 基础设施

```
1. 注册 Cloudflare 账号（https://dash.cloudflare.com）
2. 创建 Cloudflare Pages 项目（连接 GitHub 仓库）
3. 创建 D1 数据库：
   wrangler d1 create exam-prep-db
4. 创建 R2 存储桶：
   wrangler r2 bucket create exam-questions
5. 配置 Pages 绑定 D1 + R2（在 Cloudflare Dashboard 或 wrangler.toml）
```

### 第2步：实现后端 API（Pages Functions）

```
1. 创建 functions/_middleware.js（认证中间件）
2. 创建 functions/api/auth/ 下的注册/登录/登出/me
3. 创建 functions/api/banks/ 下的 CRUD
4. 创建 functions/api/friends/ 下的好友操作
5. 创建 functions/api/users/ 下的用户搜索
6. 创建 functions/api/admin/ 下的管理接口
```

### 第3步：修改前端

```
1. 创建 js/api.js（封装所有 fetch 调用）
2. 创建 js/auth-ui.js（登录/注册弹窗）
3. 修改 js/app.js（集成用户状态、API 替换 localStorage）
4. 改造侧栏 UI（用户头像、好友入口）
5. 改造题库列表（区分公开/好友/自己的题库）
```

### 第4步：初始化数据

```
1. 上传默认题库到 R2
2. 创建超级管理员账号
3. 创建默认题库记录
4. 部署验证
```

### 第5步：验证

```
✅ 未登录用户可以看到默认题库并刷题
✅ 用户注册/登录正常
✅ 登录后可创建私人题库
✅ 创建题库可切换公开/私密
✅ 搜索用户、发送好友请求
✅ 接受好友后双方题库互相可见
✅ 超级管理员自动是所有人的好友
✅ 管理面板可管理用户
```

---

## 10. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|:----:|---------|
| D1 冷启动慢（200-500ms） | 首次 API 请求慢 | 用户感知不明显，可接受 |
| Workers 10ms CPU 限制 | 复杂查询可能超时 | 保持查询简单，大型题库 JSON 在浏览器端解析 |
| 密码安全 | 用户账号泄露 | 使用 PBKDF2 + 随机盐，不保存明文密码 |
| npoint.io 退役 | 已有缓存失效 | 部署前完成数据迁移到 R2 |
| 无忘记密码功能 | 用户无法找回账号 | 管理员可手动重置密码（v2 功能） |

---

## 11. 文件清单（改动总结）

| 操作 | 文件 |
|:----:|------|
| 🆕 | `wrangler.toml` |
| 🆕 | `_redirects` |
| 🆕 | `functions/_middleware.js` |
| 🆕 | `functions/api/auth/register.js` |
| 🆕 | `functions/api/auth/login.js` |
| 🆕 | `functions/api/auth/logout.js` |
| 🆕 | `functions/api/auth/me.js` |
| 🆕 | `functions/api/banks/index.js` |
| 🆕 | `functions/api/banks/[id].js` |
| 🆕 | `functions/api/banks/[id]/questions.js` |
| 🆕 | `functions/api/friends/index.js` |
| 🆕 | `functions/api/friends/request.js` |
| 🆕 | `functions/api/friends/accept.js` |
| 🆕 | `functions/api/friends/reject.js` |
| 🆕 | `functions/api/users/search.js` |
| 🆕 | `functions/api/admin/users.js` |
| 🆕 | `functions/api/admin/banks.js` |
| 🆕 | `js/api.js` |
| 🆕 | `js/auth-ui.js` |
| 🆕 | `js/friends-ui.js` |
| 🆕 | `js/admin-ui.js` |
| 🔧 | `js/app.js`（大改） |
| 🔧 | `index.html`（加登录/好友/管理入口） |
| 🔧 | `css/style.css`（加新组件样式） |
| 🔧 | `AGENTS.md`（更新技术栈说明） |
| 🔧 | `README.md`（更新部署信息） |
