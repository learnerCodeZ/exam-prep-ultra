// GET /api/admin/banks — list all banks (admin only)
export async function onRequest(context) {
  const { env } = context;
  const user = context.locals.user;

  if (!user || user.role !== 'admin') {
    return new Response(JSON.stringify({ message: '需要管理员权限' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const results = await env.DB.prepare(
      'SELECT b.id, b.owner_id, u.nickname as owner_name, b.name, b.is_default, b.is_public, b.created_at, b.updated_at FROM banks b JOIN users u ON b.owner_id = u.id ORDER BY b.id'
    ).all();

    return new Response(JSON.stringify({ banks: results.results || [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: '获取题库列表失败: ' + e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
