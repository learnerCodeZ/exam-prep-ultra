# 期末刷题宝典 Ultra — 部署指南

## 前提条件

- Node.js 18+
- Cloudflare 账号
- `wrangler` CLI 已登录（`npx wrangler login`）

---

## 第一步：创建 Cloudflare 资源

### 1.1 创建 D1 数据库

```bash
cd ultra
npx wrangler d1 create exam-prep-db
```

输出会包含 `database_id`，复制它。

### 1.2 创建 R2 Bucket

```bash
npx wrangler r2 bucket create exam-questions
```

### 1.3 创建 KV Namespace

```bash
npx wrangler kv namespace create SESSION
```

输出会包含 KV namespace `id`，复制它。

### 1.4 更新 wrangler.toml

将 `CHANGE_ME` 替换为实际值：

```toml
[[d1_databases]]
binding = "DB"
database_name = "exam-prep-db"
database_id = "<第1.1步获得的ID>"

[[kv_namespaces]]
binding = "SESSION"
id = "<第1.3步获得的ID>"
```

---

## 第二步：初始化数据库

### 2.1 建表

```bash
npx wrangler d1 execute exam-prep-db --remote --file=schema.sql
```

### 2.2 生成管理员密码哈希

```bash
node scripts/gen-admin-hash.js admin123
```

复制输出的哈希值，替换 `seed.sql` 中的 `__ADMIN_HASH_PLACEHOLDER__`。

### 2.3 插入种子数据

```bash
npx wrangler d1 execute exam-prep-db --remote --file=seed.sql
```

---

## 第三步：上传默认题库到 R2

```bash
npx wrangler r2 object put exam-questions/banks/default.json --file=data/default.json --content-type=application/json
```

---

## 第四步：本地测试

```bash
npx wrangler pages dev .
```

验证清单：
- [ ] 打开 http://localhost:8788 → 页面正常加载
- [ ] 默认题库（大学英语4）题目正常显示
- [ ] 注册新账号 → 成功
- [ ] 登录 admin@example.com / admin123 → 成功
- [ ] header 显示昵称 + 👥 + ⚙ 按钮
- [ ] 点 👥 → 好友弹窗，搜索用户正常
- [ ] 点 ⚙ → 管理面板，用户/题库列表正常
- [ ] 退出 → 回到"登录"按钮
- [ ] 未登录时刷题正常

---

## 第五步：部署到生产环境

```bash
npx wrangler pages deploy . --project-name=exam-prep-ultra
```

首次部署会自动创建 Pages 项目。部署成功后 Cloudflare 会给出访问 URL。

---

## 第六步：生产环境验证

1. 访问 Cloudflare 给出的 URL
2. 注册一个普通用户账号
3. 用管理员账号登录，在管理面板确认普通用户存在
4. 搜索好友，发送/接受请求
5. 确认好友可见对方的私有题库
6. 确认离线（断网）仍可刷本地题库

---

## 常见问题

### Q: `wrangler pages dev` 报 D1 绑定错误？
A: 本地开发时需要加 `--d1=DB` 参数，或确保 `wrangler.toml` 在当前目录。

### Q: R2 上传大文件超时？
A: `default.json` 约 700KB，在正常范围内。如果题库更大，考虑分片或用 Workers 上传。

### Q: KV namespace 找不到？
A: 确认 `wrangler.toml` 中的 KV id 是 `--remote` 模式的 id（不是 preview id）。

### Q: Cookie 在本地开发不生效？
A: `wrangler pages dev` 默认用 HTTP，而 Cookie 设了 `Secure`。本地测试时可临时去掉 Secure 或用 `--https` 参数。

### Q: 怎么改管理员密码？
A: 登录后通过前端修改（如果未来加了改密码功能），或重新运行 `gen-admin-hash.js` 生成新哈希，用 `wrangler d1 execute` 更新数据库。

---

## 回滚

如果部署出问题，Cloudflare Pages 支持 alias 回滚：

```bash
npx wrangler pages deployment list --project-name=exam-prep-ultra
npx wrangler pages deployment rollback --project-name=exam-prep-ultra
```

数据库回滚需要手动操作（建议部署前 `wrangler d1 export` 备份）。

```bash
npx wrangler d1 export exam-prep-db --remote --output=backup.sql
```
