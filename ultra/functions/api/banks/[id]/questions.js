// GET /api/banks/:id/questions — fetch questions from R2
// PUT /api/banks/:id/questions — replace questions in R2 (owner only)
export async function onRequest(context) {
  const { request, env, params } = context;
  const user = context.locals.user;
  const bankId = parseInt(params.id);

  if (isNaN(bankId)) {
    return new Response(JSON.stringify({ message: '无效的题库 ID' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Load bank
  const bank = await env.DB.prepare(
    'SELECT id, owner_id, is_default, is_public, kv_key FROM banks WHERE id = ?'
  ).bind(bankId).first();

  if (!bank) {
    return new Response(JSON.stringify({ message: '题库不存在' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Visibility check
  const isVisible = bank.is_default === 1 || bank.is_public === 1 ||
    (user && bank.owner_id === user.id) || (user && await isFriend(env, user.id, bank.owner_id));

  if (!isVisible) {
    return new Response(JSON.stringify({ message: '无权访问该题库' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'GET') {
    try {
      const questionsStr = await env.QUESTIONS.get(bank.kv_key);
      const questions = questionsStr ? JSON.parse(questionsStr) : [];
      return new Response(JSON.stringify({ questions }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: '读取题目失败: ' + e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.method === 'PUT') {
    // Owner only
    if (!user || bank.owner_id !== user.id) {
      return new Response(JSON.stringify({ message: '无权修改该题库' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }
    try {
      const { questions } = await request.json();
      await env.QUESTIONS.put(bank.kv_key, JSON.stringify(questions || []));
      await env.DB.prepare(
        "UPDATE banks SET updated_at = datetime('now') WHERE id = ?"
      ).bind(bankId).run();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: '保存题目失败: ' + e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ message: 'Method not allowed' }), {
    status: 405, headers: { 'Content-Type': 'application/json' },
  });
}

async function isFriend(env, userId, otherId) {
  if (userId === otherId) return true;
  const row = await env.DB.prepare(
    "SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'accepted'"
  ).bind(userId, otherId).first();
  return !!row;
}
