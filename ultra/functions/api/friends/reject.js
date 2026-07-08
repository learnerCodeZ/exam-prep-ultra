// POST /api/friends/reject — reject a friend request
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

    // Update status to rejected
    await env.DB.prepare(
      "UPDATE friends SET status = 'rejected' WHERE user_id = ? AND friend_id = ? AND status = 'pending'"
    ).bind(friend_id, user.id).run();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: '拒绝请求失败: ' + e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
