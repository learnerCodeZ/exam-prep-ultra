// POST /api/auth/register
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email, password, nickname } = await request.json();

    // Validation
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ message: '邮箱格式不正确' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ message: '密码至少 6 位' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!nickname || nickname.trim().length === 0) {
      return new Response(JSON.stringify({ message: '昵称不能为空' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check duplicate email
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ message: '该邮箱已注册' }), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Hash password with PBKDF2
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = btoa(String.fromCharCode(...saltBytes));

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    const passwordHash = salt + ':' + hash;

    // Insert user
    const result = await env.DB.prepare(
      'INSERT INTO users (email, password, nickname) VALUES (?, ?, ?)'
    ).bind(email, passwordHash, nickname.trim()).run();

    const userId = result.meta.last_row_id;

    // Auto-friend with all admin users
    const admins = await env.DB.prepare(
      "SELECT id FROM users WHERE role = 'admin'"
    ).all();

    for (const admin of (admins.results || [])) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')"
      ).bind(userId, admin.id).run();
      await env.DB.prepare(
        "INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')"
      ).bind(admin.id, userId).run();
    }

    // Create session
    const token = crypto.randomUUID();
    await env.SESSION.put(token, String(userId), { expirationTtl: 604800 }); // 7 days

    const user = { id: userId, email, nickname, role: 'user' };

    return new Response(JSON.stringify({ user }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `session_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: '注册失败: ' + e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
