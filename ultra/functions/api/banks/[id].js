// GET /api/banks/:id — bank metadata
// PUT /api/banks/:id — update name/is_public (owner only)
// DELETE /api/banks/:id — delete (owner only)
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
    'SELECT id, owner_id, name, is_default, is_public, kv_key, created_at, updated_at FROM banks WHERE id = ?'
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
    return new Response(JSON.stringify({
      bank: {
        id: bank.id, owner_id: bank.owner_id, name: bank.name,
        is_default: bank.is_default, is_public: bank.is_public,
        r2_key: bank.kv_key, created_at: bank.created_at, updated_at: bank.updated_at,
        is_owner: !!(user && bank.owner_id === user.id),
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // PUT / DELETE require ownership
  if (!user || bank.owner_id !== user.id) {
    return new Response(JSON.stringify({ message: '无权修改该题库' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (bank.is_default === 1) {
    return new Response(JSON.stringify({ message: '默认题库不可修改/删除' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'PUT') {
    try {
      const { name, is_public } = await request.json();
      const updates = [];
      const values = [];
      if (name !== undefined && name.trim().length > 0) {
        updates.push('name = ?'); values.push(name.trim());
      }
      if (is_public !== undefined) {
        updates.push('is_public = ?'); values.push(is_public ? 1 : 0);
      }
      updates.push("updated_at = datetime('now')");
      values.push(bankId);

      await env.DB.prepare(`UPDATE banks SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: '更新失败: ' + e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.method === 'DELETE') {
    try {
      await env.DB.prepare('DELETE FROM banks WHERE id = ?').bind(bankId).run();
      await env.QUESTIONS.delete(bank.kv_key);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: '删除失败: ' + e.message }), {
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
