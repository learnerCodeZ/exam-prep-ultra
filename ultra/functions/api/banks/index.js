// GET /api/banks — list visible banks
// POST /api/banks — create a new bank
export async function onRequest(context) {
  const { request, env } = context;
  const user = context.locals.user;

  if (request.method === 'GET') {
    return listBanks(env, user);
  }

  if (request.method === 'POST') {
    if (!user) {
      return new Response(JSON.stringify({ message: '请先登录' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    return createBank(request, env, user);
  }

  return new Response(JSON.stringify({ message: 'Method not allowed' }), {
    status: 405, headers: { 'Content-Type': 'application/json' },
  });
}

async function listBanks(env, user) {
  try {
    let results;

    if (!user) {
      // Unauthenticated: only default banks
      results = await env.DB.prepare(
        'SELECT id, owner_id, name, is_default, is_public, created_at, updated_at FROM banks WHERE is_default = 1'
      ).all();
    } else {
      // Authenticated: default + public + own + friends' private
      // Get friend IDs
      const friends = await env.DB.prepare(
        "SELECT friend_id FROM friends WHERE user_id = ? AND status = 'accepted' UNION SELECT user_id FROM friends WHERE friend_id = ? AND status = 'accepted'"
      ).bind(user.id, user.id).all();

      const friendIds = (friends.results || []).map(f => f.friend_id || f.user_id);

      if (friendIds.length > 0) {
        const placeholders = friendIds.map(() => '?').join(',');
        results = await env.DB.prepare(
          `SELECT id, owner_id, name, is_default, is_public, created_at, updated_at FROM banks
           WHERE is_default = 1 OR is_public = 1 OR owner_id = ?
           OR (is_public = 0 AND owner_id IN (${placeholders}))`
        ).bind(user.id, ...friendIds).all();
      } else {
        results = await env.DB.prepare(
          `SELECT id, owner_id, name, is_default, is_public, created_at, updated_at FROM banks
           WHERE is_default = 1 OR is_public = 1 OR owner_id = ?`
        ).bind(user.id).all();
      }
    }

    return new Response(JSON.stringify({ banks: results.results || [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: '获取题库列表失败: ' + e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function createBank(request, env, user) {
  try {
    const { name, is_public, questions } = await request.json();

    if (!name || name.trim().length === 0) {
      return new Response(JSON.stringify({ message: '题库名称不能为空' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Insert bank metadata
    const kvKey = `banks/${user.id}/temp.json`; // placeholder, will update after we get the bank ID
    const result = await env.DB.prepare(
      'INSERT INTO banks (owner_id, name, is_public, kv_key) VALUES (?, ?, ?, ?)'
    ).bind(user.id, name.trim(), is_public !== false ? 1 : 0, kvKey).run();

    const bankId = result.meta.last_row_id;

    // Update kv_key with actual bank ID
    const finalKvKey = `banks/${user.id}/${bankId}.json`;
    await env.DB.prepare(
      'UPDATE banks SET kv_key = ? WHERE id = ?'
    ).bind(finalKvKey, bankId).run();

    // Write questions to KV
    if (questions && Array.isArray(questions)) {
      await env.QUESTIONS.put(finalKvKey, JSON.stringify(questions));
    } else {
      await env.QUESTIONS.put(finalKvKey, JSON.stringify([]));
    }

    const bank = {
      id: bankId,
      owner_id: user.id,
      name: name.trim(),
      is_default: 0,
      is_public: is_public !== false ? 1 : 0,
      r2_key: finalKvKey,
    };

    return new Response(JSON.stringify({ bank }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: '创建题库失败: ' + e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
