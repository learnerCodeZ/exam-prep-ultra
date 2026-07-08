-- 期末刷题宝典 Ultra — 种子数据初始化脚本
-- 用法：wrangler d1 execute exam-prep-db --remote --file=seed.sql
--
-- 本脚本做三件事：
--   1. 创建超级管理员账号（admin@example.com / admin123）
--   2. 创建默认题库元数据记录（指向 KV 中的 default.json）
--   3. 注意：题目 JSON 本身需要单独上传到 KV

-- ========== 1. 超级管理员 ==========
-- 密码哈希格式：salt:hash（与 register.js 的 PBKDF2-SHA256 一致）
-- 下面这个哈希对应密码 "admin123"（仅用于首次初始化，登录后请立即改密码！）
-- 生成方式见 scripts/gen-admin-hash.js
INSERT OR IGNORE INTO users (email, password, nickname, role)
VALUES ('admin@example.com', '8cECt69wvlVRL3Y+4hvxLQ==:pHc1HUC6qQHyxMFOdRFiYLNg8f4eQp5MSbPOYXu95KU=', '管理员', 'admin');

-- ========== 2. 默认题库 ==========
-- kv_key 指向 KV 中上传的 default.json，owner_id=1（管理员）
INSERT OR IGNORE INTO banks (id, owner_id, name, is_default, is_public, kv_key)
VALUES (1, 1, '大学英语4（默认）', 1, 1, 'banks/default.json');