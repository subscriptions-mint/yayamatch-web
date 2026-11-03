// PayMongo -> YayaMatch. Verifies Paymongo-Signature (t, te/li) and marks the purchase paid.
import { db, expiryFor, hmacHex, json, safeEqual } from '../_shared/util.ts';

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET');
    if (!secret) return json({ error: 'not configured' }, 503);
    const raw = await req.text();
    const header = req.headers.get('Paymongo-Signature') ?? '';
    const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
    if (!parts.t) return json({ error: 'no signature' }, 401);
    const expected = await hmacHex(secret, `${parts.t}.${raw}`);
    if (!safeEqual(expected, parts.li ?? '') && !safeEqual(expected, parts.te ?? '')) return json({ error: 'bad signature' }, 401);
    if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return json({ error: 'stale' }, 401);

    const event = JSON.parse(raw);
    const type: string = event?.data?.attributes?.type ?? '';
    if (type !== 'checkout_session.payment.paid') return json({ ok: true, ignored: type });
    const cs = event.data.attributes.data;
    const purchaseId: string | undefined = cs?.attributes?.metadata?.purchase_id ?? cs?.attributes?.reference_number;
    if (!purchaseId) return json({ ok: true, ignored: 'no purchase id' });
    const rows = await db(`purchases?id=eq.${purchaseId}&select=*`, { method: 'GET' });
    const p = rows?.[0];
    if (!p) return json({ ok: true, ignored: 'unknown purchase' });
    if (p.status === 'paid') return json({ ok: true, already: true });
    const payment = cs?.attributes?.payments?.[0]?.attributes;
    const method = cs?.attributes?.payment_method_used ?? payment?.source?.type ?? null;
    await db(`purchases?id=eq.${p.id}`, {
      method: 'PATCH', prefer: 'return=minimal',
      body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString(), expires_at: expiryFor(p.item), method }),
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
