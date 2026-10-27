// 期末刷题宝典 — Python 判题 Worker
// 在 Web Worker 中运行 Pyodide，避免阻塞页面；turtle 用命令记录 + 主线程画布渲染

let pyodide = null;
let loadPromise = null;

const PYODIDE_VERSION = '0.27.7';
const CDN_BASE = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/';

function localBase() {
  return new URL('../lib/pyodide/', self.location.href).href;
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // 优先用本地（下载文件夹挂载到 lib/pyodide），失败再走 CDN
    const bases = [localBase(), CDN_BASE];
    let lastErr = null;
    for (const base of bases) {
      try {
        importScripts(base + 'pyodide.js');
        pyodide = await loadPyodide({ indexURL: base });
        return pyodide;
      } catch (e) {
        pyodide = null;
        lastErr = e;
      }
    }
    throw lastErr || new Error('Pyodide 加载失败');
  })();
  return loadPromise;
}

// turtle 兼容层：记录绘图命令，供主线程回放
const TURTLE_SHIM = `
import sys, types, math

__turtle_cmds__ = []
_turtle_mod = types.ModuleType('turtle')

def _color(v):
    if isinstance(v, (tuple, list)):
        return '#%02x%02x%02x' % tuple(int(x) for x in v[:3])
    return str(v)

class _Screen:
    def mainloop(self, *a, **k): pass
    def exitonclick(self, *a, **k): pass
    def setup(self, *a, **k): pass
    def bgcolor(self, *a, **k): pass
    def title(self, *a, **k): pass
    def tracer(self, *a, **k): pass
    def update(self, *a, **k): pass
    def bye(self, *a, **k): pass

_screen = _Screen()

class Turtle:
    def __init__(self, *a, **k):
        self._x = 0.0
        self._y = 0.0
        self._h = 0.0
        self._pen = True
        self._size = 1
        self._color = 'black'
        self._fillcolor = 'black'
        self._fill = False
        __turtle_cmds__.append({'op': 'init'})

    @property
    def screen(self):
        return _screen

    def _emit(self, op, **extra):
        cmd = {
            'op': op, 'x': self._x, 'y': self._y, 'h': self._h,
            'pen': self._pen, 'size': self._size, 'color': self._color,
        }
        cmd.update(extra)
        __turtle_cmds__.append(cmd)

    def goto(self, x, y=None):
        if y is None:
            x, y = x[0], x[1]
        self._x = float(x)
        self._y = float(y)
        self._emit('goto')
    setpos = goto
    setposition = goto

    def fd(self, d):
        self._x += float(d) * math.cos(math.radians(self._h))
        self._y += float(d) * math.sin(math.radians(self._h))
        self._emit('goto')
    forward = fd

    def bk(self, d):
        self.fd(-d)
    back = bk
    backward = bk

    def circle(self, r, extent=None, steps=None):
        r = float(r)
        ext = 360.0 if extent is None else float(extent)
        __turtle_cmds__.append({
            'op': 'circle', 'r': r, 'extent': ext,
            'x': self._x, 'y': self._y, 'h': self._h,
            'pen': self._pen, 'size': self._size, 'color': self._color,
            'fill': self._fill, 'fillcolor': self._fillcolor,
        })
        # 推进到圆弧终点（与 turtle 的语义一致）
        cx = self._x + r * math.cos(math.radians(self._h + 90))
        cy = self._y + r * math.sin(math.radians(self._h + 90))
        phi0 = math.atan2(self._y - cy, self._x - cx)
        sign = 1.0 if r >= 0 else -1.0
        phi1 = phi0 + sign * math.radians(ext)
        self._x = cx + abs(r) * math.cos(phi1)
        self._y = cy + abs(r) * math.sin(phi1)
        self._h += sign * ext

    def seth(self, a):
        self._h = float(a)
        self._emit('heading')
    setheading = seth

    def heading(self):
        return self._h

    def left(self, a):
        self._h += float(a)
        self._emit('heading')
    lt = left

    def right(self, a):
        self._h -= float(a)
        self._emit('heading')
    rt = right

    def penup(self):
        self._pen = False
        self._emit('pen')
    pu = penup
    up = penup

    def pendown(self):
        self._pen = True
        self._emit('pen')
    pd = pendown
    down = pendown

    def pensize(self, *a):
        if a:
            self._size = float(a[0])
            self._emit('pensize')
        return self._size
    width = pensize

    def pencolor(self, *a):
        if a:
            v = a[0] if len(a) == 1 else tuple(a[:3])
            self._color = _color(v)
            self._emit('color')
        return self._color

    def fillcolor(self, *a):
        if a:
            v = a[0] if len(a) == 1 else tuple(a[:3])
            self._fillcolor = _color(v)
            self._emit('fillcolor')
        return self._fillcolor

    def color(self, *a):
        if len(a) == 1:
            self.pencolor(a[0])
            self.fillcolor(a[0])
        elif len(a) == 2:
            self.pencolor(a[0])
            self.fillcolor(a[1])
        elif len(a) >= 3:
            self.pencolor(tuple(a[:3]))
            self.fillcolor(tuple(a[:3]))
        return self._color

    def begin_fill(self):
        self._fill = True
        self._emit('fillstart', fillcolor=self._fillcolor)

    def end_fill(self):
        self._fill = False
        self._emit('fillend')

    def speed(self, *a): pass
    def hideturtle(self): pass
    ht = hideturtle
    def showturtle(self): pass
    st = showturtle
    def write(self, *a, **k): pass
    def dot(self, *a, **k): pass
    def shape(self, *a, **k): pass
    def reset(self): pass
    def clear(self): pass

_turtle_mod.Turtle = Turtle
_turtle_mod.Screen = _Screen
_turtle_mod.mainloop = lambda *a, **k: None
_turtle_mod.done = lambda *a, **k: None
_turtle_mod.exitonclick = lambda *a, **k: None
_turtle_mod.setup = lambda *a, **k: None
_turtle_mod.bgcolor = lambda *a, **k: None
_turtle_mod.title = lambda *a, **k: None
_turtle_mod.speed = lambda *a, **k: None
_turtle_mod.colormode = lambda *a, **k: None
_turtle_mod.tracer = lambda *a, **k: None
_turtle_mod.update = lambda *a, **k: None
_turtle_mod.hideturtle = lambda *a, **k: None
_turtle_mod.showturtle = lambda *a, **k: None
_turtle_mod.bye = lambda *a, **k: None
_turtle_mod.reset = lambda *a, **k: None
_turtle_mod.clear = lambda *a, **k: None

_default = Turtle()
_turtle_mod.forward = _default.fd
_turtle_mod.fd = _default.fd
_turtle_mod.backward = _default.bk
_turtle_mod.back = _default.bk
_turtle_mod.bk = _default.bk
_turtle_mod.right = _default.right
_turtle_mod.rt = _default.right
_turtle_mod.left = _default.left
_turtle_mod.lt = _default.left
_turtle_mod.goto = _default.goto
_turtle_mod.setpos = _default.goto
_turtle_mod.setposition = _default.goto
_turtle_mod.circle = _default.circle
_turtle_mod.penup = _default.penup
_turtle_mod.pu = _default.penup
_turtle_mod.up = _default.penup
_turtle_mod.pendown = _default.pendown
_turtle_mod.pd = _default.pendown
_turtle_mod.down = _default.pendown
_turtle_mod.pensize = _default.pensize
_turtle_mod.width = _default.pensize
_turtle_mod.pencolor = _default.pencolor
_turtle_mod.fillcolor = _default.fillcolor
_turtle_mod.color = _default.color
_turtle_mod.begin_fill = _default.begin_fill
_turtle_mod.end_fill = _default.end_fill
_turtle_mod.seth = _default.seth
_turtle_mod.setheading = _default.seth
_turtle_mod.heading = _default.heading

sys.modules['turtle'] = _turtle_mod
`;

self.onmessage = async (ev) => {
  const msg = ev.data || {};

  if (msg.type === 'load') {
    try {
      await ensurePyodide();
      self.postMessage({ type: 'ready' });
    } catch (e) {
      self.postMessage({ type: 'load-error', error: String((e && e.message) || e) });
    }
    return;
  }

  if (msg.type !== 'run') return;

  const { id, code, stdin, turtle, files, readFiles } = msg;
  let baseDir = null;
  let workDir = null;
  try {
    await ensurePyodide();

    let out = '';
    let err = '';
    pyodide.setStdout({ batched: (s) => { out += s + '\n'; } });
    pyodide.setStderr({ batched: (s) => { err += s + '\n'; } });

    const lines = String(stdin == null ? '' : stdin).split('\n');
    // 末尾换行会产生一个空行，去掉
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    let li = 0;
    pyodide.setStdin({
      stdin: () => (li < lines.length ? lines[li++] + '\n' : null),
    });

    baseDir = pyodide.FS.cwd();
    const fileList = files && typeof files === 'object' ? Object.keys(files) : [];
    const readList = Array.isArray(readFiles) ? readFiles : [];
    if (fileList.length || readList.length) {
      workDir = '/tmp/prog_' + id + '_' + Date.now();
      pyodide.FS.mkdirTree(workDir);
      pyodide.FS.chdir(workDir);
      for (const name of fileList) {
        pyodide.FS.writeFile(workDir + '/' + name, String(files[name]));
      }
    }

    if (turtle) {
      pyodide.runPython(TURTLE_SHIM);
      pyodide.runPython('__turtle_cmds__ = []');
    }

    const globals = pyodide.toPy({ __name__: '__main__' });
    let error = null;
    try {
      await pyodide.runPythonAsync(code, { globals });
    } catch (e) {
      error = String((e && e.message) || e);
      if (error.length > 4000) error = error.slice(0, 4000) + '...';
    } finally {
      try { globals.destroy(); } catch (e) {}
    }

    let cmds = [];
    if (turtle) {
      try {
        cmds = JSON.parse(pyodide.runPython('import json; json.dumps(__turtle_cmds__)'));
      } catch (e) {}
    }

    const fileContents = {};
    for (const name of readList) {
      try {
        fileContents[name] = pyodide.FS.readFile(workDir + '/' + name, { encoding: 'utf8' });
      } catch (e) {
        fileContents[name] = null;
      }
    }

    self.postMessage({ id, type: 'result', stdout: out, stderr: err, error, turtle: cmds, files: fileContents });
  } catch (e) {
    self.postMessage({
      id, type: 'result', stdout: '', stderr: '',
      error: '运行环境加载失败：' + String((e && e.message) || e), turtle: [], files: {},
    });
  } finally {
    if (workDir && pyodide) {
      try { pyodide.FS.chdir(baseDir || '/home/pyodide'); } catch (e) {}
      try {
        pyodide.runPython('import shutil; shutil.rmtree(' + JSON.stringify(workDir) + ', ignore_errors=True)');
      } catch (e) {}
    }
  }
};
