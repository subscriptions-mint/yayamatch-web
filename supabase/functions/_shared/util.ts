// Shared helpers for YayaMatch edge functions (Deno). No npm imports: plain fetch against the project's own APIs.
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
export const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export type User = { id: string; email?: string };

/** The signed-in user behind the request's Bearer token, or null. */
export async function getUser(req: Request): Promise<User | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { Authorization: auth, apikey: SERVICE_KEY } });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id, email: u.email } : null;
}

/** PostgREST call with the service role (bypasses RLS: only for server-side writes). */
export async function db(path: string, init: RequestInit & { prefer?: string } = {}): Promise<any> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: init.prefer ?? 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`db ${path}: ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// demo_login: the shared sample sign-ins (Kristine, Santos). They always run in test mode: no real ID checks, no real payments.
export async function profileOf(uid: string): Promise<{ id: string; side: string | null; lang: string; demo_login: boolean } | null> {
  const rows = await db(`profiles?id=eq.${uid}&select=id,side,lang,demo_login`, { method: 'GET' });
  return rows?.[0] ?? null;
}

/** Only send people back to our own site. */
export function safeReturn(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    const app = Deno.env.get('APP_URL');
    const okHost = u.hostname.endsWith('.vercel.app') || u.hostname === 'localhost' || u.hostname === '127.0.0.1'
      || (app && u.host === new URL(app).host) || u.hostname.endsWith('yayamatch.ph') || u.hostname.endsWith('yayamatch.com');
    return okHost && (u.protocol === 'https:' || u.hostname === 'localhost') ? u.toString() : null;
  } catch {
    return null;
  }
}

export function withParams(url: string, params: Record<string, string>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

export async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const todayManila = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

export const PRICES: Record<string, { amount: number; name: string; hours?: number }> = {
  chat_unlock: { amount: 79, name: 'YayaMatch: unlock one chat' },
  pass: { amount: 199, name: 'YayaMatch Hiring Pass (7 days)', hours: 7 * 24 },
  premium: { amount: 399, name: 'YayaMatch Premium (30 days)', hours: 30 * 24 },
  report: { amount: 99, name: 'YayaMatch full check report' },
  urgent: { amount: 199, name: 'YayaMatch Urgent Hire Pass (72 hours)', hours: 72 },
};

export function expiryFor(item: string): string | null {
  const h = PRICES[item]?.hours;
  return h ? new Date(Date.now() + h * 3600_000).toISOString() : null;
}
