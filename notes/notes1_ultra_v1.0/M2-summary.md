# M2 完成总结 — Markdown 导入 + 题库切换

> 阶段目标：让用户能导入自己的 Markdown 题库，并在多个题库间切换。

## 交付内容

| 文件 | 作用 | 行数 |
|------|------|------|
| `src/js/parser-md.js` | Markdown 题库解析器 | ~210 |
| `src/index.html` | 更新导入弹窗 UI（文件选择、命名、预览、确认） | ~85 |
| `src/js/app.js` | 导入流程、题库删除、删除按钮 | +60 |
| `src/css/style.css` | 删除按钮样式 | +5 |
| `data/sample-bank.md` | 示例 Markdown 题库（4 题型 7 题） | - |

## 技术栈

- **FileReader API**：浏览器端读取用户上传的文件，不经过服务器
- **正则表达式**：解析 Markdown 结构（标题、题号、选项、空格标记）
- **URL.createObjectURL / Blob**（隐含）：文件读取的现代方式
- **localStorage**：导入的题库持久化存储

## 核心知识点

### 1. FileReader 浏览器端读文件

整个导入流程**不经过任何服务器**——文件直接在浏览器里读取解析：

```javascript
function onFileSelect(e) {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target.result;              // 拿到文件文本
    pendingBank = parseMarkdownBank(text, name); // 解析
    showImportPreview(pendingBank);              // 预览
  };
  reader.readAsText(file, 'utf-8');              // 指定编码
}
```

**学习点**：
- `<input type="file">` + `FileReader` 是纯前端文件处理的标准模式
- `readAsText(file, 'utf-8')` 必须指定编码，否则中文可能乱码
- 这正是"零服务器"架构的核心：所有处理在客户端完成

### 2. Markdown 结构解析：用 split + 正则

Markdown 没有现成的解析器能理解"题库"语义，所以自己写。核心思路：**用一级标题 `#` 切分题型区块**。

```javascript
const sections = text.split(/^# (.+)$/m);
// sections[0] = 第一个 # 之前的文本（通常为空）
// sections[1] = "听力", sections[2] = 听力内容
// sections[3] = "段落匹配", sections[4] = 段落匹配内容
```

**关键正则** `/^# (.+)$/m`：
- `^#` 行首的 `#`
- `(.+)` 捕获标题文字
- `$` 行尾
- `m` 多行模式（`^$` 匹配每行而非整个字符串）

`split` 带捕获组的特性：捕获组会保留在结果数组里，所以能交替得到 [标题, 内容, 标题, 内容]。

**踩过的坑**：最初用 `.filter(Boolean)` 去掉空段，结果索引错乱。正确做法是保留结构，从索引 1 开始步长 2 遍历。

### 3. 答案识别：中文翻译 = 正确答案

PRD 规定：选项文本后紧跟中文翻译，表示该选项是正确答案。

```javascript
function extractZhAnswer(raw) {
  const match = raw.match(/^(.+?)\s+([一-鿿].*)$/);
  // [一-鿿] 匹配任意中文字符（Unicode 范围）
  if (match) return { answer: match[2], display: match[1] };
  return { answer: '', display: raw };
}
```

**学习点**：
- `[一-鿿]` 是匹配中文的常用 Unicode 范围（U+4E00 ~ U+9FA5）
- `(.+?)` 非贪婪匹配，避免把多个空格后的内容都吞掉

### 4. 题号分割的迭代式解析

题号格式不统一（`1.` `1、` `41)` `41.`），且分割后数组结构是 [空, 题号, 内容, 题号, 内容]。用迭代式而非固定步长：

```javascript
const blocks = content.split(/(?:^|\n)(\d+)[\.、．]\s*\n/);
let num = null;
for (const block of blocks) {
  const trimmed = block.trim();
  if (!trimmed) continue;                    // 跳过空块
  if (/^\d+$/.test(trimmed)) {               // 纯数字 = 题号
    num = parseInt(trimmed);
    continue;
  }
  if (num === null) continue;                // 还没遇到题号
  // block 是题目内容
  parseOptions(block);
  num = null;
}
```

**学习点**：`split` 配合捕获组会产生混合数组，迭代式解析比固定步长更鲁棒——能跳过空块、处理边界。

### 5. 选词填空的多行词库识别

词库可能跨多行，要先定位"词库起始行"，再合并后续所有词库行：

```javascript
// 找第一行：包含 ≥3 个 "X) word" 模式
for (let i = 0; i < lines.length; i++) {
  const matches = lines[i].trim().match(/\b[A-O][\)\.]\s*\S+/g) || [];
  if (matches.length >= 3) { bankLineIdx = i; break; }
}
// 从该行开始合并所有行作为词库
const bankLine = lines.slice(bankLineIdx).join(' ');
```

**踩过的坑**：
- 最初用 `^[A-O]` 锚定行首，但一行有多个选项，只匹配第一个 → 改用 `\b` 单词边界
- 最初只取 `lines[bankLineIdx]` 一行，漏掉 F-O → 改用 `slice(bankLineIdx).join(' ')`

### 6. 下划线宽容匹配

空格标记 `__B) word__` 的下划线数量不固定（1-3 个），且字母前可能有空格：

```javascript
const blankPat = /_+\s*([A-O])[\)\.\s]*(\S+?)_+\s*(\d+)[\)\.]/g;
```

- `_+` 一个或多个下划线
- `\s*` 允许下划线和字母间有空格（`___ O) honesty___` 这种）
- `(\S+?)` 非贪婪匹配单词

**学习点**：处理人工书写的格式，正则要"宽容"——用 `+` `*` 而非精确次数，用 `\s*` 允许任意空白。

## 实现的功能

1. **Markdown 导入**：选文件 → 解析 → 预览（题库名/题目数/题型分布/示例题）→ 确认导入
2. **题库切换**：下拉菜单切换默认/导入题库
3. **题库删除**：导入题库旁的删除按钮（默认题库不可删）
4. **四种题型解析**：听力、段落匹配、选词填空、阅读

## 关键决策

- **答案识别**：选项含中文翻译即为正确答案（PRD 规则）
- **多行词库**：检测到词库行后合并到末尾
- **下划线宽容**：`_+\s*` 应对 1-3 个下划线 + 任意空格
- **无 ## 标题兜底**：阅读/选词填空无子标题时整段当一个单元

## 测试结果

- `sample-bank.md` 解析：7 题（听力 2 + 段落匹配 2 + 选词填空 1(4空) + 阅读 2），全部答案正确
- JSON 序列化/反序列化正常，可存入 localStorage

## 项目流程回顾

```
M1（单题库 + 核心刷题）
  ↓ 题库包装格式 {id, name, questions}
M2 加入题库管理
  ├─ 导入：FileReader → 解析 → localStorage
  ├─ 切换：下拉菜单 + 题库 id 寻址
  └─ 删除：按 id 清理 localStorage
```

**最大收获**：掌握了纯前端文件处理的完整链路（FileReader + 解析 + 持久化），以及用正则处理"格式不统一的真实数据"的实战技巧——宽容匹配、迭代解析、分层降级。

## 调试方法论

这个阶段调试正则花了大量时间，总结有效的方法：

1. **单元测试式调试**：用 `node -e` 直接跑正则，看匹配结果，不依赖浏览器
2. **逐步缩小**：先测整个解析，再测单个题型，再测单个正则
3. **打印中间结果**：`console.log` 分割后的数组结构，理解 `split` 的真实输出
4. **从数据出发**：先看真实 passage 长什么样（`indexOf` 找上下文），再写正则
