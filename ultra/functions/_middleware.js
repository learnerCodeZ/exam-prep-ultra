export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Public endpoints never need auth
  const publicPaths = ['/api/auth/register', '/api/auth/login'];
  const isPublicApi = publicPaths.some(p => url.pathname === p);
  const isStaticAsset = !url.pathname.startsWith('/api/');

  // POST /api/auth/me 是找回密码请求，公开接口
  if (url.pathname === '/api/auth/me' && request.method === 'POST') {
    return next();
  }

  if (isStaticAsset || isPublicApi) {
    return next();
  }

  // Check session from cookie
  const cookie = request.headers.get('Cookie') || '';
  const tokenMatch = cookie.match(/session_token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  if (token) {
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

  return next();
}
