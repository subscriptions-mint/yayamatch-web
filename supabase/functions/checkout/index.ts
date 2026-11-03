// Creates a purchase and, when PayMongo is configured, a PayMongo checkout session (QR Ph, GCash, Maya, cards).
// Families only: helpers never pay. Prices are fixed here, never taken from the client.
import { PRICES, cors, db, getUser, json, profileOf, safeReturn, withParams } from '../_shared/util.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'not signed in' }, 401);
    const { item, target_id, return_url } = await req.json().catch(() => ({}));
    const price = PRICES[item];
    if (!price) return json({ error: 'unknown item' }, 400);
    if ((item === 'chat_unlock' || item === 'report') && typeof target_id !== 'string') return json({ error: 'missing helper' }, 400);
    const profile = await profileOf(user.id);
    if (profile?.side !== 'family') return json({ error: 'helpers never pay' }, 403);

    const key = profile.demo_login ? undefined : Deno.env.get('PAYMONGO_SECRET_KEY');
    const [purchase] = await db('purchases', {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id, item, target_id: target_id ?? null, amount: price.amount, status: 'pending', provider: key ? 'paymongo' : 'test' }),
    });
    if (!key) return json({ mode: 'test', purchase_id: purchase.id, amount: price.amount });

    const back = safeReturn(return_url) ?? Deno.env.get('APP_URL');
    if (!back) return json({ error: 'missing return url' }, 400);
    const r = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(key + ':'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{ name: price.name, amount: price.amount * 100, currency: 'PHP', quantity: 1 }],
            payment_method_types: ['qrph', 'gcash', 'paymaya', 'card'],
            success_url: withParams(back, { paid: purchase.id }),
            cancel_url: withParams(back, { cancelled: purchase.id }),
            description: price.name,
            reference_number: purchase.id,
            metadata: { purchase_id: purchase.id, user_id: user.id, item },
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
          },
        },
      }),
    });
    const s = await r.json().catch(() => ({}));
    const url = s?.data?.attributes?.checkout_url;
    if (!r.ok || !url) {
      await db(`purchases?id=eq.${purchase.id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ status: 'failed' }) });
      return json({ error: 'could not start checkout', detail: s?.errors ?? null }, 502);
    }
    await db(`purchases?id=eq.${purchase.id}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ provider_ref: s.data.id, checkout_url: url }) });
    return json({ mode: 'live', url, purchase_id: purchase.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
