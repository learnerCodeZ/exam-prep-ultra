// 期末刷题宝典 Ultra — Markdown 题库解析器

function parseMarkdownBank(text, bankName) {
  const bank = {
    id: 'md_' + Date.now(),
    name: bankName || '导入题库',
    questions: []
  };

  const hasHeadings = /^# /m.test(text);
  if (hasHeadings) {
    // Split by top-level headings (# 听力, # 段落匹配, etc.)
    const sections = text.split(/^# (.+)$/m);
    for (let i = 1; i < sections.length; i += 2) {
      const title = sections[i].trim();
      const content = sections[i + 1] || '';
      const type = detectType(title);
      if (!type) continue;
      parseByType(type, content, bank.questions);
    }
  } else {
    // No # headings — try auto-detection or parse all types
    autoDetectAndParse(text, bank.questions);
  }

  return bank;
}

function detectType(title) {
  const map = { '听力': 'listening', '段落匹配': 'matching', '选词填空': 'fillblank', '阅读': 'reading', '单选': 'singleChoice', '多选': 'singleChoice' };
  for (const [kw, type] of Object.entries(map)) {
    if (title.includes(kw)) return type;
  }
  return null;
}

// --- 听力 ---
function parseListening(content, questions) {
  const blocks = content.split(/(?:^|\n)(\d+)[\.、．]\s*\n/);
  let num = null;
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (/^\d+$/.test(trimmed)) {
      num = parseInt(trimmed);
      continue;
    }
    if (num === null) continue;
    const opts = parseOptions(block);
    if (opts.length === 0) { num = null; continue; }
    const answer = findAnswer(opts);
    questions.push({
      id: 'tl_' + num,
      type: 'listening',
      typeName: '听力',
      number: num,
      stem: '第' + num + '题',
      options: opts,
      answer: answer
    });
    num = null;
  }
}

// --- 段落匹配 ---
function parseMatching(content, questions) {
  // Split into sets by ## headings or just parse all together
  // Passages are letter-prefixed blocks: "A. text" or "A) text"
  // Questions are numbered: "1. stem (X)" where X is answer letter
  const lines = content.split('\n');
  const passages = {};
  const questionLines = [];
  let inPassage = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Passage line: starts with letter + separator
    const pMatch = trimmed.match(/^([A-H])[\.\)]\s*(.+)/);
    if (pMatch && inPassage) {
      passages[pMatch[1]] = pMatch[2].trim();
      continue;
    }
    // Question line: starts with number
    const qMatch = trimmed.match(/^(\d+)[\.、．]\s*(.+)/);
    if (qMatch) {
      inPassage = false;
      questionLines.push({ num: parseInt(qMatch[1]), text: qMatch[2].trim() });
    }
  }

  for (const ql of questionLines) {
    // Extract answer from trailing (X)
    const ansMatch = ql.text.match(/\(([A-H])\)\s*$/);
    const answer = ansMatch ? ansMatch[1] : '';
    const stem = ql.text.replace(/\s*\([A-H]\)\s*$/, '').trim();
    const opts = Object.keys(passages).map(l => ({
      letter: l,
      text: passages[l],
      zh: ''
    }));
    questions.push({
      id: 'dlpp_' + ql.num,
      type: 'matching',
      typeName: '段落匹配',
      set: 1,
      number: ql.num,
      stem: stem,
      options: opts,
      passages: { ...passages },
      answer: answer
    });
  }
}

// --- 选词填空 ---
function parseFillBlank(content, questions) {
  // Split by ## Unit headings; if none, treat whole content as one unit
  let units;
  if (/^## /m.test(content)) {
    const parts = content.split(/^## (.+)$/m);
    units = [];
    for (let i = 1; i < parts.length; i += 2) {
      units.push({ name: parts[i].trim(), body: parts[i + 1] || '' });
    }
  } else {
    units = [{ name: '选词填空', body: content }];
  }

  for (const unit of units) {
    const body = unit.body;
    // Find word bank line: a line with multiple "X) word" entries
    const lines = body.split('\n');
    let bankLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Count letter-prefixed entries: "A) word" or "A. word"
      const matches = line.match(/\b[A-O][\)\.]\s*\S+/g) || [];
      if (matches.length >= 3) { bankLineIdx = i; break; }
    }
    if (bankLineIdx === -1) continue;

    const bankLine = lines.slice(bankLineIdx).join(' ');
    const wordBank = [];
    const bankPat = /([A-O])[\)\.]\s*(\S+(?:\s+\S+){0,1}?)(?=\s+[A-O][\)\.]|\s*$)/g;
    let bm;
    while ((bm = bankPat.exec(bankLine)) !== null) {
      wordBank.push({ letter: bm[1], text: bm[2].trim() });
    }
    if (wordBank.length === 0) continue;

    const passageText = lines.slice(0, bankLineIdx).join('\n').trim();
    if (!passageText) continue;

    // Extract blanks from __X) word__ NUM) pattern
    const blanks = {};
    const blankPat = /_+\s*([A-O])[\)\.\s]*(\S+?)_+\s*(\d+)[\)\.]/g;
    let m;
    while ((m = blankPat.exec(passageText)) !== null) {
      blanks[m[3]] = m[1];
    }

    questions.push({
      id: 'xctk_' + (questions.length + 1),
      type: 'fillblank',
      typeName: '选词填空',
      unit: unit.name,
      passage: passageText,
      wordBank: wordBank,
      blanks: blanks
    });
  }
}

// --- 阅读 ---
function parseReading(content, questions) {
  // Split by ## Passage headings; if none, treat whole as one passage
  let passages;
  if (/^## /m.test(content)) {
    const parts = content.split(/^## (.+)$/m);
    passages = [];
    for (let i = 1; i < parts.length; i += 2) {
      passages.push({ name: parts[i].trim(), body: parts[i + 1] || '' });
    }
  } else {
    passages = [{ name: '阅读', body: content }];
  }

  for (const passage of passages) {
    const blocks = passage.body.split(/(?:^|\n)(\d+)[\)\.、．]\s*/);
    let num = null;
    let stemText = '';
    let stemNum = null;
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      if (/^\d+$/.test(trimmed)) {
        // flush previous question
        if (stemNum !== null) pushReadingQuestion(questions, passage.name, stemNum, stemText);
        stemNum = parseInt(trimmed);
        stemText = '';
        continue;
      }
      // This block is the question body (stem + options)
      stemText += block;
    }
    if (stemNum !== null) pushReadingQuestion(questions, passage.name, stemNum, stemText);
  }
}

function pushReadingQuestion(questions, passageName, num, body) {
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  const stem = lines[0] || '';
  const opts = parseOptions(body);
  if (opts.length === 0) return;
  const answer = findAnswer(opts);
  questions.push({
    id: 'yd_' + num,
    type: 'reading',
    typeName: '阅读',
    passage: passageName,
    number: num,
    stem: stem,
    options: opts,
    answer: answer
  });
}

// --- 通用工具 ---
function parseOptions(text) {
  const opts = [];
  const pat = /^([A-O])[\.\)]\s*(.+)/gm;
  let m;
  while ((m = pat.exec(text)) !== null) {
    const raw = m[2].trim();
    const { answer, display } = extractZhAnswer(raw);
    opts.push({
      letter: m[1],
      text: display,
      zh: answer
    });
  }
  return opts;
}

function extractZhAnswer(raw) {
  // If text ends with Chinese characters (the translation), that's the answer
  const match = raw.match(/^(.+?)\s+([一-鿿].*)$/);
  if (match) {
    return { answer: match[2], display: match[1] };
  }
  return { answer: '', display: raw };
}

function findAnswer(opts) {
  // The option with zh (Chinese translation) is the correct answer
  const ans = opts.find(o => o.zh);
  return ans ? ans.letter : '';
}

// --- 单选题（题号+题干+选项+独立答案行）---
// 格式：
//   1. 题干（  ）
//      A. 选项A
//      B. 选项B
//      C. 选项C
//      D. 选项D
//      答案：D
function parseSingleChoice(content, questions) {
  const lines = content.split('\n');
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // 题号行：1. / 1、 / 1． 后接题干
    const qMatch = line.match(/^(\d+)[\.、．]\s*(.+)/);
    if (qMatch) {
      if (cur && cur.options.length > 0) questions.push(cur);
      cur = {
        id: 'dx_' + qMatch[1],
        type: 'reading',
        typeName: '单选题',
        number: parseInt(qMatch[1]),
        stem: qMatch[2].trim(),
        options: [],
        answer: ''
      };
      continue;
    }
    if (!cur) continue;
    // 答案行：答案：D / 答案:D / 正确答案：D
    const ansMatch = line.match(/^(?:正确)?答案[：:]\s*([A-O])/);
    if (ansMatch) {
      cur.answer = ansMatch[1];
      continue;
    }
    // 选项行：A. / A) / A、 后接文本
    const oMatch = line.match(/^([A-O])[\.\)、．]\s*(.+)/);
    if (oMatch) {
      cur.options.push({ letter: oMatch[1], text: oMatch[2].trim(), zh: '' });
    } else {
      // 题干跨行：追加到 stem
      cur.stem += line;
    }
  }
  if (cur && cur.options.length > 0) questions.push(cur);
}

// --- 类型分派 ---
function parseByType(type, content, questions) {
  if (type === 'listening') parseListening(content, questions);
  else if (type === 'matching') parseMatching(content, questions);
  else if (type === 'fillblank') parseFillBlank(content, questions);
  else if (type === 'reading') parseReading(content, questions);
  else if (type === 'singleChoice') parseSingleChoice(content, questions);
}

// --- 自动检测题型（无 # 标题时）---
function autoDetectAndParse(text, questions) {
  // 特征：
  //  - 选词填空：含 __X) word__ 或 _+X) word_+ NUM) 标记
  //  - 段落匹配：含 Passage + 字母段落 + "Question stem (X)"
  //  - 阅读：含 NUMBER) Question + A./B./C./D. 选项
  //  - 听力：含 NUMBER. + A./B./C./D. 选项（无题干）

  // 选词填空：检测 __LETTER) 或 _+LETTER) 模式
  if (/_+\s*[A-O][\)\.]\s*\S+/.test(text) && /\d{2}[\)\.]/.test(text)) {
    parseFillBlank(text, questions);
    return;
  }

  // 段落匹配：检测段落字母标记 + "(X)" 答案标记
  if (/\(([A-H])\)/.test(text) && /[A-H][\.\)]\s*.{20,}/.test(text)) {
    parseMatching(text, questions);
    return;
  }

  // 单选题：题号+题干 + ABCD 选项（答案行可选）
  if (/^\d+[\.、．]\s*.+/m.test(text) && /^\s*[A-O][\.\)、．]\s*\S+/m.test(text)) {
    parseSingleChoice(text, questions);
    return;
  }

  // 阅读：题号 + ) + 选项（题干是问句）
  if (/\d{2}[\)]\s*.+\?/.test(text) || /\d{2}[\)]\s*.+/.test(text)) {
    parseReading(text, questions);
    return;
  }

  // 默认当听力处理（编号 + 选项，无题干）
  parseListening(text, questions);
}
