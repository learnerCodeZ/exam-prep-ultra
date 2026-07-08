# M4 完成总结 — 答案编辑 + UI 打磨

> 阶段目标：让用户能修改题目答案（保存在本地），并优化整体交互体验。

## 交付内容

| 文件 | 改动 |
|------|------|
| `src/js/app.js` | 答案编辑弹窗逻辑、getAnswer 统一答案获取、键盘快捷键 |
| `src/index.html` | 新增答案编辑弹窗 |
| `src/css/style.css` | 编辑按钮样式、移动端触摸优化 |

## 技术栈

- **localStorage 覆盖层**：编辑的答案独立存储，不修改原题库
- **事件委托**：document 监听 keydown 实现快捷键
- **响应式 CSS**：媒体查询适配移动端
- **状态管理**：统一的 getAnswer 抽象

## 核心知识点

### 1. 覆盖层模式：编辑答案不改原数据

核心设计：编辑的答案存在 `ultra_answers_<bankId>`，**覆盖**原题库答案，原数据不动。

```javascript
const LS = {
  answers: (id) => 'ultra_answers_' + id,
};

// 统一的取答案函数：优先编辑过的，否则用原答案
function getAnswer(q) {
  if (q.type === 'fillblank') {
    return state.editedAnswers[q.id] || q.blanks;
  }
  return state.editedAnswers[q.id] || q.answer;
}

function isAnswerEdited(q) {
  return state.editedAnswers[q.id] != null;
}
```

**学习点**：
- **覆盖层（overlay）模式**：不改源数据，用一层"补丁"覆盖。原数据（npoint 题库）保持只读，编辑只存本地
- 这是 Git rebase、CSS 覆盖、函数装饰器的共同思路——**叠加而非修改**
- 用 `||` 短路实现"有编辑用编辑，否则用默认"，简洁优雅

### 2. 答案编辑弹窗：两种题型两种 UI

选择题用字母圆圈选择，选词填空用输入框逐空编辑：

```javascript
function openEditAnswer() {
  const q = state.list[state.idx];
  if (q.type === 'fillblank') {
    // 选词填空：每个空格一个输入框
    const blanks = getFillBlanks(q);
    let html = '';
    for (const num of Object.keys(blanks).sort((a,b) => a-b)) {
      html += `<input id="editBlank_${num}" value="${blanks[num]}" maxlength="1">`;
    }
    body.innerHTML = html;
  } else {
    // 选择题：字母圆圈
    const currentAnswer = getAnswer(q);
    for (const l of q.options.map(o => o.letter)) {
      html += `<div class="edit-answer-opt ${l===currentAnswer?'active':''}"
               onclick="selectEditAnswer('${l}')">${l}</div>`;
    }
  }
}
```

**学习点**：
- 同一弹窗根据题型渲染不同 UI——**多态**在前端的表现
- `maxlength="1"` + `text-transform:uppercase` 限制输入格式
- 保存后 `state.selected=null; state.answered=false; render()` 强制重新渲染当前题

### 3. 恢复默认：删除覆盖

```javascript
function resetEditAnswer() {
  delete state.editedAnswers[q.id];  // 删掉覆盖层，露出原答案
  saveState();
  render();
}
```

**学习点**：覆盖层模式的另一个好处——"恢复默认"就是 `delete`，不需要存原值副本。

### 4. 键盘快捷键：事件委托 + 状态判断

```javascript
document.addEventListener('keydown', (e) => {
  // 1. 弹窗打开时不响应
  const overlays = ['qmapOverlay', 'importOverlay', 'editAnswerOverlay'];
  if (overlays.some(id => document.getElementById(id).classList.contains('show'))) return;
  // 2. 输入框聚焦时不响应
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  // 3. 快捷键
  if (['1','2','3','4'].includes(e.key)) { /* 选择选项 */ }
  if (e.key === 'ArrowLeft') prevQ();
  if (e.key === 'ArrowRight') nextQ();
  if (e.key === 'f') toggleFav();
});
```

**学习点**：
- **全局监听 + 条件判断**：在 document 上监听一次，比每个按钮单独绑事件高效
- **守卫条件**：先排除"不该响应"的情况（弹窗、输入框），避免误触
- `e.preventDefault()` 阻止默认行为（如箭头滚动页面）
- 快捷键设计：数字键选答案（1-4）、方向键翻页、F 收藏——符合直觉

### 5. 移动端触摸优化

```css
@media (max-width: 480px) {
  .actions button { padding: 10px 6px; min-height: 44px; }
  .nav-bar button { padding: 10px 14px; min-height: 44px; }
}
```

**学习点**：
- **44px 是触摸目标的最小尺寸**（Apple HIG 推荐），低于这个尺寸手指难以准确点击
- 媒体查询 `@media (max-width: 480px)` 针对手机优化
- 移动端字体要稍大（14px+）便于阅读

### 6. ✎ 铅笔标记：已编辑答案的视觉反馈

```javascript
const edited = isAnswerEdited(q);
// q-tag 标题旁显示铅笔
`<span class="q-tag">${typeName}${edited?' ✎':''}</span>`
// 答案框里也标注
if (edited) detail += ' <span style="color:#fa8c16">✎已编辑</span>';
```

**学习点**：用户修改过的内容要有视觉标识，让用户知道"这不是原始答案"——避免混淆。

## 实现的功能

1. **答案编辑**：每题"编辑答案"按钮，弹窗修改答案
2. **选择题编辑**：字母圆圈选择正确答案
3. **选词填空编辑**：逐空修改字母
4. **恢复默认**：一键清除编辑，恢复原答案
5. **编辑标记**：已编辑题目显示 ✎ 铅笔图标
6. **键盘快捷键**：数字键选答案、方向键翻页、F 收藏、字母键选词
7. **移动端优化**：按钮 44px 触摸友好

## 关键决策

- **覆盖层存储**：编辑答案独立存 localStorage，原题库只读
- **统一 getAnswer**：所有取答案的地方都用 `getAnswer(q)`，自动处理编辑覆盖
- **快捷键守卫**：弹窗/输入框聚焦时禁用快捷键，避免冲突

## 踩坑记录

### 坑 1：选词填空的 isAnswerEdited 判断

最初用 `state.editedAnswers[q.id] !== q.answer` 判断是否编辑过，但选词填空没有 `q.answer`（用 `q.blanks`），导致永远不相等。改成 `!= null` 判断"是否存在编辑记录"。

### 坑 2：showResult 用旧的 q.answer

最初 showResult 直接用 `q.answer`，编辑答案后判定还是用旧答案。全部替换为 `getAnswer(q)` 后才正确。

## 调试方法论

1. **逻辑验证用 Node 模拟**：答案编辑的核心逻辑用 Node 模拟 state，验证 getAnswer/isAnswerEdited 正确
2. **语法验证**：每次大改后用 `new Function(code)` 检查语法
3. **HTTP 加载验证**：curl 确认所有文件可访问

## 项目流程回顾

```
M3（Word/PDF 导入）
  ↓ 加答案覆盖层
M4 答案编辑 + UI 打磨
  ├─ 覆盖层存储：editedAnswers 覆盖原答案
  ├─ 统一取答案：getAnswer(q)
  ├─ 编辑弹窗：选择题/填空题两种 UI
  ├─ 键盘快捷键：提升效率
  └─ 移动端优化：44px 触摸目标
```

**最大收获**：掌握了"覆盖层"这个重要的设计模式——不改源数据，用补丁层覆盖。它让"编辑"和"恢复默认"都变得简单，也保证了原数据的不可变性。同时学会了用键盘快捷键和响应式设计提升体验。
