// POST /api/friends/accept — accept a friend request
export async function onRequest(context) {
  const { request, env } = context;
  const user = context.locals.user;

  if (!user) {
    return new Response(JSON.stringify({ message: '请先登录' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { friend_id } = await request.json();

    if (!friend_id) {
      return new Response(JSON.stringify({ message: '无效参数' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify pending request exists (they sent to me)
    const req = await env.DB.prepare(
      "SELECT status FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'"
    ).bind(friend_id, user.id).first();

    if (!req) {
      return new Response(JSON.stringify({ message: '没有待处理的好友请求' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update to accepted
    await env.DB.prepare(
      "UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?"
    ).bind(friend_id, user.id).run();

    // Insert reciprocal accepted row
    await env.DB.prepare(
      "INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')"
    ).bind(user.id, friend_id).run();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: '接受请求失败: ' + e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
