// GET /api/admin/users — list all users (admin only)
// DELETE /api/admin/users — delete a user (admin only, via body)
export async function onRequest(context) {
  const { request, env } = context;
  const user = context.locals.user;

  if (!user || user.role !== 'admin') {
    return new Response(JSON.stringify({ message: '需要管理员权限' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'GET') {
    try {
      const results = await env.DB.prepare(
        'SELECT u.id, u.email, u.nickname, u.role, u.created_at, COUNT(b.id) as bank_count FROM users u LEFT JOIN banks b ON u.id = b.owner_id GROUP BY u.id ORDER BY u.id'
      ).all();

      return new Response(JSON.stringify({ users: results.results || [] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: '获取用户列表失败: ' + e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.method === 'DELETE') {
    try {
      const { user_id } = await request.json();

      if (!user_id || user_id === user.id) {
        return new Response(JSON.stringify({ message: '不能删除自己' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }

      // Delete user's banks from KV
      const banks = await env.DB.prepare(
        'SELECT kv_key FROM banks WHERE owner_id = ?'
      ).bind(user_id).all();

      for (const b of (banks.results || [])) {
        await env.QUESTIONS.delete(b.kv_key);
      }

      // Delete user's banks from D1
      await env.DB.prepare('DELETE FROM banks WHERE owner_id = ?').bind(user_id).run();

      // Delete friend relations
      await env.DB.prepare('DELETE FROM friends WHERE user_id = ? OR friend_id = ?').bind(user_id, user_id).run();

      // Delete user
      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user_id).run();

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: '删除用户失败: ' + e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ message: 'Method not allowed' }), {
    status: 405, headers: { 'Content-Type': 'application/json' },
  });
}
