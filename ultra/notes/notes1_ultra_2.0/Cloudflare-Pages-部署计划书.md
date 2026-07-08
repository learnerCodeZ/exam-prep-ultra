# Cloudflare Pages 免费部署计划书

> 日期：2026-07-07
> 目标：将 期末刷题宝典 Ultra 部署到 Cloudflare Pages，让任何人都能访问
> 状态：已归档 — 功能需求已升级，详见 [Cloudflare-全栈部署计划书](Cloudflare-全栈部署计划书.md)

---

## 1. 为什么选择 Cloudflare Pages（而非 GitHub Pages）

| 对比项 | GitHub Pages（当前） | Cloudflare Pages（目标） |
|--------|-------------------|------------------------|
| 价格 | 免费 | **免费** |
| 全球 CDN 节点 | 少数 | **330+ 节点** |
| 中国地区访问 | 慢/不稳定 | **相对较快** |
| 自定义域名 | 不支持（除非 CNAME） | **支持自定义域名 + 免费 SSL** |
| 带宽限制 | 100GB/月（软限制） | **无限带宽（免费计划）** |
| 构建次数 | 10次/小时 | 500次/月（免费计划足够） |
| 单次上传大小 | 1GB 仓库限制 | 25MB/文件（页面大小不限） |
| 自动 HTTPS | ✅ | ✅（自带，无需额外配置） |
| 部署方式 | push 到 GitHub 自动部署 | push 到 GitHub 自动部署 |
| 部署预览 | ❌ | **✅ 支持 PR 预览分支** |

**核心结论**：Cloudflare Pages 在速度、带宽、自定义域名方面全面优于 GitHub Pages，且同样免费。对于中国区刷题用户，Cloudflare 的亚洲节点访问体验明显更好。

---

## 2. 架构方案（推荐）

```
                   用户浏览器
                       │
                       ▼
         ┌─────────────────────────┐
         │    Cloudflare Pages     │  ← 免费 CDN 托管
         │    (全球 330+ 节点)      │
         │                         │
         │  index.html + CSS + JS  │
         │  ├─ mammoth.js (Word)   │
         │  ├─ pdf.js (PDF)        │
         │  └─ parser-md.js (MD)   │
         └─────────┬───────────────┘
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
   ┌──────────────┐  ┌────────────┐
   │ npoint.io    │  │ localStorage│
   │ (题库 JSON)  │  │ (答题记录)  │
   └──────────────┘  └────────────┘
```

**无需改动代码**：项目是纯静态 SPA，直接上传即可运行。所有交互在浏览器端完成。

---

## 3. 推荐方案一：Cloudflare Pages（纯静态托管）⭐ 首选

### 3.1 准备工作

| 项目 | 说明 | 费用 |
|------|------|------|
| Cloudflare 账号 | 在 [dash.cloudflare.com](https://dash.cloudflare.com) 注册 | 免费 |
| GitHub 仓库 | 已有 `https://github.com/learnerCodeZ/exam-prep-ultra` | ✅ 已有 |
| 域名（可选） | 可以绑定自己的域名，也可以用 Cloudflare 提供的 `.pages.dev` 域名 | 免费 |

### 3.2 部署步骤（5分钟完成）

#### 方式 A：通过 GitHub 自动部署（推荐）

```
1. 登录 Cloudflare Dashboard → Workers & Pages
2. 点击 "Create application" → "Pages" → "Connect to Git"
3. 授权 GitHub → 选择 exam-prep-ultra 仓库
4. 配置构建设置：
   ┌──────────────────────────────────┐
   │ 项目名称：exam-prep-ultra        │
   │ 生产分支：main                    │
   │ 框架预设：None                    │
   │ 构建命令：无（纯静态，无需构建）   │
   │ 构建输出目录：/ultra               │
   │ 根目录：/ultra                    │
   └──────────────────────────────────┘
5. 点击 "Save and Deploy"
6. 等待约 1 分钟 → 访问 https://exam-prep-ultra.pages.dev
```

#### 方式 B：直接上传文件（无需 Git）

```
1. 登录 Cloudflare Dashboard → Workers & Pages
2. 点击 "Create application" → "Pages" → "Upload assets"
3. 项目名称：exam-prep-ultra
4. 上传 ultra/ 目录下的所有文件
5. 点击 "Deploy"
6. 访问 https://exam-prep-ultra.pages.dev
```

### 3.3 配置自定义域名（可选）

```
1. 在 Cloudflare Pages 项目页面 → "Custom domains"
2. 输入你的域名（例如 exam.你的名字.com）
3. Cloudflare 会自动配置 SSL 证书（免费）
4. 等待 DNS 生效（1-10分钟）
```

### 3.4 绑定 npoint.io 题库

无需额外配置。项目中的 `NPOINT_URL` 保持现状即可，npoint.io 的请求是从用户浏览器发出的，与托管平台无关。

---

## 4. 方案二增强：Cloudflare Pages + Workers (题库代理) ⭐ 进阶推荐

### 4.1 为什么需要

项目的题库来自 npoint.io，这是一个免费服务，但有风险：
- npoint.io **可能不稳定或被墙**
- 所有用户共用同一个 npoint URL，无法做访问统计
- npoint 对请求频率有限制

通过 Cloudflare Workers 做一层代理，可以解决这些问题。

### 4.2 架构升级

```
用户浏览器 → Cloudflare Pages (SPA) → Cloudflare Workers (题库代理)
                                            │
                                            ▼
                                       npoint.io 或 Cloudflare R2
```

### 4.3 Workers 免费额度

| 资源 | 免费额度 |
|------|---------|
| 请求数 | 10万次/天（每天约上午重置） |
| CPU 时间 | 10ms/请求 |
| 内存 | 128MB |
| 子请求数 | 50个/请求 |
| 部署脚本 | 1个 Worker，5个预览 |

### 4.4 Workers 示例代码

创建一个 `functions/api/questions.js` 文件：

```javascript
// functions/api/questions.js
// 题库代理 API —— 缓存 npoint 题库，防止源站挂掉

const NPOINT_URL = 'https://api.npoint.io/你的ID'; // 填入实际的 npoint URL

export async function onRequest(context) {
  const cache = caches.default;
  const cacheKey = new Request(context.request.url);
  const cached = await cache.match(cacheKey);

  if (cached) return cached;

  try {
    const response = await fetch(NPOINT_URL);
    const data = await response.json();

    // 缓存到 Cloudflare CDN（5分钟）
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    };
    const result = new Response(JSON.stringify(data), { headers });

    // 写入缓存
    context.waitUntil(cache.put(cacheKey, result.clone()));

    return result;
  } catch (err) {
    // 如果 npoint.io 挂了，返回缓存的旧数据或内置 fallback
    if (cached) return cached;
    return new Response(JSON.stringify({ error: '题库加载失败，请稍后重试' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

---

## 5. 方案三增强：Cloudflare R2 替代 npoint.io（可选）

### 5.1 为什么考虑

npoint.io 虽然免费，但：
- 更新题库需要手动去 npoint 网站操作
- 没有版本管理
- 不保证 SLA

Cloudflare R2 提供免费的 **10GB 存储 + 每月 1000 万次读取请求**，可以直接存 JSON 题库文件。

### 5.2 R2 配置

```bash
# 1. 安装 Wrangler CLI
npm install -g wrangler

# 2. 登录
wrangler login

# 3. 创建 R2 存储桶
wrangler r2 bucket create exam-questions

# 4. 上传题库文件
wrangler r2 object put exam-questions/default.json --file data/default.json

# 5. 通过 Workers 绑定 R2（这样前端可以通过 API 访问）
#    在 wrangler.toml 配置：
#    r2_buckets = [{ binding = "QUESTIONS", bucket_name = "exam-questions" }]
```

---

## 6. 部署对比方案

| 方案 | 复杂度 | 免费额度 | 优势 | 推荐度 |
|:----:|:------:|:---------:|:----:|:------:|
| **① 仅 Cloudflare Pages** | ⭐ 极简 | 无限带宽/500次构建 | 5分钟上线，零配置 | ⭐⭐⭐ |
| **② Pages + Workers 代理** | ⭐⭐ 简单 | Workers 10万次/天 | npoint 容错+缓存加速 | ⭐⭐⭐ |
| **③ Pages + R2 + Workers** | ⭐⭐⭐ 中等 | R2 10GB + Workers 10万次/天 | 完全脱离 npoint，可控性最高 | ⭐⭐ |

**推荐**: 先做 **方案①** 快速上线，后续根据需要升级到 **方案②**。

---

## 7. 实施步骤（建议）

### 第1步：注册 Cloudflare

```
1. 打开 https://dash.cloudflare.com/sign-up
2. 输入邮箱 + 密码注册
3. 验证邮箱
```

### 第2步：部署 Pages

```
1. 登录 Cloudflare Dashboard
2. 左侧 → "Workers & Pages"
3. "Create application" → "Pages"
4. 选择 "Upload assets"（最简单）
5. 上传 ultra/ 目录所有文件
6. 项目名称填 "exam-prep-ultra"
7. 等待部署完成
```

### 第3步：验证上线

```
1. 访问 https://exam-prep-ultra.pages.dev
2. 确认所有功能正常：
   □ 首页加载正常
   □ 题库显示正常
   □ 刷题功能正常
   □ 导入功能正常
   □ 移动端适配正常
```

### 第4步（可选）：绑定自定义域名

```
1. 在 Pages 项目 → "Custom domains"
2. 输入你自己的域名（如 exam-prep.yourname.com）
3. 按提示添加 DNS 记录
4. 等待 SSL 证书自动签发
```

### 第5步（可选）：配置 Workers 题库代理

```
1. 在项目目录创建 functions/api/questions.js
2. 填入 Cloudflare Workers 代理代码
3. 重新部署
```

---

## 8. 风险与注意事项

| 风险 | 说明 | 缓解措施 |
|------|------|----------|
| npoint.io 被墙 | 部分用户可能无法从 npoint 获取题库 | 使用 Workers 代理 + 默认题库 fallback |
| 部署目录错误 | ultra/ 子目录部署时路径可能不对 | 确认 Pages 的 "Root directory" 设为 `/ultra` |
| 路由问题 | 刷新非首页路径可能 404 | 添加 Cloudflare Pages SPA 重定向规则（见下方） |
| 免费计划限制 | 500次构建/月 | 开发时用本地预览，上线后正常 push 不会用完 |

### SPA 路由重定向（解决刷新 404）

纯前端 SPA 在 Cloudflare Pages 上需要加一条规则来处理刷新：

**方法：** 在 ultra/ 目录下创建 `_redirects` 文件：

```
/*    /index.html   200
```

这样所有路径的请求都会返回 `index.html`，由前端 JS 处理路由。

---

## 9. 费用总结

| 服务 | 免费额度 | 超出费用 |
|------|---------|---------|
| Cloudflare Pages | 无限带宽，500次构建/月 | 不超出（流量无限） |
| Cloudflare Workers | 10万请求/天 | $0.30/百万请求 |
| Cloudflare R2 | 10GB存储，1000万读/月 | $0.36/GB/月 |
| 自定义域名 | SSL 免费 | 域名本身需年费 |

**对于刷题网站场景，免费额度完全足够，零成本运营。**

---

## 10. 附录：部署路径注意事项

当前项目的文件结构是：

```
exam-prep-ultra/
├── ultra/           ← 需要部署的目录
│   ├── index.html
│   ├── css/
│   ├── js/
│   ├── lib/
│   ├── data/
│   └── ...
├── v1.0/
└── README.md
```

**Cloudflare Pages 部署时，Root directory 要设置为 `/ultra`**，否则会导致路径错误。

---

**下一步建议**：按第7章的第1-3步操作，5分钟内即可让刷题宝典跑在 Cloudflare 上。需要我协助执行部署吗？
