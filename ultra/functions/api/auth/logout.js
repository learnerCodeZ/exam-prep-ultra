// POST /api/auth/logout
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Delete session from KV
  const cookie = request.headers.get('Cookie') || '';
  const tokenMatch = cookie.match(/session_token=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  if (token) {
    await env.SESSION.delete(token);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    },
  });
}
