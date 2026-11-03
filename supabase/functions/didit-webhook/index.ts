// Didit -> YayaMatch. Verifies the signature, re-reads the decision from Didit, and stores only the result.
// We keep: pass/fail/review, ID type, month checked, 18+ flag, Didit session id. No images, no ID numbers.
import { db, hmacHex, json, safeEqual, todayManila } from '../_shared/util.ts';

function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v as Record<string, unknown>).sort()
      .map((k) => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

function ageOn(dob: string | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('DIDIT_WEBHOOK_SECRET');
    const apiKey = Deno.env.get('DIDIT_API_KEY');
    if (!secret || !apiKey) return json({ error: 'not configured' }, 503);
    const raw = await req.text();
    const ts = Number(req.headers.get('X-Timestamp') ?? '0');
    if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return json({ error: 'stale' }, 401);

    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return json({ error: 'bad body' }, 400); }
    const sigRaw = req.headers.get('X-Signature') ?? '';
    const sigV2 = req.headers.get('X-Signature-V2') ?? '';
    const okRaw = sigRaw && safeEqual(await hmacHex(secret, raw), sigRaw);
    const okV2 = sigV2 && safeEqual(await hmacHex(secret, canonical(parsed)), sigV2);
    if (!okRaw && !okV2) return json({ error: 'bad signature' }, 401);

    const sessionId: string = parsed.session_id;
    const status: string = parsed.status;
    const uid: string = parsed.vendor_data;
    if (!sessionId || !uid) return json({ ok: true, ignored: 'no session' });
    if (!['Approved', 'Declined', 'In Review'].includes(status)) return json({ ok: true, ignored: status });

    // Never trust the body for the outcome: read the decision back from Didit.
    const r = await fetch(`https://verification.didit.me/v3/session/${sessionId}/decision/`, { headers: { 'x-api-key': apiKey } });
    const decision = await r.json().catch(() => ({}));
    const finalStatus: string = decision.status ?? status;
    const idv = decision.id_verifications?.[0] ?? decision.id_verification ?? {};
    const age = ageOn(idv.date_of_birth);
    const ageOk = age === null ? null : age >= 18;

    let ours = finalStatus === 'Approved' ? 'passed' : finalStatus === 'Declined' ? 'failed' : 'review';
    let note: string | null = null;
    if (ours === 'passed' && ageOk === false) { ours = 'failed'; note = 'under 18'; }
    if (ours === 'passed' && ageOk === null) { ours = 'review'; note = 'no birth date read'; }

    const profiles = await db(`profiles?id=eq.${uid}&select=side`, { method: 'GET' });
    const kind = profiles?.[0]?.side === 'family' ? 'household_id' : 'id';
    await db('checks?on_conflict=user_id,kind', {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify({
        user_id: uid, kind, status: ours, id_type: idv.document_type ?? null,
        checked_on: ours === 'passed' ? todayManila() : null, age_ok: ageOk, vendor: 'didit', vendor_ref: sessionId,
        note, updated_at: new Date().toISOString(),
      }),
    });
    if (ageOk === false) {
      await db(`helpers?id=eq.${uid}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ visible: false }) });
      await db(`families?id=eq.${uid}`, { method: 'PATCH', prefer: 'return=minimal', body: JSON.stringify({ visible: false }) });
    }
    return json({ ok: true, status: ours });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
