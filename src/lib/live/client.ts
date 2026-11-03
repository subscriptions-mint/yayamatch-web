// A small fetch-based Supabase client: Auth, PostgREST, RPC, edge functions and Storage. No dependencies.
import { CONFIG, appUrl } from '../config';

export interface AuthUser { id: string; email?: string; user_metadata?: Record<string, unknown> }
export interface Session { access_token: string; refresh_token: string; expires_at: number; user: AuthUser }

const SESSION_KEY = 'yayamatch-live-session';

export class ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;
  constructor(status: number, message: string, code?: string, body?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

const base = () => CONFIG?.supabaseUrl ?? '';
const key = () => CONFIG?.supabaseKey ?? '';

// ---------- session ----------
let session: Session | null = readSession();
let refreshTimer: number | null = null;
let refreshing: Promise<boolean> | null = null;
const sessionListeners = new Set<(s: Session | null) => void>();

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s && s.access_token && s.refresh_token ? s : null;
  } catch { return null; }
}

function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage unavailable: keep it in memory */ }
}

export function getSession(): Session | null { return session; }
export function onSession(cb: (s: Session | null) => void): () => void { sessionListeners.add(cb); return () => { sessionListeners.delete(cb); }; }

export function setSession(s: Session | null) {
  session = s;
  writeSession(s);
  scheduleRefresh();
  sessionListeners.forEach(l => l(s));
}

/** Turns a GoTrue token response (or the #access_token hash) into a session. */
export function sessionFrom(r: { access_token: string; refresh_token: string; expires_in?: number | string; expires_at?: number | string; user?: AuthUser }, user?: AuthUser): Session {
  const now = Math.floor(Date.now() / 1000);
  const exp = r.expires_at ? Number(r.expires_at) : now + Number(r.expires_in ?? 3600);
  return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp, user: r.user ?? user ?? { id: userIdFromJwt(r.access_token) ?? '' } };
}

function userIdFromJwt(jwt: string): string | null {
  try {
    const p = jwt.split('.')[1];
    const json = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.sub === 'string' ? json.sub : null;
  } catch { return null; }
}

function scheduleRefresh() {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  refreshTimer = null;
  if (!session) return;
  // about 60 s before expiry
  const ms = Math.max(1000, (session.expires_at - 60) * 1000 - Date.now());
  refreshTimer = window.setTimeout(() => { void refresh(); }, Math.min(ms, 2_000_000_000));
}

/** Refreshes the session. Resolves false (and signs out locally) when the refresh token is no longer valid. */
export function refresh(): Promise<boolean> {
  if (!session) return Promise.resolve(false);
  if (refreshing) return refreshing;
  const rt = session.refresh_token;
  refreshing = (async () => {
    try {
      const r = await raw<{ access_token: string; refresh_token: string; expires_in: number; user: AuthUser }>(
        '/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: rt }) }, false);
      setSession(sessionFrom(r));
      return true;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 400 || e.status === 401 || e.status === 403)) setSession(null);
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// ---------- low-level request ----------
async function raw<T>(path: string, init: RequestInit = {}, auth = true, retried = false): Promise<T> {
  if (auth && session && session.expires_at * 1000 < Date.now() + 5000 && !retried) await refresh();
  const headers: Record<string, string> = { apikey: key(), ...(init.headers as Record<string, string> | undefined) };
  if (!(init.body instanceof Blob) && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (auth && session) headers.Authorization = `Bearer ${session.access_token}`;
  let res: Response;
  try {
    res = await fetch(base() + path, { ...init, headers });
  } catch (e) {
    throw new ApiError(0, 'network', 'network', String(e));
  }
  if (res.status === 401 && auth && session && !retried) {
    if (await refresh()) return raw<T>(path, init, auth, true);
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) { try { body = JSON.parse(text); } catch { body = text; } }
  if (!res.ok) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const msg = String(b.msg ?? b.message ?? b.error_description ?? b.error ?? res.statusText ?? 'error');
    const code = String(b.code ?? b.error_code ?? b.error ?? res.status);
    throw new ApiError(res.status, msg, code, body);
  }
  return body as T;
}

// ---------- auth ----------
export const auth = {
  /** Sends a sign-in email (a 6-digit code, or a magic link until the email template is changed). */
  sendEmailCode(email: string) {
    return raw('/auth/v1/otp?redirect_to=' + encodeURIComponent(appUrl()), { method: 'POST', body: JSON.stringify({ email, create_user: true }) }, false);
  },
  async verifyEmailCode(email: string, token: string): Promise<Session> {
    const r = await raw<{ access_token: string; refresh_token: string; expires_in: number; user: AuthUser }>(
      '/auth/v1/verify', { method: 'POST', body: JSON.stringify({ type: 'email', email, token }) }, false);
    const s = sessionFrom(r);
    setSession(s);
    return s;
  },
  async signInWithPassword(email: string, password: string): Promise<Session> {
    const r = await raw<{ access_token: string; refresh_token: string; expires_in: number; user: AuthUser }>(
      '/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
    const s = sessionFrom(r);
    setSession(s);
    return s;
  },
  oauthUrl(provider: 'google' | 'facebook'): string {
    return `${base()}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(appUrl())}`;
  },
  getUser(): Promise<AuthUser> { return raw<AuthUser>('/auth/v1/user', { method: 'GET' }); },
  async signOut(): Promise<void> {
    try { if (session) await raw('/auth/v1/logout', { method: 'POST' }, true, true); } catch { /* sign out locally anyway */ }
    setSession(null);
  },
};

// ---------- PostgREST ----------
export const enc = (v: string | number | boolean) => encodeURIComponent(String(v));
/** `in.(…)` list. UUIDs and plain keys need no quoting; anything else is quoted. */
export const inList = (vals: (string | number)[]) => `in.(${vals.map(v => (/^[\w-]+$/.test(String(v)) ? String(v) : `"${String(v).replace(/"/g, '\\"')}"`)).map(encodeURIComponent).join(',')})`;

// Rows are loosely typed on purpose: map.ts turns them into the app types.
type Row = Record<string, any>;

export const db = {
  select<T = Row>(table: string, query: string): Promise<T[]> {
    return raw<T[]>(`/rest/v1/${table}?${query}`, { method: 'GET' });
  },
  insert<T = Row>(table: string, rows: Row | Row[], opts: { upsert?: boolean; onConflict?: string; returning?: boolean; ignoreDuplicates?: boolean } = {}): Promise<T[]> {
    const prefer = [opts.returning === false ? 'return=minimal' : 'return=representation'];
    if (opts.upsert) prefer.push(opts.ignoreDuplicates ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates');
    const q = opts.onConflict ? `?on_conflict=${opts.onConflict}` : '';
    return raw<T[]>(`/rest/v1/${table}${q}`, { method: 'POST', body: JSON.stringify(rows), headers: { Prefer: prefer.join(',') } }).then(r => r ?? []);
  },
  update<T = Row>(table: string, filter: string, patch: Row, returning = true): Promise<T[]> {
    return raw<T[]>(`/rest/v1/${table}?${filter}`, { method: 'PATCH', body: JSON.stringify(patch), headers: { Prefer: returning ? 'return=representation' : 'return=minimal' } }).then(r => r ?? []);
  },
  remove(table: string, filter: string): Promise<unknown> {
    return raw(`/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  },
  rpc<T = unknown>(name: string, args: Row = {}): Promise<T> {
    return raw<T>(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
  },
};

/** True when PostgREST says the function or table does not exist (e.g. a migration that is not applied yet). */
export function isMissing(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 404 || e.code === 'PGRST202' || e.code === '42883' || e.code === 'PGRST205');
}

// ---------- edge functions ----------
export function fn<T = unknown>(name: string, body: Row = {}): Promise<T> {
  return raw<T>(`/functions/v1/${name}`, { method: 'POST', body: JSON.stringify(body) });
}

// ---------- storage ----------
export const storage = {
  async upload(bucket: 'photos' | 'voice', path: string, blob: Blob): Promise<string> {
    await raw(`/storage/v1/object/${bucket}/${path}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '3600' } });
    return path;
  },
  publicUrl(bucket: 'photos' | 'voice', path: string): string {
    return `${base()}/storage/v1/object/public/${bucket}/${path}`;
  },
  /** The bucket path inside a public URL from publicUrl(), or null. */
  pathOf(bucket: 'photos' | 'voice', url: string): string | null {
    const pre = `${base()}/storage/v1/object/public/${bucket}/`;
    return url.startsWith(pre) ? url.slice(pre.length) : null;
  },
};

export const realtimeUrl = () => `${base().replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${enc(key())}&vsn=1.0.0`;

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
}
