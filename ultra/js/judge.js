// 期末刷题宝典 — 判题服务（主线程侧）
// 与 judge-worker.js 通信；首次运行会加载 Pyodide（本地优先，CDN 兜底）

const Judge = {
  worker: null,
  ready: false,
  seq: 0,
  pending: null,
  starting: null,
  _resolveReady: null,
  _rejectReady: null,

  reset() {
    if (this.worker) {
      try { this.worker.terminate(); } catch (e) {}
    }
    this.worker = null;
    this.ready = false;
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error('运行已终止'));
      this.pending = null;
    }
  },

  spawn() {
    const w = new Worker('js/judge-worker.js');
    w.onmessage = (ev) => this.onMessage(ev.data || {});
    w.onerror = (e) => {
      const err = new Error('判题 Worker 出错：' + (e.message || '未知错误'));
      if (this._rejectReady) this._rejectReady(err);
      if (this.pending) {
        clearTimeout(this.pending.timer);
        this.pending.reject(err);
        this.pending = null;
      }
    };
    this.worker = w;
    return w;
  },

  async ensure() {
    if (this.ready && this.worker) return;
    if (this.starting) return this.starting;

    this.starting = new Promise((resolve, reject) => {
      const w = this.spawn();
      const timer = setTimeout(() => {
        this.reset();
        reject(new Error('Python 运行环境加载超时，请检查网络或 lib/pyodide 是否就绪'));
      }, 120000);
      this._resolveReady = () => { clearTimeout(timer); resolve(); };
      this._rejectReady = (err) => { clearTimeout(timer); reject(err); };
      w.postMessage({ type: 'load' });
    });

    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  },

  onMessage(msg) {
    if (msg.type === 'ready') {
      this.ready = true;
      if (this._resolveReady) { this._resolveReady(); this._resolveReady = null; this._rejectReady = null; }
      return;
    }
    if (msg.type === 'load-error') {
      const err = new Error('Python 运行环境加载失败：' + msg.error);
      if (this._rejectReady) { this._rejectReady(err); this._resolveReady = null; this._rejectReady = null; }
      this.reset();
      return;
    }
    if (msg.type === 'result' && this.pending && msg.id === this.pending.id) {
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      p.resolve(msg);
    }
  },

  async run({ code, stdin, turtle, files, readFiles }) {
    await this.ensure();
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      const timer = setTimeout(() => {
        this.pending = null;
        this.reset();
        reject(new Error('运行超时（可能是死循环），已终止'));
      }, 15000);
      this.pending = { id, resolve, reject, timer };
      this.worker.postMessage({ type: 'run', id, code, stdin, turtle: !!turtle, files, readFiles });
    });
  },
};
