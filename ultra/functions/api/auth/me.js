// GET  /api/auth/me — 获取当前用户信息
// POST /api/auth/me — 提交找回密码请求（公开接口，无需登录）
// PUT  /api/auth/me — 修改密码（需登录）
export async function onRequest(context) {
  const { request, env } = context;

  // PUT: 修改密码
  if (request.method === 'PUT') {
    const user = context.locals.user;
    if (!user) {
      return new Response(JSON.stringify({ message: '请先登录' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const { old_password, new_password } = await request.json();

      if (!old_password || !new_password) {
        return new Response(JSON.stringify({ message: '请填写旧密码和新密码' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (new_password.length < 6) {
        return new Response(JSON.stringify({ message: '新密码至少 6 位' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }

      // 取当前密码 hash 并验证旧密码
      const row = await env.DB.prepare(
        'SELECT password FROM users WHERE id = ?'
      ).bind(user.id).first();

      const [saltB64, storedHash] = row.password.split(':');
      const saltBytes = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
      const encoder = new TextEncoder();

      const oldKeyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(old_password), 'PBKDF2', false, ['deriveBits']
      );
      const oldHashBuffer = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
        oldKeyMaterial, 256
      );
      const oldComputedHash = btoa(String.fromCharCode(...new Uint8Array(oldHashBuffer)));

      if (oldComputedHash !== storedHash) {
        return new Response(JSON.stringify({ message: '旧密码错误' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }

      // 哈希新密码
      const newSaltBytes = crypto.getRandomValues(new Uint8Array(16));
      const newSalt = btoa(String.fromCharCode(...newSaltBytes));
      const newKeyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(new_password), 'PBKDF2', false, ['deriveBits']
      );
      const newHashBuffer = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: newSaltBytes, iterations: 100000, hash: 'SHA-256' },
        newKeyMaterial, 256
      );
      const newHash = btoa(String.fromCharCode(...new Uint8Array(newHashBuffer)));
      const newPasswordHash = newSalt + ':' + newHash;

      // 更新密码
      await env.DB.prepare(
        'UPDATE users SET password = ? WHERE id = ?'
      ).bind(newPasswordHash, user.id).run();

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: '修改失败: ' + e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

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
