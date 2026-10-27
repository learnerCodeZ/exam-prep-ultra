// 期末刷题宝典 — 在线编程题（编辑器 / 运行 / 提交评测 / 查看答案 / turtle 画布）

const ProgrammingUI = {
  lastResult: {},
  refOpen: {},

  getCode(q) {
    const saved = localStorage.getItem('ultra_prog_code_' + q.id);
    return saved != null ? saved : (q.starterCode || '');
  },

  saveCode() {
    const q = currentProgrammingQ();
    const ta = document.getElementById('progEditor');
    if (!q || !ta) return;
    localStorage.setItem('ultra_prog_code_' + q.id, ta.value);
  },

  resetCode() {
    const q = currentProgrammingQ();
    if (!q) return;
    if (!confirm('重置为初始代码？当前编辑内容会丢失。')) return;
    localStorage.removeItem('ultra_prog_code_' + q.id);
    const ta = document.getElementById('progEditor');
    if (ta) ta.value = q.starterCode || '';
    const status = document.getElementById('progStatus');
    if (status) status.textContent = '';
  },

  run() { return this.execute('run'); },
  submit() { return this.execute('submit'); },

  async execute(mode) {
    const q = currentProgrammingQ();
    if (!q) return;
    const ta = document.getElementById('progEditor');
    const status = document.getElementById('progStatus');
    if (!ta || !status) return;

    this.saveCode();
    const code = ta.value;
    const isTurtle = q.judgeMode === 'turtle';
    const baseFiles = q.files || {};
    const readFiles = q.readFiles || [];
    this.setBusy(true);
    status.className = 'prog-status running';
    status.textContent = Judge.ready ? '运行中…' : '正在加载 Python 运行环境（首次约需几秒）…';

    try {
      if (mode === 'submit' && !isTurtle) {
        const tests = q.tests || [];
        if (tests.length === 0) {
          status.textContent = '该题没有评测用例';
          return;
        }
        const results = [];
        for (let i = 0; i < tests.length; i++) {
          status.textContent = `评测中… (${i + 1}/${tests.length})`;
          const testFiles = Object.assign({}, baseFiles, tests[i].files || {});
          const res = await Judge.run({
            code,
            stdin: tests[i].input || '',
            turtle: false,
            files: testFiles,
            readFiles,
          });
          const expectedFiles = tests[i].expectFiles || {};
          const gotFiles = res.files || {};
          const stdoutOk = !res.error && normalizeOutput(res.stdout) === normalizeOutput(tests[i].output);
          const filesOk = Object.keys(expectedFiles).every(name =>
            !res.error && normalizeOutput(gotFiles[name]) === normalizeOutput(expectedFiles[name])
          );
          results.push({
            input: tests[i].input,
            expected: tests[i].output,
            got: res.stdout,
            error: res.error,
            expectedFiles,
            gotFiles,
            pass: stdoutOk && filesOk,
          });
        }
        const allPass = results.every(r => r.pass);
        const summary = { mode: 'submit', results, allPass };
        this.lastResult[q.id] = summary;
        this.renderSubmitResult(summary);

        if (allPass) { state.right[q.id] = true; delete state.wrong[q.id]; }
        else state.wrong[q.id] = true;
        saveState();
        updateStats();

        status.className = 'prog-status ' + (allPass ? 'ok' : 'bad');
        status.textContent = allPass ? `全部通过（${results.length}/${results.length}）` : '未全部通过';
        return;
      }

      const stdinEl = document.getElementById('progStdin');
      const stdin = stdinEl ? stdinEl.value : (q.defaultInput || '');
      const res = await Judge.run({ code, stdin, turtle: isTurtle, files: baseFiles, readFiles });
      this.lastResult[q.id] = { mode: 'run', res };
      this.renderRunResult(q, res);

      if (res.error) {
        status.className = 'prog-status bad';
        status.textContent = '运行出错';
        if (isTurtle && mode === 'submit') {
          state.wrong[q.id] = true;
          delete state.right[q.id];
          saveState();
          updateStats();
        }
      } else if (isTurtle) {
        const chk = turtleCheck(q, res.turtle || []);
        status.className = 'prog-status ' + (chk.ok ? 'ok' : 'warn');
        const detail = chk.label.replace('运行成功 · ', '');
        status.textContent = mode === 'submit'
          ? (chk.ok ? '提交成功 · ' : '提交未通过 · ') + detail
          : chk.label;
        if (mode === 'submit') {
          if (chk.ok) { state.right[q.id] = true; delete state.wrong[q.id]; }
          else state.wrong[q.id] = true;
          saveState();
          updateStats();
        }
      } else {
        status.className = 'prog-status ok';
        status.textContent = '运行完成';
      }
    } catch (e) {
      status.className = 'prog-status bad';
      status.textContent = e.message || '运行失败';
      const out = document.getElementById('progOutput');
      if (out) out.innerHTML = `<div class="prog-error">${escapeHtml(e.message || String(e))}</div>`;
    } finally {
      this.setBusy(false);
    }
  },

  setBusy(busy) {
    const runBtn = document.getElementById('progRunBtn');
    const submitBtn = document.getElementById('progSubmitBtn');
    if (runBtn) runBtn.disabled = busy;
    if (submitBtn) submitBtn.disabled = busy;
  },

  renderRunResult(q, res) {
    const out = document.getElementById('progOutput');
    if (!out) return;
    let html = '';
    if (res.stdout) {
      html += `<div class="prog-out-block"><div class="prog-out-label">输出</div><pre>${escapeHtml(res.stdout)}</pre></div>`;
    }
    if (res.stderr) {
      html += `<div class="prog-out-block stderr"><div class="prog-out-label">错误输出</div><pre>${escapeHtml(res.stderr)}</pre></div>`;
    }
    if (res.files && typeof res.files === 'object') {
      for (const [name, content] of Object.entries(res.files)) {
        if (content == null) {
          html += `<div class="prog-out-block stderr"><div class="prog-out-label">文件 ${escapeHtml(name)}</div><div class="prog-tip">程序没有生成这个文件，检查文件名是否正确。</div></div>`;
        } else {
          html += `<div class="prog-out-block"><div class="prog-out-label">文件 ${escapeHtml(name)}</div><pre>${escapeHtml(content)}</pre></div>`;
        }
      }
    }
    if (res.error) {
      const tip = /EOFError/.test(res.error) ? '<div class="prog-tip">程序在等待输入，但没有可用的标准输入。</div>' : '';
      html += `<div class="prog-error">${escapeHtml(res.error)}</div>${tip}`;
    }
    if (!html) html = '<div class="prog-out-empty">程序运行完成，没有输出</div>';
    out.innerHTML = html;

    if (q.judgeMode === 'turtle') {
      const canvas = document.getElementById('progCanvas');
      if (canvas) renderTurtleCommands(canvas, res.turtle || []);
    }
  },

  renderSubmitResult(summary) {
    const out = document.getElementById('progOutput');
    if (!out) return;
    const rows = summary.results.map((r, i) => {
      const fileNames = Object.keys(r.expectedFiles || {});
      const filesHtml = fileNames.length ? `
        <div class="prog-case-files">
          ${fileNames.map(name => `
            <div class="prog-file-pair">
              <div>
                <div class="prog-out-label">期望文件 ${escapeHtml(name)}</div>
                <pre>${escapeHtml(r.expectedFiles[name] || '')}</pre>
              </div>
              <div>
                <div class="prog-out-label">实际生成</div>
                <pre>${r.error ? '运行错误' : (r.gotFiles && r.gotFiles[name] != null ? escapeHtml(r.gotFiles[name]) : '(未生成)')}</pre>
              </div>
            </div>`).join('')}
        </div>` : '';
      return `
      <div class="prog-case ${r.pass ? 'pass' : 'fail'}">
        <div class="prog-case-head">样例 ${i + 1} ${r.pass ? '✓ 通过' : '✗ 未通过'}</div>
        <div class="prog-case-body">
          <div><div class="prog-out-label">输入</div><pre>${escapeHtml(r.input || '(无)')}</pre></div>
          <div><div class="prog-out-label">期望输出</div><pre>${escapeHtml(r.expected || '')}</pre></div>
          <div><div class="prog-out-label">实际输出</div><pre>${escapeHtml(r.error ? '运行错误：' + r.error : (r.got || '(无输出)'))}</pre></div>
        </div>
        ${filesHtml}
      </div>`;
    }).join('');
    out.innerHTML =
      `<div class="prog-summary ${summary.allPass ? 'ok' : 'bad'}">${
        summary.allPass ? '全部样例通过' : '未全部通过'
      }</div>${rows}`;
  },

  toggleReference() {
    const q = currentProgrammingQ();
    if (!q) return;
    this.refOpen[q.id] = !this.refOpen[q.id];
    this.applyRefState(q);
  },

  applyRefState(q) {
    const box = document.getElementById('progRef');
    const btn = document.getElementById('progRefBtn');
    if (!box) return;
    const open = !!this.refOpen[q.id];
    box.style.display = open ? 'block' : 'none';
    if (btn) btn.textContent = open ? '隐藏答案' : '查看答案';
  },

  copyReference() {
    const q = currentProgrammingQ();
    if (!q) return;
    const ta = document.getElementById('progEditor');
    if (!ta) return;
    ta.value = q.reference || '';
    this.saveCode();
  },
};

function currentProgrammingQ() {
  const q = state.list[state.idx];
  return q && q.type === 'programming' ? q : null;
}

function normalizeOutput(s) {
  return String(s == null ? '' : s)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .trim();
}

function renderProgramming(q, content) {
  const isTurtle = q.judgeMode === 'turtle';
  const isFav = state.fav[q.id];
  const samplesHtml = (q.samples && q.samples.length) ? `
    <div class="prog-samples">
      ${q.samples.map((s, i) => `
        <div class="prog-sample">
          <div class="prog-sample-title">样例 ${i + 1}</div>
          <div class="prog-sample-cols">
            <div><div class="prog-out-label">输入</div><pre>${escapeHtml(s.input || '(无)')}</pre></div>
            <div><div class="prog-out-label">输出</div><pre>${escapeHtml(s.output || '')}</pre></div>
          </div>
        </div>`).join('')}
    </div>` : '';

  const fileEntries = Object.entries(q.files || {});
  const filesHtml = fileEntries.length ? `
    <div class="prog-files">
      <div class="prog-out-label">题目附带文件（运行和评测时自动写入当前目录）</div>
      ${fileEntries.map(([name, body]) => `
        <div class="prog-file">
          <div class="prog-file-name">${escapeHtml(name)}</div>
          <pre>${escapeHtml(body)}</pre>
        </div>`).join('')}
      ${(q.readFiles && q.readFiles.length)
        ? `<div class="prog-file-hint">程序需要生成：${q.readFiles.map(escapeHtml).join('、')}</div>`
        : ''}
    </div>` : '';

  content.innerHTML = `
    <div class="card prog-card">
      <span class="q-tag">${questionTag(q)}</span>
      <h2 class="prog-title">${escapeHtml(q.title || '')}</h2>
      <div class="prog-desc">${q.description || ''}</div>
      ${samplesHtml}
      ${filesHtml}

      <div class="prog-toolbar">
        <button class="btn-run" id="progRunBtn" onclick="ProgrammingUI.run()">▶ 运行</button>
        <button class="btn-submit" id="progSubmitBtn" onclick="ProgrammingUI.submit()">${isTurtle ? '✓ 提交检测' : '✓ 提交评测'}</button>
        <button class="btn-reveal" id="progRefBtn" onclick="ProgrammingUI.toggleReference()">查看答案</button>
        <button class="btn-reset" onclick="ProgrammingUI.resetCode()">重置代码</button>
        <span class="prog-status" id="progStatus"></span>
      </div>

      <div class="prog-editor-wrap">
        <div class="prog-editor-head">
          <span>Python 3</span>
          <span class="prog-hint">Tab 缩进 · Ctrl+Enter 运行</span>
        </div>
        <textarea id="progEditor" class="prog-editor" spellcheck="false" wrap="off"></textarea>
      </div>

      ${(isTurtle && !q.defaultInput) ? '' : `
      <div class="prog-stdin-wrap">
        <div class="prog-out-label">标准输入（运行时可改）</div>
        <textarea id="progStdin" class="prog-stdin" spellcheck="false"
          placeholder="每行一个输入，可留空">${escapeHtml(q.defaultInput || (q.samples && q.samples[0] ? q.samples[0].input : ''))}</textarea>
      </div>`}

      <div class="prog-output" id="progOutput"></div>

      ${isTurtle ? '<div class="prog-canvas-wrap"><canvas id="progCanvas" width="960" height="460"></canvas></div>' : ''}

      <div class="prog-ref" id="progRef" style="display:none">
        <div class="prog-ref-head">
          <span>参考答案</span>
          <button onclick="ProgrammingUI.copyReference()">复制到编辑器</button>
        </div>
        <pre>${escapeHtml(q.reference || '暂无参考答案')}</pre>
      </div>

      <div class="actions">
        <button class="btn-next" onclick="nextQ()">下一题</button>
        <button class="btn-fav" onclick="toggleFav()">${isFav ? '★ 收藏中' : '☆ 收藏'}</button>
      </div>
      <div class="nav-bar">
        <button onclick="prevQ()" ${state.idx === 0 ? 'disabled' : ''}>上一题</button>
        <span class="nav-pos" onclick="openQmap()">${state.idx + 1} / ${state.list.length}</span>
        <button onclick="nextQ()" ${state.idx === state.list.length - 1 ? 'disabled' : ''}>下一题</button>
      </div>
    </div>`;

  const ta = document.getElementById('progEditor');
  ta.value = ProgrammingUI.getCode(q);
  ta.addEventListener('input', () => ProgrammingUI.saveCode());
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = ta.value.slice(0, start) + '    ' + ta.value.slice(end);
      ta.selectionStart = ta.selectionEnd = start + 4;
      ProgrammingUI.saveCode();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      ProgrammingUI.run();
    }
  });

  ProgrammingUI.applyRefState(q);

  const prev = ProgrammingUI.lastResult[q.id];
  if (prev) {
    if (prev.mode === 'submit') ProgrammingUI.renderSubmitResult(prev);
    else ProgrammingUI.renderRunResult(q, prev.res);
  }
}

// ---------- turtle 命令回放 ----------
function turtleColor(c) {
  const s = String(c == null ? '' : c).trim();
  return s || '#333333';
}

function renderTurtleCommands(canvas, cmds) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  let x = 0, y = 0, h = 0, pen = true, color = '#333333', size = 2;
  const paths = [];
  const fills = [];
  let current = null;
  let fillAccum = null;

  const addPoint = (nx, ny) => {
    if (pen) {
      if (!current) {
        current = { color, size, points: [{ x, y }] };
        paths.push(current);
      }
      current.points.push({ x: nx, y: ny });
      if (fillAccum) fillAccum.points.push({ x: nx, y: ny });
    } else {
      current = null;
    }
    x = nx;
    y = ny;
  };

  for (const c of cmds) {
    if (!c || typeof c !== 'object') continue;
    switch (c.op) {
      case 'init':
        x = 0; y = 0; h = 0; pen = true; color = '#333333'; size = 2;
        current = null; fillAccum = null;
        break;
      case 'goto':
        addPoint(Number(c.x), Number(c.y));
        break;
      case 'heading':
        h = Number(c.h);
        break;
      case 'pen':
        pen = !!c.pen;
        current = null;
        if (!pen) fillAccum = null;
        break;
      case 'pensize':
        size = Number(c.size) || 1;
        current = null;
        break;
      case 'color':
        color = turtleColor(c.color);
        current = null;
        break;
      case 'fillstart':
        fillAccum = { color: turtleColor(c.fillcolor), points: [{ x, y }] };
        break;
      case 'fillend':
        if (fillAccum && fillAccum.points.length > 1) fills.push(fillAccum);
        fillAccum = null;
        break;
      case 'circle': {
        const r = Number(c.r);
        const ext = Number(c.extent);
        const rRad = radiusOf(c.x, c.y, r, h);
        const cx = rRad.cx;
        const cy = rRad.cy;
        const R = Math.abs(r);
        const phi0 = Math.atan2(y - cy, x - cx);
        const sign = r >= 0 ? 1 : -1;
        const steps = Math.max(12, Math.ceil(Math.abs(ext) / 3));
        for (let i = 1; i <= steps; i++) {
          const phi = phi0 + sign * toRad(ext) * (i / steps);
          addPoint(cx + R * Math.cos(phi), cy + R * Math.sin(phi));
        }
        h += sign * ext;
        break;
      }
    }
  }

  if (paths.length === 0) {
    drawTurtleEmpty(ctx, W, H, cmds.length === 0 ? '暂无绘图命令，点击“运行”查看结果' : '代码没有产生图形');
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    for (const pt of p.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  const pad = 30;
  const rangeX = Math.max(maxX - minX, 1);
  const rangeY = Math.max(maxY - minY, 1);
  const scale = Math.min((W - pad * 2) / rangeX, (H - pad * 2) / rangeY);
  const ox = (W - rangeX * scale) / 2 - minX * scale;
  const oy = (H - rangeY * scale) / 2 + maxY * scale;
  const tx = px => ox + px * scale;
  const ty = py => oy - py * scale;

  // 坐标轴
  ctx.save();
  ctx.strokeStyle = '#eef1f5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, ty(0));
  ctx.lineTo(W, ty(0));
  ctx.moveTo(tx(0), 0);
  ctx.lineTo(tx(0), H);
  ctx.stroke();
  ctx.restore();

  ctx.lineJoin = 'round';

  // 先填充，再描边，保证轮廓可见
  for (const f of fills) {
    if (f.points.length < 2) continue;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.moveTo(tx(f.points[0].x), ty(f.points[0].y));
    for (let i = 1; i < f.points.length; i++) {
      ctx.lineTo(tx(f.points[i].x), ty(f.points[i].y));
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.lineCap = 'round';
  for (const p of paths) {
    if (p.points.length < 2) continue;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(1, p.size * scale);
    ctx.beginPath();
    ctx.moveTo(tx(p.points[0].x), ty(p.points[0].y));
    for (let i = 1; i < p.points.length; i++) {
      ctx.lineTo(tx(p.points[i].x), ty(p.points[i].y));
    }
    ctx.stroke();
  }
}

function radiusOf(px, py, r, heading) {
  // 圆心位于海龟朝向的左侧 r 处（r 为负时在右侧）
  return {
    cx: Number(px) - r * Math.sin(toRad(heading)),
    cy: Number(py) + r * Math.cos(toRad(heading)),
  };
}

function toRad(deg) {
  return deg * Math.PI / 180;
}

function drawTurtleEmpty(ctx, W, H, text) {
  ctx.save();
  ctx.fillStyle = '#a0a8b4';
  ctx.font = '15px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, H / 2);
  ctx.restore();
}

const COLOR_ALIASES = {
  red: '#ff0000', yellow: '#ffff00', blue: '#0000ff', black: '#000000',
  white: '#ffffff', green: '#008000', pink: '#ffc0cb', purple: '#800080',
  orange: '#ffa500', coral: '#ff7f50', brown: '#a52a2a', fuchsia: '#ff00ff',
  gray: '#808080', grey: '#808080',
};

function colorKey(c) {
  let s = String(c == null ? '' : c).trim().toLowerCase();
  if (COLOR_ALIASES[s]) return COLOR_ALIASES[s];
  if (/^#[0-9a-f]{3}$/.test(s)) {
    s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  }
  return s;
}

function turtleCheck(q, cmds) {
  const spec = q.turtleCheck || {};
  if (!cmds.length) return { ok: false, label: '运行成功 · 代码没有产生绘图命令' };

  const colors = cmds
    .filter(c => c && (c.op === 'color' || c.op === 'fillstart'))
    .map(c => colorKey(c.op === 'fillstart' ? c.fillcolor : c.color));
  const distinct = new Set(colors);
  const circles = cmds.filter(c => c && c.op === 'circle').length;
  const moves = cmds.filter(c => c && c.op === 'goto').length;

  const detail = [];
  const problems = [];

  if (spec.colors && spec.colors.length) {
    const required = spec.colors.map(colorKey);
    const hit = required.filter(c => distinct.has(c));
    if (hit.length === 0) problems.push(`未检测到要求的颜色（${spec.colors.join('/')}）`);
    else detail.push(`颜色 ${spec.colors.filter(c => distinct.has(colorKey(c))).join('/')} ✓`);
  }
  if (spec.minColors) {
    if (distinct.size < spec.minColors) problems.push(`颜色种类不足（${distinct.size}/${spec.minColors}）`);
    else detail.push(`颜色 ${distinct.size} 种 ✓`);
  }
  if (spec.minCircles) {
    if (circles < spec.minCircles) problems.push(`圆弧数量不足（${circles}/${spec.minCircles}）`);
    else detail.push(`圆弧 ${circles} 个 ✓`);
  }
  if (spec.minMoves) {
    if (moves < spec.minMoves) problems.push(`移动次数不足（${moves}/${spec.minMoves}）`);
    else detail.push(`移动 ${moves} 次 ✓`);
  }

  if (problems.length) return { ok: false, label: '运行成功 · ' + problems.join('；') };
  return { ok: true, label: '运行成功 · ' + (detail.join(' · ') || '已产生图形') };
}
