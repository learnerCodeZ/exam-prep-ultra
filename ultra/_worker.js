// Cloudflare Pages — 统一入口 _worker.js
// 这个文件会替代 functions/ 目录的自动路由，手动处理请求

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 非 API 路径 → 静态资源
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    // API 路由表
    const routes = {
      '/api/auth/register': () => import('./functions/api/auth/register.js'),
      '/api/auth/login': () => import('./functions/api/auth/login.js'),
      '/api/auth/logout': () => import('./functions/api/auth/logout.js'),
      '/api/auth/me': () => import('./functions/api/auth/me.js'),
      '/api/banks': () => import('./functions/api/banks/index.js'),
      '/api/users/search': () => import('./functions/api/users/search.js'),
      '/api/friends': () => import('./functions/api/friends/index.js'),
      '/api/friends/request': () => import('./functions/api/friends/request.js'),
      '/api/friends/accept': () => import('./functions/api/friends/accept.js'),
      '/api/friends/reject': () => import('./functions/api/friends/reject.js'),
      '/api/admin/users': () => import('./functions/api/admin/users.js'),
      '/api/admin/banks': () => import('./functions/api/admin/banks.js'),
    };

    try {
      // 精确匹配
      let handler;
      let params = {};
      const path = url.pathname.replace(/\/+$/, '') || url.pathname;

      if (routes[path]) {
        const mod = await routes[path]();
        handler = mod.onRequest;
      }
      // /api/banks/:id/questions
      else if (path.match(/^\/api\/banks\/\d+\/questions$/)) {
        const mod = await import('./functions/api/banks/[id]/questions.js');
        handler = mod.onRequest;
        params = { id: path.split('/')[3] };
      }
      // /api/banks/:id
      else if (path.match(/^\/api\/banks\/\d+$/)) {
        const mod = await import('./functions/api/banks/[id].js');
        handler = mod.onRequest;
        params = { id: path.split('/')[3] };
      }
      else {
        return new Response(JSON.stringify({ message: 'Not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json' },
        });
      }

      // 构建 Pages Function context
      const context = {
        request,
        env,
        params,
        data: {},
        next: async () => new Response('Not a static request', { status: 500 }),
        locals: { user: null },
        functionPath: path,
      };

      // 运行中间件逻辑（解析 session）
      const cookie = request.headers.get('Cookie') || '';
      const tokenMatch = cookie.match(/session_token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;

      const isPublicApi = ['/api/auth/register', '/api/auth/login'].includes(path);

      if (!isPublicApi && token) {
        try {
          const userIdStr = await env.SESSION.get(token);
          if (userIdStr) {
            const user = await env.DB.prepare(
              'SELECT id, email, nickname, role FROM users WHERE id = ?'
            ).bind(parseInt(userIdStr)).first();
            if (user) {
              context.locals.user = user;
            }
          }
        } catch (e) {
          // Session lookup failed; user stays null
        }
      }

      // 运行 handler
      return await handler(context);
    } catch (e) {
      return new Response(JSON.stringify({
        error: e.message,
        stack: e.stack,
      }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
