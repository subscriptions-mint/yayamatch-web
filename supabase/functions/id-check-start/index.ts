// Starts an ID check. Live: creates a Didit session and returns its hosted URL. Test: no Didit keys yet, so the app runs its own screens.
import { cors, db, getUser, json, profileOf, safeReturn, withParams } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'not signed in' }, 401);
    const body = await req.json().catch(() => ({}));
    const profile = await profileOf(user.id);
    if (!profile?.side) return json({ error: 'pick a side first' }, 400);
    const kind = profile.side === 'family' ? 'household_id' : 'id';

    const apiKey = Deno.env.get('DIDIT_API_KEY');
    const workflow = Deno.env.get('DIDIT_WORKFLOW_ID');
    if (!apiKey || !workflow || profile.demo_login) {
      await db('checks?on_conflict=user_id,kind', {
        method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
        body: JSON.stringify({ user_id: user.id, kind, status: 'pending', vendor: 'test', updated_at: new Date().toISOString() }),
      });
      return json({ mode: 'test', kind });
    }

    const back = safeReturn(body.return_url) ?? Deno.env.get('APP_URL') ?? undefined;
    const r = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_id: workflow,
        vendor_data: user.id,
        callback: back ? withParams(back, { didit: '1' }) : undefined,
        callback_method: 'both',
        metadata: { kind },
      }),
    });
    const s = await r.json().catch(() => ({}));
    if (!r.ok || !s.url) return json({ error: 'could not start the ID check', detail: s }, 502);
    await db('checks?on_conflict=user_id,kind', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify({ user_id: user.id, kind, status: 'pending', vendor: 'didit', vendor_ref: s.session_id, updated_at: new Date().toISOString() }),
    });
    return json({ mode: 'live', url: s.url, kind });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
