// POST /api/friends/request — send a friend request
export async function onRequest(context) {
  const { request, env } = context;
  const user = context.locals.user;

  if (!user) {
    return new Response(JSON.stringify({ message: '请先登录' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { target_user_id } = await request.json();

    if (!target_user_id || target_user_id === user.id) {
      return new Response(JSON.stringify({ message: '无效的目标用户' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check target user exists
    const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(target_user_id).first();
    if (!target) {
      return new Response(JSON.stringify({ message: '目标用户不存在' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if already friends or request already sent
    const existing = await env.DB.prepare(
      "SELECT status FROM friends WHERE user_id = ? AND friend_id = ?"
    ).bind(user.id, target_user_id).first();

    if (existing) {
      if (existing.status === 'accepted') {
        return new Response(JSON.stringify({ message: '已经是好友' }), {
          status: 409, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (existing.status === 'pending') {
        return new Response(JSON.stringify({ message: '已发送过请求' }), {
          status: 409, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if the other side already sent a request — if so, auto-accept
    const reverse = await env.DB.prepare(
      "SELECT status FROM friends WHERE user_id = ? AND friend_id = ?"
    ).bind(target_user_id, user.id).first();

    if (reverse && reverse.status === 'pending') {
      // Auto-accept: update reverse to accepted, insert forward as accepted
      await env.DB.prepare(
        "UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?"
      ).bind(target_user_id, user.id).run();
      await env.DB.prepare(
        "INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')"
      ).bind(user.id, target_user_id).run();
      return new Response(JSON.stringify({ ok: true, auto_accepted: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send new request
    await env.DB.prepare(
      "INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'pending')"
    ).bind(user.id, target_user_id).run();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: '发送请求失败: ' + e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
