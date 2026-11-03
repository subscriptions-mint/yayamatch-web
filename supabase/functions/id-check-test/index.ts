// Test mode only (no Didit keys set, or a shared sample sign-in): marks the caller's ID check as passed so the whole app can be walked through on staging.
import { cors, db, getUser, json, profileOf, todayManila } from '../_shared/util.ts';

const ID_TYPES = ['philid', 'umid', 'drivers', 'passport', 'postal', 'prc', 'sss', 'voters'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'not signed in' }, 401);
    const body = await req.json().catch(() => ({}));
    const profile = await profileOf(user.id);
    if (!profile?.side) return json({ error: 'pick a side first' }, 400);
    if (Deno.env.get('DIDIT_API_KEY') && !profile.demo_login) return json({ error: 'test mode is off: real ID checks are on' }, 403);
    const kind = profile.side === 'family' ? 'household_id' : 'id';
    const idType = ID_TYPES.includes(body.id_type) ? body.id_type : 'philid';
    const checkedOn = todayManila();
    await db('checks?on_conflict=user_id,kind', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify({ user_id: user.id, kind, status: 'passed', id_type: idType, checked_on: checkedOn, age_ok: true, vendor: 'test', updated_at: new Date().toISOString() }),
    });
    return json({ status: 'passed', checked_on: checkedOn, kind, test: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
