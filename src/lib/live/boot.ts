// Runs before the hash router reads location.hash (main.tsx imports it first).
// Live mode only: picks up sign-in tokens (#access_token=…), sign-in errors (?error=… or #error=…),
// and returns from Didit (?didit=1…) and PayMongo (?paid=… / ?cancelled=…), then cleans the URL.
import { LIVE } from '../config';

export interface BootInfo {
  tokens?: { access_token: string; refresh_token: string; expires_in?: string; expires_at?: string; type?: string };
  authError?: string;
  didit?: { sessionId: string | null; status: string | null };
  paid?: string;
  cancelled?: string;
}

export const BOOT: BootInfo = {};

/** Saved before leaving the app (OAuth, Didit, PayMongo) so we land back on the right screen. */
export const RETURN_KEY = 'ym-return';

function take(k: string): string | null {
  try { const v = sessionStorage.getItem(k); sessionStorage.removeItem(k); return v; } catch { return null; }
}

if (LIVE && typeof location !== 'undefined') {
  const hash = location.hash.replace(/^#/, '');
  const q = new URLSearchParams(location.search);
  let touched = false;
  let route: string | null = null;

  if (/(^|&)(access_token|error|error_description)=/.test(hash)) {
    const h = new URLSearchParams(hash);
    const at = h.get('access_token'); const rt = h.get('refresh_token');
    if (at && rt) BOOT.tokens = { access_token: at, refresh_token: rt, expires_in: h.get('expires_in') ?? undefined, expires_at: h.get('expires_at') ?? undefined, type: h.get('type') ?? undefined };
    const err = h.get('error_description') || h.get('error');
    if (err) BOOT.authError = err;
    touched = true;
    route = '#welcome';
  }
  if (q.has('error') || q.has('error_description')) {
    BOOT.authError = q.get('error_description') || q.get('error') || 'error';
    touched = true;
    route = route ?? '#welcome';
  }
  if (q.get('didit')) {
    BOOT.didit = { sessionId: q.get('verificationSessionId') ?? q.get('session_id'), status: q.get('status') };
    touched = true;
  }
  if (q.get('paid')) { BOOT.paid = q.get('paid')!; touched = true; }
  if (q.get('cancelled')) { BOOT.cancelled = q.get('cancelled')!; touched = true; }

  if (touched) {
    const saved = take(RETURN_KEY);
    const target = (BOOT.didit || BOOT.paid || BOOT.cancelled) ? (saved || (hash && !/=/.test(hash) ? '#' + hash : null)) : (route ?? saved);
    try { history.replaceState(null, '', location.pathname + (target || '#welcome')); } catch { /* ignore */ }
  }
}
