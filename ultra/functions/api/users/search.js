// GET /api/users/search?q=keyword
export async function onRequest(context) {
  const { request, env } = context;
  const user = context.locals.user;

  if (!user) {
    return new Response(JSON.stringify({ message: '请先登录' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';

  if (q.trim().length === 0) {
    return new Response(JSON.stringify({ users: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const keyword = '%' + q.trim() + '%';
    const results = await env.DB.prepare(
      'SELECT id, nickname, email FROM users WHERE (nickname LIKE ? OR email LIKE ?) AND id != ? LIMIT 20'
    ).bind(keyword, keyword, user.id).all();

    // For each result, check friendship status with current user
    const users = [];
    for (const u of (results.results || [])) {
      const friendship = await env.DB.prepare(
        "SELECT status FROM friends WHERE user_id = ? AND friend_id = ?"
      ).bind(user.id, u.id).first();
      const reverseFriendship = await env.DB.prepare(
        "SELECT status FROM friends WHERE user_id = ? AND friend_id = ?"
      ).bind(u.id, user.id).first();

      let friendStatus = 'none';
      if (friendship && friendship.status === 'accepted') friendStatus = 'accepted';
      else if (reverseFriendship && reverseFriendship.status === 'accepted') friendStatus = 'accepted';
      else if (friendship && friendship.status === 'pending') friendStatus = 'sent';
      else if (reverseFriendship && reverseFriendship.status === 'pending') friendStatus = 'pending_received';

      users.push({ id: u.id, nickname: u.nickname, email: u.email, friend_status: friendStatus });
    }

    return new Response(JSON.stringify({ users }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: '搜索失败: ' + e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
