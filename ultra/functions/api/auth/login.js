// POST /api/auth/login
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ message: '邮箱和密码不能为空' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find user
    const user = await env.DB.prepare(
      'SELECT id, email, nickname, role, password FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({ message: '邮箱或密码错误' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify password
    const [saltB64, storedHash] = user.password.split(':');
    const saltBytes = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    const computedHash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

    if (computedHash !== storedHash) {
      return new Response(JSON.stringify({ message: '邮箱或密码错误' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create session
    const token = crypto.randomUUID();
    await env.SESSION.put(token, String(user.id), { expirationTtl: 604800 });

    const userInfo = { id: user.id, email: user.email, nickname: user.nickname, role: user.role };

    return new Response(JSON.stringify({ user: userInfo }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `session_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: '登录失败: ' + e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
