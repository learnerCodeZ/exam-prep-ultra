// GET  /api/auth/me — 获取当前用户信息
// POST /api/auth/me — 提交找回密码请求（公开接口，无需登录）
export async function onRequest(context) {
  const { request, env } = context;

  // POST: 找回密码请求
  if (request.method === 'POST') {
    try {
      const { email } = await request.json();

      if (!email || !email.includes('@')) {
        return new Response(JSON.stringify({ message: '邮箱格式不正确' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }

      const user = await env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(email).first();

      if (!user) {
        return new Response(JSON.stringify({ message: '该邮箱未注册' }), {
          status: 404, headers: { 'Content-Type': 'application/json' },
        });
      }

      const existing = await env.DB.prepare(
        "SELECT id FROM password_resets WHERE user_id = ? AND status = 'pending'"
      ).bind(user.id).first();

      if (existing) {
        return new Response(JSON.stringify({ message: '您已提交过找回请求，请等待管理员审批' }), {
          status: 409, headers: { 'Content-Type': 'application/json' },
        });
      }

      await env.DB.prepare(
        "INSERT INTO password_resets (user_id, status) VALUES (?, 'pending')"
      ).bind(user.id).run();

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: '提交失败: ' + e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // GET: 获取当前用户信息
  const user = context.locals.user || null;
  return new Response(JSON.stringify({ user }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
