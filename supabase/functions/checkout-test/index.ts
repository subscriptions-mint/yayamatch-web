// Test mode only (no PayMongo key set, or a shared sample sign-in): marks the caller's pending purchase as paid so staging can be walked end to end.
import { cors, db, expiryFor, getUser, json, profileOf } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'not signed in' }, 401);
    const profile = await profileOf(user.id);
    if (Deno.env.get('PAYMONGO_SECRET_KEY') && !profile?.demo_login) return json({ error: 'test mode is off: real payments are on' }, 403);
    const { purchase_id, method } = await req.json().catch(() => ({}));
    if (typeof purchase_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(purchase_id)) return json({ error: 'missing purchase' }, 400);
    const rows = await db(`purchases?id=eq.${purchase_id}&user_id=eq.${user.id}&select=*`, { method: 'GET' });
    const p = rows?.[0];
    if (!p) return json({ error: 'not found' }, 404);
    if (p.provider !== 'test') return json({ error: 'not a test purchase' }, 403);
    if (p.status === 'paid') return json({ status: 'paid', expires_at: p.expires_at });
    const expires = expiryFor(p.item);
    await db(`purchases?id=eq.${p.id}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString(), expires_at: expires, method: typeof method === 'string' ? method.slice(0, 20) : 'test' }),
    });
    return json({ status: 'paid', expires_at: expires, test: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
