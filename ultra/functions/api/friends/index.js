// GET /api/friends — list friends and pending requests
export async function onRequest(context) {
  const user = context.locals.user;

  if (!user) {
    return new Response(JSON.stringify({ message: '请先登录' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { env } = context;

  try {
    // Accepted friends (both directions)
    const sent = await env.DB.prepare(
      "SELECT u.id, u.nickname, u.email FROM friends f JOIN users u ON f.friend_id = u.id WHERE f.user_id = ? AND f.status = 'accepted'"
    ).bind(user.id).all();

    const received = await env.DB.prepare(
      "SELECT u.id, u.nickname, u.email FROM friends f JOIN users u ON f.user_id = u.id WHERE f.friend_id = ? AND f.status = 'accepted'"
    ).bind(user.id).all();

    // Deduplicate (both directions may exist)
    const friendMap = new Map();
    for (const f of [...(sent.results || []), ...(received.results || [])]) {
      friendMap.set(f.id, { id: f.id, nickname: f.nickname, email: f.email });
    }

    // Pending requests received (others sent to me)
    const pending = await env.DB.prepare(
      "SELECT u.id, u.nickname, u.email, f.created_at FROM friends f JOIN users u ON f.user_id = u.id WHERE f.friend_id = ? AND f.status = 'pending'"
    ).bind(user.id).all();

    return new Response(JSON.stringify({
      friends: Array.from(friendMap.values()),
      pending: (pending.results || []).map(p => ({
        id: p.id, nickname: p.nickname, email: p.email, requested_at: p.created_at,
      })),
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: '获取好友列表失败: ' + e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
