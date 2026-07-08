// GET    /api/admin/users — list all users (admin only)
// DELETE /api/admin/users — delete a user (admin only, via body)
// PUT    /api/admin/users — approve/reject password reset request (admin only)
// GET    /api/admin/users?action=reset-requests — list password reset requests (admin only)
export async function onRequest(context) {
  const { request, env } = context;
  const user = context.locals.user;

  if (!user || user.role !== 'admin') {
    return new Response(JSON.stringify({ message: '需要管理员权限' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);

  // GET: 列出用户 或 列出密码重置请求
  if (request.method === 'GET') {
    // 列出密码重置请求
    if (url.searchParams.get('action') === 'reset-requests') {
      try {
        const results = await env.DB.prepare(
          `SELECT pr.id, pr.user_id, pr.status, pr.created_at, u.email, u.nickname
           FROM password_resets pr JOIN users u ON pr.user_id = u.id
           ORDER BY pr.created_at DESC`
        ).all();

        return new Response(JSON.stringify({ requests: results.results || [] }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ message: '获取列表失败: ' + e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 列出用户（原有功能）
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

  // PUT: 审批密码重置请求
  if (request.method === 'PUT') {
    try {
      const { request_id, action } = await request.json();

      if (!request_id || !['approve', 'reject'].includes(action)) {
        return new Response(JSON.stringify({ message: '无效参数' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }

      const resetReq = await env.DB.prepare(
        "SELECT id, user_id, status FROM password_resets WHERE id = ?"
      ).bind(request_id).first();

      if (!resetReq) {
        return new Response(JSON.stringify({ message: '请求不存在' }), {
          status: 404, headers: { 'Content-Type': 'application/json' },
        });
      }

      if (resetReq.status !== 'pending') {
        return new Response(JSON.stringify({ message: '该请求已处理' }), {
          status: 409, headers: { 'Content-Type': 'application/json' },
        });
      }

      if (action === 'approve') {
        const newPassword = '123456';
        const saltBytes = crypto.getRandomValues(new Uint8Array(16));
        const salt = btoa(String.fromCharCode(...saltBytes));

        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
          'raw', encoder.encode(newPassword), 'PBKDF2', false, ['deriveBits']
        );
        const hashBuffer = await crypto.subtle.deriveBits(
          { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
          keyMaterial, 256
        );
        const hash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
        const passwordHash = salt + ':' + hash;

        await env.DB.prepare(
          'UPDATE users SET password = ? WHERE id = ?'
        ).bind(passwordHash, resetReq.user_id).run();

        await env.DB.prepare(
          "UPDATE password_resets SET status = 'approved' WHERE id = ?"
        ).bind(request_id).run();

        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }

      if (action === 'reject') {
        await env.DB.prepare(
          "UPDATE password_resets SET status = 'rejected' WHERE id = ?"
        ).bind(request_id).run();

        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ message: '操作失败: ' + e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // DELETE: 删除用户（原有功能）
  if (request.method === 'DELETE') {
    try {
      const { user_id } = await request.json();

      if (!user_id || user_id === user.id) {
        return new Response(JSON.stringify({ message: '不能删除自己' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }

      const banks = await env.DB.prepare(
        'SELECT kv_key FROM banks WHERE owner_id = ?'
      ).bind(user_id).all();

      for (const b of (banks.results || [])) {
        await env.QUESTIONS.delete(b.kv_key);
      }

      await env.DB.prepare('DELETE FROM banks WHERE owner_id = ?').bind(user_id).run();
      await env.DB.prepare('DELETE FROM friends WHERE user_id = ? OR friend_id = ?').bind(user_id, user_id).run();
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
