// GET /api/auth/me
export async function onRequest(context) {
  const user = context.locals.user || null;

  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
