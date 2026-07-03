// 期末刷题宝典 Ultra — 主逻辑

// npoint 题库地址（M5 部署时填入真实 URL；为空则直接用 default.json）
const NPOINT_URL = '';

// localStorage keys
const LS = {
  banks: 'ultra_banks',          // 用户导入的题库列表
  activeBank: 'ultra_activeBank', // 当前题库 id
  cacheBank: (id) => 'ultra_bankCache_' + id, // npoint 题库缓存
  wrong: (id) => 'ultra_wrong_' + id,
  right: (id) => 'ultra_right_' + id,
  fav: (id) => 'ultra_fav_' + id,
  answers: (id) => 'ultra_answers_' + id,
};

let state = {
  mode: 'practice',
  typeName: '',    // 当前选中的题型名称
  idx: 0,
  selected: null,
  answered: false,
  list: [],
  bank: null,        // {id, name, questions}
  questions: [],
  wrong: {},
  right: {},
  fav: {},
  editedAnswers: {},
};

// ---------- 题库加载 ----------
async function loadBank(bankId) {
  let bank = null;
  if (bankId === 'default') {
    bank = await loadDefaultBank();
  } else {
    // 用户导入的题库，存于 localStorage
    const banks = getUserBanks();
    bank = banks.find(b => b.id === bankId);
    if (!bank) {
      // 可能是 npoint 缓存的题库
      const cached = localStorage.getItem(LS.cacheBank(bankId));
      if (cached) bank = JSON.parse(cached);
    }
  }
  if (!bank) {
    alert('题库加载失败：' + bankId);
    return;
  }
  state.bank = bank;
  state.questions = bank.questions;
  state.wrong = JSON.parse(localStorage.getItem(LS.wrong(bank.id)) || '{}');
  state.right = JSON.parse(localStorage.getItem(LS.right(bank.id)) || '{}');
  state.fav = JSON.parse(localStorage.getItem(LS.fav(bank.id)) || '{}');
  state.editedAnswers = JSON.parse(localStorage.getItem(LS.answers(bank.id)) || '{}');

  // 选择该题库第一个可用题型
  const firstTypeName = getTypeNames()[0] || '';
  state.typeName = firstTypeName;
  state.mode = 'practice';
  buildList();
  renderTabs();
  renderBankSelect();
  updateHeader();
  updateStats();
}

async function loadDefaultBank() {
  // 1. 尝试 npoint（线上题库）
  if (NPOINT_URL) {
    try {
      const cached = localStorage.getItem(LS.cacheBank('default'));
      const res = await fetch(NPOINT_URL);
      if (res.ok) {
        const bank = await res.json();
        if (bank && bank.questions && bank.questions.length) {
          localStorage.setItem(LS.cacheBank('default'), JSON.stringify(bank));
          return bank;
        }
      }
      throw new Error('npoint fetch failed');
    } catch (e) {
      // 降级到缓存或内置
      if (cached) return JSON.parse(cached);
    }
  }
  // 2. 内置 default.json fallback
  const res = await fetch('data/default.json');
  if (res.ok) return await res.json();
  console.error('No default bank available');
  return { id: 'default', name: '大学英语4（默认）', questions: [] };
}

function getUserBanks() {
  return JSON.parse(localStorage.getItem(LS.banks) || '[]');
}

function saveUserBank(bank) {
  const banks = getUserBanks();
  const idx = banks.findIndex(b => b.id === bank.id);
  if (idx >= 0) banks[idx] = bank;
  else banks.push(bank);
  localStorage.setItem(LS.banks, JSON.stringify(banks));
}

function deleteBank(bankId) {
  const banks = getUserBanks().filter(b => b.id !== bankId);
  localStorage.setItem(LS.banks, JSON.stringify(banks));
  localStorage.removeItem(LS.cacheBank(bankId));
  localStorage.removeItem(LS.wrong(bankId));
  localStorage.removeItem(LS.right(bankId));
  localStorage.removeItem(LS.fav(bankId));
}

function renderBankSelect() {
  const container = document.getElementById('sidebarBanks');
  const banks = getUserBanks();
  const activeId = state.bank ? state.bank.id : 'default';
  let html = renderBankItem('default', '大学英语4（默认）', state.questions.length, activeId === 'default', false);
  for (const b of banks) {
    html += renderBankItem(b.id, b.name, b.questions ? b.questions.length : 0, activeId === b.id, true);
  }
  container.innerHTML = html;
  // 侧栏底部统计
  const stats = document.getElementById('sidebarStats');
  if (stats) {
    const right = Object.keys(state.right).length;
    const wrong = Object.keys(state.wrong).length;
    stats.textContent = `答对 ${right} 道 · 错题 ${wrong} 道 · 共 ${state.questions.length} 题`;
  }
}

function renderBankItem(id, name, count, isActive, deletable) {
  const iconChar = isActive ? '📖' : (id === 'default' ? '📚' : '📘');
  const canRename = id !== 'default';
  return `<div class="sidebar-bank-item ${isActive?'active':''}" onclick="switchBank('${id}')">
    <div class="bank-icon">${iconChar}</div>
    <div class="bank-info">
      <div class="bank-name">${escapeHtml(name)}</div>
      <div class="bank-count">${count} 题</div>
    </div>
    ${canRename ? `<button class="bank-rename" onclick="event.stopPropagation();startRename('${id}','${escapeHtml(name)}')" title="重命名">✎</button>` : ''}
    <button class="bank-append" onclick="event.stopPropagation();openAppend('${id}')" title="追加题目">+</button>
    ${deletable ? `<button class="bank-del" onclick="event.stopPropagation();deleteBankUI('${id}')">✕</button>` : ''}
  </div>`;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}

// ESC 关闭侧栏
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) toggleSidebar();
  }
});

async function switchBank(bankId) {
  localStorage.setItem(LS.activeBank, bankId);
  toggleSidebar(); // 关闭侧栏
  await loadBank(bankId);
}

// ---------- 渲染 ----------
function getTypeNames() {
  const seen = [];
  for (const q of state.questions) {
    const tn = q.typeName || '未分类';
    if (!seen.includes(tn)) seen.push(tn);
  }
  return seen;
}

function updateHeader() {
  const total = state.questions.length;
  const bankName = state.bank ? state.bank.name : '大学英语4（默认）';
  document.getElementById('hdrSub').textContent = `${bankName} · 共 ${total} 题`;
}

function renderTabs() {
  const tabs = document.getElementById('tabs');
  let html = '';
  for (const tn of getTypeNames()) {
    const items = state.questions.filter(q => (q.typeName || '未分类') === tn);
    if (items.length === 0) continue;
    html += `<div class="tab ${tn === state.typeName ? 'active' : ''}" data-type="${escapeHtml(tn)}" onclick="switchType('${escapeHtml(tn)}')">
      ${escapeHtml(tn)}<span class="count">${items.length}题</span></div>`;
  }
  tabs.innerHTML = html;
}

function buildList() {
  let arr = state.questions.filter(q => (q.typeName || '未分类') === state.typeName);
  if (state.mode === 'wrong') {
    arr = arr.filter(q => state.wrong[q.id]);
  } else if (state.mode === 'fav') {
    arr = arr.filter(q => state.fav[q.id]);
  } else if (state.mode === 'random') {
    arr = [...arr].sort(() => Math.random() - 0.5);
  }
  state.list = arr;
  state.idx = 0;
  state.selected = null;
  state.answered = false;
  render();
}

function setMode(m) {
  state.mode = m;
  document.querySelectorAll('.mode-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.mode === m);
  });
  buildList();
}

function switchType(tn) {
  state.typeName = tn;
  renderTabs();
  buildList();
}

function updateStats() {
  document.getElementById('stTotal').textContent = state.questions.length;
  document.getElementById('stRight').textContent = Object.keys(state.right).length;
  document.getElementById('stWrong').textContent = Object.keys(state.wrong).length;
  document.getElementById('stFav').textContent = Object.keys(state.fav).length;
}

function render() {
  const content = document.getElementById('content');
  if (state.list.length === 0) {
    content.innerHTML = `<div class="empty">${
      state.mode === 'wrong' ? '错题本为空，快去刷题吧！' :
      state.mode === 'fav' ? '收藏夹为空' : '暂无题目'
    }</div>`;
    updateStats();
    return;
  }
  const q = state.list[state.idx];
  if (q.wordBank) renderFillBlank(q, content);
  else renderChoice(q, content);
  updateStats();
}

// ---------- 选择题（通用/匹配/听力）----------
function renderChoice(q, content) {
  let passageHtml = '';
  if (q.passages) {
    const fullText = Object.entries(q.passages).map(([k,v]) => `<b>${k}.</b> ${escapeHtml(v)}`).join('<br><br>');
    passageHtml = `
      <div class="passage-toggle" onclick="togglePassage(this)">展开/收起原文 ▾</div>
      <div class="passage-box collapsed" id="passageBox">${fullText}</div>`;
  }

  let stemHtml = escapeHtml(q.stem || '');
  if (/^第\d+题$/.test(q.stem)) {
    stemHtml = `<b>${q.stem}</b>`;
  }

  let optionsHtml = '';
  if (q.passages) {
    const letters = q.options.map(o => o.letter);
    optionsHtml = `<div class="match-options" id="matchOpts">` +
      letters.map(l => `<div class="match-opt" data-l="${l}" onclick="selectMatch('${l}')">${l}</div>`).join('') +
      `</div>`;
  } else {
    optionsHtml = `<div class="options">` +
      q.options.map(o => `
        <div class="option" data-l="${o.letter}" onclick="selectOpt('${o.letter}')">
          <div class="letter">${o.letter}</div>
          <div class="opt-text">${escapeHtml(o.text)}</div>
        </div>`).join('') + `</div>`;
  }

  const isFav = state.fav[q.id];
  const edited = isAnswerEdited(q);
  content.innerHTML = `
    <div class="card">
      <span class="q-tag">${escapeHtml(q.typeName)}${q.number ? ' · 第'+q.number+'题' : ''}${q.passage?' · '+escapeHtml(String(q.passage)):''}${edited?' ✎':''}</span>
      ${passageHtml}
      <div class="q-stem">${stemHtml}</div>
      ${optionsHtml}
      <div class="answer-box" id="answerBox"></div>
      <div class="actions">
        <button class="btn-next" onclick="nextQ()">下一题</button>
        <button class="btn-fav" onclick="toggleFav()">${isFav?'★ 收藏中':'☆ 收藏'}</button>
        <button class="btn-edit" onclick="openEditAnswer()">✎ 编辑答案</button>
      </div>
      <div class="nav-bar">
        <button onclick="prevQ()" ${state.idx===0?'disabled':''}>上一题</button>
        <span class="nav-pos" onclick="openQmap()">${state.idx+1} / ${state.list.length}</span>
        <button onclick="nextQ()" ${state.idx===state.list.length-1?'disabled':''}>下一题</button>
      </div>
    </div>`;

  if (state.answered && state.selected !== null) {
    showResult(q);
  }
}

// ---------- 选词填空 ----------
let fillState = { blanks: {}, current: {}, used: {} };

function renderFillBlank(q, content) {
  const blanks = q.blanks || {};

  // Clean passage: replace answer markers with 【NUM】 placeholders
  let cleanPassage = q.passage;
  // Format A: NUM + [_\s]* + LETTER + [).] + word  (e.g. '26C) chance', '26D.complex')
  cleanPassage = cleanPassage.replace(/(\d{2})[\s_]*([A-O])[).\s]+([A-Za-z\-]+)[\s_]*/g, '【$1】 ');
  // Format B: _+ LETTER ) word _* NUM ) (e.g. '__B) slump_ 31)', '_L) Fortunately40)')
  cleanPassage = cleanPassage.replace(/_+\s*([A-O])\s*[)\.]\s*([A-Za-z\-]+)\s*_*\s*(\d{2})\)/g, '【$3】 ');
  // Format C: LETTER ) word NUM ) (e.g. 'A) financially 39)')
  cleanPassage = cleanPassage.replace(/([A-O])\s*[)\.]\s*([A-Za-z\-]+)\s+(\d{2})\)/g, '【$3】 ');
  // Clean leftover underscores
  cleanPassage = cleanPassage.replace(/_{2,}/g, ' ');

  fillState = { blanks, current: {}, used: {} };

  const isFav = state.fav[q.id];
  content.innerHTML = `
    <div class="card">
      <span class="q-tag">${escapeHtml(q.unit || '')} · 选词填空${isAnswerEdited(q)?' ✎':''}</span>
      <div class="word-bank" id="wordBank">
        ${q.wordBank.map(w => `<div class="word-chip" data-l="${w.letter}" onclick="useWord('${w.letter}')">${w.letter}. ${escapeHtml(w.text)}</div>`).join('')}
      </div>
      <div class="fill-passage" id="fillPassage">${renderFillPassage(cleanPassage)}</div>
      <div class="answer-box" id="answerBox"></div>
      <div class="actions">
        <button class="btn-next" onclick="nextQ()">下一题</button>
        <button class="btn-fav" onclick="toggleFav()">${isFav?'★ 收藏中':'☆ 收藏'}</button>
        <button class="btn-edit" onclick="openEditAnswer()">✎ 编辑答案</button>
      </div>
      <div class="nav-bar">
        <button onclick="prevQ()" ${state.idx===0?'disabled':''}>上一题</button>
        <span class="nav-pos" onclick="openQmap()">${state.idx+1} / ${state.list.length}</span>
        <button onclick="nextQ()" ${state.idx===state.list.length-1?'disabled':''}>下一题</button>
      </div>
    </div>`;

  if (state.answered) {
    restoreFillResult(q);
  }
}

function renderFillPassage(passage) {
  return escapeHtml(passage).replace(/【(\d+)】/g, (match, num) => {
    return `<span class="blank" data-num="${num}" onclick="clearBlank('${num}')" title="点击清除">___</span>`;
  });
}

function useWord(letter) {
  if (state.answered) return;
  const blanks = document.querySelectorAll('#fillPassage .blank:not(.filled)');
  if (blanks.length === 0) return;
  const target = blanks[0];
  const num = target.dataset.num;
  fillState.current[num] = letter;
  target.textContent = letter;
  target.classList.add('filled');
  document.querySelector(`.word-chip[data-l="${letter}"]`).classList.add('used');
  const allFilled = document.querySelectorAll('#fillPassage .blank:not(.filled)').length === 0;
  if (allFilled) confirmFill();
}

function clearBlank(num) {
  if (state.answered) return;
  const el = document.querySelector(`.blank[data-num="${num}"]`);
  const letter = fillState.current[num];
  if (letter) {
    delete fillState.current[num];
    el.textContent = '___';
    el.classList.remove('filled');
    const chip = document.querySelector(`.word-chip[data-l="${letter}"]`);
    if (chip) chip.classList.remove('used');
  }
}

function confirmFill() {
  if (state.answered) return;
  const blanks = getFillBlanks(state.list[state.idx]);
  const wordByLetter = {};
  (state.list[state.idx].wordBank || []).forEach(w => wordByLetter[w.letter] = w.text);
  const total = Object.keys(blanks).length;
  state.answered = true;
  const box = document.getElementById('answerBox');
  if (total === 0) {
    box.className = 'answer-box show';
    box.innerHTML = `<span class="label">已作答</span> 正确答案：无答案`;
    saveState();
    updateStats();
    return;
  }
  let correct = 0;
  for (const num in blanks) {
    const el = document.querySelector(`.blank[data-num="${num}"]`);
    const userLetter = fillState.current[num];
    const correctLetter = blanks[num];
    const word = wordByLetter[correctLetter] || '';
    if (userLetter === correctLetter) {
      el.classList.add('filled');
      el.textContent = userLetter + '(' + word + ')';
      correct++;
    } else {
      el.classList.add('wrong');
      el.textContent = (userLetter||'空') + '→' + correctLetter + '(' + word + ')';
    }
  }
  const allRight = correct === total;
  box.className = 'answer-box show ' + (allRight ? 'correct' : 'wrong');
  box.innerHTML = `<span class="label">${allRight?'全对！':'部分正确'}</span> 答对 ${correct}/${total} 空`;

  const q = state.list[state.idx];
  if (allRight) { state.right[q.id] = true; delete state.wrong[q.id]; }
  else state.wrong[q.id] = true;
  saveState();
  updateStats();
}

function restoreFillResult(q) {
  const blanks = getFillBlanks(q);
  const wordByLetter = {};
  (q.wordBank || []).forEach(w => wordByLetter[w.letter] = w.text);
  for (const num in blanks) {
    const el = document.querySelector(`.blank[data-num="${num}"]`);
    if (!el) continue;
    const correctLetter = blanks[num];
    const word = wordByLetter[correctLetter] || '';
    el.classList.add('filled');
    el.textContent = correctLetter + '(' + word + ')';
    if (!state.right[q.id]) el.classList.add('wrong');
  }
  const allRight = !!state.right[q.id];
  const box = document.getElementById('answerBox');
  if (box) {
    box.className = 'answer-box show ' + (allRight ? 'correct' : 'wrong');
    box.innerHTML = `<span class="label">${allRight?'全对！':'部分正确'}</span> 已作答`;
  }
}

// ---------- 答案管理 ----------
function getAnswer(q) {
  if (q.wordBank) {
    return state.editedAnswers[q.id] || q.blanks;
  }
  return state.editedAnswers[q.id] || q.answer;
}

function isAnswerEdited(q) {
  return state.editedAnswers[q.id] != null;
}

function getFillBlanks(q) {
  // 优先用编辑过的 blanks，否则用题库原始 blanks
  return state.editedAnswers[q.id] || q.blanks || {};
}

// ---------- 答题判定 ----------
function selectOpt(letter) {
  if (state.answered) return;
  state.selected = letter;
  state.answered = true;
  showResult(state.list[state.idx]);
}

function selectMatch(letter) {
  if (state.answered) return;
  state.selected = letter;
  state.answered = true;
  showResult(state.list[state.idx]);
}

function showResult(q) {
  const answer = getAnswer(q);
  const noAnswer = !answer;
  const correct = noAnswer ? false : state.selected === answer;
  if (q.passages) {
    document.querySelectorAll('.match-opt').forEach(el => {
      const l = el.dataset.l;
      el.classList.remove('selected');
      if (!noAnswer && l === answer) el.classList.add('correct');
      else if (l === state.selected) el.classList.add('wrong');
    });
  } else {
    document.querySelectorAll('.option').forEach(el => {
      const l = el.dataset.l;
      el.classList.remove('selected');
      if (!noAnswer && l === answer) el.classList.add('correct');
      else if (l === state.selected) el.classList.add('wrong');
    });
  }
  const box = document.getElementById('answerBox');
  let detail = '';
  if (noAnswer) {
    detail = '无答案';
  } else {
    const ansOpt = (q.options || []).find(o => o.letter === answer);
    if (ansOpt) {
      detail = `${answer}. ${escapeHtml(ansOpt.text)}`;
    } else {
      detail = answer;
    }
  }
  const edited = isAnswerEdited(q);
  if (edited) detail += ' <span style="color:#fa8c16;font-size:11px">✎已编辑</span>';

  if (noAnswer) {
    box.className = 'answer-box show';
    box.innerHTML = `<span class="label">已作答</span> 正确答案：${detail}`;
  } else {
    box.className = 'answer-box show ' + (correct ? 'correct' : 'wrong');
    box.innerHTML = `<span class="label">${correct?'回答正确！':'回答错误'}</span> 正确答案：${detail}`;
    if (correct) { state.right[q.id] = true; delete state.wrong[q.id]; }
    else state.wrong[q.id] = true;
  }
  saveState();
  updateStats();
}

// ---------- 收藏 / 导航 ----------
function toggleFav() {
  const q = state.list[state.idx];
  if (state.fav[q.id]) delete state.fav[q.id];
  else state.fav[q.id] = true;
  saveState();
  render();
}

function nextQ() {
  if (state.idx < state.list.length - 1) {
    state.idx++;
    state.selected = null;
    state.answered = false;
    render();
  }
}

function prevQ() {
  if (state.idx > 0) {
    state.idx--;
    state.selected = null;
    state.answered = false;
    render();
  }
}

function togglePassage(el) {
  const box = document.getElementById('passageBox');
  box.classList.toggle('collapsed');
}

function openQmap() {
  const overlay = document.getElementById('qmapOverlay');
  const grid = document.getElementById('qmapGrid');
  const title = document.getElementById('qmapTitle');
  const q = state.list[state.idx];
  title.textContent = (q.typeName || '题目') + ' · 题目导航';
  let html = '';
  state.list.forEach((item, idx) => {
    let cls = 'qmap-item';
    if (idx === state.idx) cls += ' current';
    else if (state.right[item.id]) cls += ' done-right';
    else if (state.wrong[item.id]) cls += ' done-wrong';
    let label = idx + 1;
    if (item.number) label = item.number;
    html += `<div class="${cls}" onclick="jumpTo(${idx})">${label}</div>`;
  });
  grid.innerHTML = html;
  overlay.classList.add('show');
}

function closeQmap(e) {
  if (e && e.target !== document.getElementById('qmapOverlay')) return;
  document.getElementById('qmapOverlay').classList.remove('show');
}

function jumpTo(idx) {
  state.idx = idx;
  state.selected = null;
  state.answered = false;
  document.getElementById('qmapOverlay').classList.remove('show');
  render();
}

// ---------- 导入功能 ----------
let pendingBank = null;

function openImport() {
  resetImportForm();
  populateImportTarget();
  document.getElementById('importOverlay').classList.add('show');
  document.getElementById('importFile').addEventListener('change', onFileSelect, { once: true });
}

function openAppend(bankId) {
  resetImportForm();
  populateImportTarget();
  document.getElementById('importTarget').value = bankId;
  document.getElementById('importOverlay').classList.add('show');
  document.getElementById('importFile').addEventListener('change', onFileSelect, { once: true });
}

function populateImportTarget() {
  const sel = document.getElementById('importTarget');
  const banks = getUserBanks();
  let html = '<option value="__new__">新建题库</option>';
  html += '<option value="default">大学英语4（默认）</option>';
  for (const b of banks) {
    html += `<option value="${b.id}">${escapeHtml(b.name)}</option>`;
  }
  sel.innerHTML = html;
}

function resetImportForm() {
  document.getElementById('importFile').value = '';
  document.getElementById('importText').value = '';
  document.getElementById('importName').value = '';
  document.getElementById('importPreview').style.display = 'none';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('importActions').style.display = 'none';
  document.getElementById('importStatus').style.display = 'none';
  pendingBank = null;
}

function parseImportedText() {
  const text = document.getElementById('importText').value.trim();
  if (!text) { alert('请先粘贴题目内容'); return; }
  const name = document.getElementById('importName').value.trim() || '粘贴题库';
  pendingBank = parseMarkdownBank(text, name);
  if (pendingBank.questions.length === 0) {
    alert('未能解析出题目，请检查内容格式');
    return;
  }
  showImportPreview(pendingBank);
}

function onFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const name = document.getElementById('importName').value || file.name.replace(/\.(md|docx|pdf)$/i, '');
  const ext = file.name.split('.').pop().toLowerCase();
  const status = document.getElementById('importStatus');

  if (ext === 'md') {
    const reader = new FileReader();
    reader.onload = (ev) => {
      pendingBank = parseMarkdownBank(ev.target.result, name);
      if (pendingBank.questions.length === 0) {
        alert('未能解析出题目，请检查文件格式');
        return;
      }
      showImportPreview(pendingBank);
    };
    reader.readAsText(file, 'utf-8');
  } else if (ext === 'docx') {
    status.textContent = '正在解析 Word 文件...';
    status.style.display = 'block';
    const reader = new FileReader();
    reader.onload = (ev) => {
      parseDocxBank(ev.target.result, name)
        .then(bank => {
          pendingBank = bank;
          status.style.display = 'none';
          if (bank.questions.length === 0) {
            alert('未能解析出题目，请检查文件格式');
            return;
          }
          showImportPreview(bank);
        })
        .catch(err => {
          status.textContent = 'Word 解析失败：' + err.message;
          status.style.color = '#f5222d';
        });
    };
    reader.readAsArrayBuffer(file);
  } else if (ext === 'pdf') {
    status.textContent = '正在解析 PDF 文件...';
    status.style.display = 'block';
    const reader = new FileReader();
    reader.onload = (ev) => {
      parsePdfBank(ev.target.result, name)
        .then(bank => {
          pendingBank = bank;
          status.style.display = 'none';
          if (bank.questions.length === 0) {
            alert('未能解析出题目，请检查文件格式');
            return;
          }
          showImportPreview(bank);
        })
        .catch(err => {
          status.textContent = 'PDF 解析失败：' + err.message;
          status.style.color = '#f5222d';
        });
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert('不支持的文件格式，请选择 .md / .docx / .pdf 文件');
  }
}

function showImportPreview(bank) {
  const types = {};
  bank.questions.forEach(q => { types[q.typeName] = (types[q.typeName]||0)+1; });
  const summary = Object.entries(types).map(([t, c]) => t + ':' + c).join(' / ') || '无题目';
  const preview = document.getElementById('importPreview');
  preview.style.display = 'block';
  let html = `<div style="padding:10px;background:#f9f9f7;border-radius:6px;font-size:13px">
    <div style="font-weight:600;margin-bottom:4px">题库名：${escapeHtml(bank.name)}</div>
    <div style="color:#666">题目数：${bank.questions.length}（${summary}）</div>`;
  if (bank.questions.length === 0) {
    html += `<div style="color:#f5222d;margin-top:6px">未解析到题目，请检查格式</div>`;
  }
  // Sample question
  if (bank.questions[0]) {
    const q = bank.questions[0];
    html += `<div style="margin-top:8px;padding:8px;background:#fff;border-radius:4px;font-size:12px">
      <div style="color:#999">示例题：${escapeHtml(q.typeName)} ${q.number||''}</div>
      <div>${escapeHtml((q.stem||q.passage||'').slice(0, 80))}</div>
    </div>`;
  }
  html += `</div>`;
  preview.innerHTML = html;
  // 根据目标更新按钮文案
  const targetId = document.getElementById('importTarget').value;
  const btn = document.querySelector('#importActions button');
  if (targetId === '__new__') btn.textContent = '确认导入';
  else btn.textContent = '追加题目';
  document.getElementById('importActions').style.display = 'block';
}

function confirmImport() {
  if (!pendingBank || pendingBank.questions.length === 0) {
    alert('没有可导入的题目');
    return;
  }
  const targetId = document.getElementById('importTarget').value;
  if (targetId === '__new__') {
    saveUserBank(pendingBank);
    localStorage.setItem(LS.activeBank, pendingBank.id);
    closeImport();
    loadBank(pendingBank.id);
  } else {
    appendToBank(targetId, pendingBank.questions);
  }
}

function appendToBank(bankId, newQuestions) {
  if (bankId === 'default') {
    // 追加到默认题库：更新 state 并保存到 npoint 缓存
    state.questions = state.questions.concat(newQuestions);
    state.bank.questions = state.questions;
    const cached = JSON.stringify(state.bank);
    localStorage.setItem(LS.cacheBank('default'), cached);
    // 刷新 UI
    buildList();
    renderTabs();
    renderBankSelect();
    updateHeader();
    updateStats();
    closeImport();
  } else {
    const banks = getUserBanks();
    const bank = banks.find(b => b.id === bankId);
    if (!bank) { alert('目标题库不存在'); return; }
    bank.questions = (bank.questions || []).concat(newQuestions);
    localStorage.setItem(LS.banks, JSON.stringify(banks));
    // 如果当前正在看这个题库，刷新
    if (state.bank && state.bank.id === bankId) {
      closeImport();
      loadBank(bankId);
    } else {
      localStorage.setItem(LS.activeBank, bankId);
      closeImport();
      loadBank(bankId);
    }
  }
}

function cancelImport() {
  resetImportForm();
}

function closeImport(e) {
  if (e && e.target !== document.getElementById('importOverlay')) return;
  document.getElementById('importOverlay').classList.remove('show');
}

// ---------- 题库管理 ----------
function deleteBankUI(bankId) {
  if (!confirm('删除此题库？相关答题记录也会清除。')) return;
  deleteBank(bankId);
  if (state.bank && state.bank.id === bankId) {
    localStorage.setItem(LS.activeBank, 'default');
    loadBank('default');
  } else {
    renderBankSelect();
  }
}

function startRename(bankId, currentName) {
  const newName = prompt('修改题库名称：', currentName);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed) { alert('题库名称不能为空'); return; }
  const banks = getUserBanks();
  const bank = banks.find(b => b.id === bankId);
  if (!bank) { alert('题库不存在'); return; }
  bank.name = trimmed;
  localStorage.setItem(LS.banks, JSON.stringify(banks));
  // 同步当前已加载的题库状态
  if (state.bank && state.bank.id === bankId) {
    state.bank.name = trimmed;
    updateHeader();
  }
  renderBankSelect();
}

// ---------- 答案编辑弹窗 ----------
function openEditAnswer() {
  const q = state.list[state.idx];
  const overlay = document.getElementById('editAnswerOverlay');
  const body = document.getElementById('editAnswerBody');

  if (q.wordBank) {
    const blanks = getFillBlanks(q);
    let html = '<p style="font-size:13px;color:#666;margin-bottom:8px">修改每个空格对应的字母：</p>';
    for (const num of Object.keys(blanks).sort((a,b) => a-b)) {
      html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="min-width:40px;font-size:13px">空${num}:</span>
        <input type="text" id="editBlank_${num}" value="${blanks[num]}" maxlength="1"
          style="width:40px;padding:4px 8px;border:1px solid #d0d0d0;border-radius:4px;text-align:center;font-size:14px;text-transform:uppercase">
      </div>`;
    }
    body.innerHTML = html;
  } else {
    // 选择题：选正确答案字母
    const currentAnswer = getAnswer(q);
    const letters = q.options ? q.options.map(o => o.letter) : [];
    let html = '<p style="font-size:13px;color:#666;margin-bottom:8px">选择正确答案：</p><div style="display:flex;gap:8px;flex-wrap:wrap">';
    for (const l of letters) {
      const isActive = l === currentAnswer;
      html += `<div class="edit-answer-opt ${isActive?'active':''}" data-l="${l}" onclick="selectEditAnswer('${l}')"
        style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;
        border:2px solid ${isActive?'#4a90d9':'#d0d0d0'};border-radius:50%;cursor:pointer;font-weight:600;
        background:${isActive?'#ebf3fc':'#fff'};color:${isActive?'#4a90d9':'#333'};font-size:14px">${l}</div>`;
    }
    html += '</div>';
    body.innerHTML = html;
  }
  overlay.classList.add('show');
}

let editSelectedLetter = null;

function selectEditAnswer(letter) {
  editSelectedLetter = letter;
  document.querySelectorAll('.edit-answer-opt').forEach(el => {
    const isActive = el.dataset.l === letter;
    el.style.borderColor = isActive ? '#4a90d9' : '#d0d0d0';
    el.style.background = isActive ? '#ebf3fc' : '#fff';
    el.style.color = isActive ? '#4a90d9' : '#333';
  });
}

function confirmEditAnswer() {
  const q = state.list[state.idx];
  if (q.wordBank) {
    const blanks = {};
    const inputs = document.querySelectorAll('[id^="editBlank_"]');
    inputs.forEach(inp => {
      const num = inp.id.replace('editBlank_', '');
      const val = inp.value.trim().toUpperCase();
      if (val && /[A-O]/.test(val)) blanks[num] = val;
    });
    if (Object.keys(blanks).length > 0) {
      state.editedAnswers[q.id] = blanks;
    }
  } else {
    const letter = editSelectedLetter;
    if (!letter) { alert('请选择一个答案'); return; }
    state.editedAnswers[q.id] = letter;
  }
  editSelectedLetter = null;
  saveState();
  document.getElementById('editAnswerOverlay').classList.remove('show');
  // 重新渲染当前题
  state.selected = null;
  state.answered = false;
  render();
}

function resetEditAnswer() {
  const q = state.list[state.idx];
  if (state.editedAnswers[q.id] != null) {
    delete state.editedAnswers[q.id];
    saveState();
  }
  document.getElementById('editAnswerOverlay').classList.remove('show');
  state.selected = null;
  state.answered = false;
  render();
}

function closeEditAnswer(e) {
  if (e && e.target !== document.getElementById('editAnswerOverlay')) return;
  document.getElementById('editAnswerOverlay').classList.remove('show');
}

// ---------- 帮助弹窗 ----------
function openHelp() {
  document.getElementById('helpOverlay').classList.add('show');
}

function closeHelp(e) {
  if (e && e.target !== document.getElementById('helpOverlay')) return;
  document.getElementById('helpOverlay').classList.remove('show');
}

// ---------- 持久化 ----------
function saveState() {
  if (!state.bank) return;
  localStorage.setItem(LS.wrong(state.bank.id), JSON.stringify(state.wrong));
  localStorage.setItem(LS.right(state.bank.id), JSON.stringify(state.right));
  localStorage.setItem(LS.fav(state.bank.id), JSON.stringify(state.fav));
  localStorage.setItem(LS.answers(state.bank.id), JSON.stringify(state.editedAnswers));
}

// ---------- 工具 ----------
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ---------- 键盘快捷键 ----------
document.addEventListener('keydown', (e) => {
  // 弹窗打开时不响应
  const overlays = ['qmapOverlay', 'importOverlay', 'editAnswerOverlay', 'helpOverlay'];
  if (overlays.some(id => document.getElementById(id).classList.contains('show'))) return;
  if (state.list.length === 0) return;
  const q = state.list[state.idx];
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  // A-O 字母键选词（选词填空）
  if (/^[A-O]$/i.test(e.key) && !state.answered && q.wordBank) {
    useWord(e.key.toUpperCase());
    e.preventDefault();
    return;
  }
  // 数字键 1-4 选择选项（选择题）
  if (['1','2','3','4'].includes(e.key) && !state.answered && !q.wordBank) {
    const letters = q.options ? q.options.map(o => o.letter) : [];
    const idx = parseInt(e.key) - 1;
    if (idx < letters.length) {
      if (q.passages) selectMatch(letters[idx]);
      else selectOpt(letters[idx]);
      e.preventDefault();
    }
    return;
  }
  // 左右箭头翻页
  if (e.key === 'ArrowLeft') { prevQ(); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { nextQ(); e.preventDefault(); }
  // F 收藏
  else if (e.key === 'f' || e.key === 'F') { toggleFav(); e.preventDefault(); }
});

// ---------- 启动 ----------
(async function init() {
  const activeId = localStorage.getItem(LS.activeBank) || 'default';
  await loadBank(activeId);
})();
