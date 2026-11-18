// "Sign in with Google" through Google Identity Services (GIS), the library Google maintains for web sign-in.
//
// Flow: the official button (rendered by Google inside its own iframe) opens Google's account chooser in a
// popup. Google hands back an ID token (a signed JWT). We pass it, with the raw nonce, to Supabase Auth
// (`/auth/v1/token?grant_type=id_token`), which is the backend check: it verifies Google's signature, the
// issuer, the expiry, that the audience is our Client ID and that the nonce matches, then creates or signs in
// the user and returns a normal Supabase session. No Google secret ever reaches the browser.
//
// The nonce stops a stolen or replayed ID token from being used: Google receives its SHA-256 (hex) and puts
// that in the token; Supabase receives the raw value and hashes it itself.
import { CONFIG } from '../config';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface GisCredentialResponse { credential?: string; select_by?: string }
interface GisId {
  initialize(config: Record<string, unknown>): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  disableAutoSelect(): void;
  cancel(): void;
}
declare global { interface Window { google?: { accounts?: { id?: GisId } } } }

/** The public OAuth Client ID (…apps.googleusercontent.com). Empty when Google's button isn't configured. */
export function googleClientId(): string {
  return CONFIG?.googleClientId ?? '';
}

/** Google's button language. Tagalog uses Google's "fil" (Filipino). */
export function gisLocale(lang: string): string {
  return lang === 'tl' ? 'fil' : 'en';
}

let loading: Promise<boolean> | null = null;

/** Loads the GIS script once. Resolves false if it is blocked (ad blocker, offline, firewall) or slow. */
export function loadGis(lang: string, timeoutMs = 8000): Promise<boolean> {
  if (window.google?.accounts?.id) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>(resolve => {
    const s = document.createElement('script');
    s.src = `${GIS_SRC}?hl=${encodeURIComponent(gisLocale(lang))}`;
    s.async = true;
    s.defer = true;
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      const ready = ok && !!window.google?.accounts?.id;
      if (!ready) { loading = null; s.remove(); }
      resolve(ready);
    };
    const timer = window.setTimeout(() => done(false), timeoutMs);
    s.onload = () => done(true);
    s.onerror = () => done(false);
    document.head.appendChild(s);
  });
  return loading;
}

/** A fresh nonce for each attempt: `raw` goes to Supabase, `hashed` (SHA-256, hex) to Google. */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

/**
 * Sets up GIS with a new nonce and draws Google's official button into `parent`.
 * Returns false when GIS isn't loaded or no Client ID is configured (the caller then shows the redirect button).
 */
export async function renderGoogleButton(parent: HTMLElement, opts: {
  lang: string;
  width: number;
  onCredential: (idToken: string, rawNonce: string) => void;
}): Promise<boolean> {
  const id = window.google?.accounts?.id;
  const clientId = googleClientId();
  if (!id || !clientId) return false;
  const nonce = await makeNonce();
  id.initialize({
    client_id: clientId,
    nonce: nonce.hashed,
    ux_mode: 'popup',            // stay on our page; the button opens Google's chooser in a popup
    auto_select: false,          // never sign anyone in without a click
    use_fedcm_for_button: true,  // Chrome's FedCM button flow, which keeps working without third-party cookies
    context: 'signin',
    callback: (r: GisCredentialResponse) => { if (r.credential) opts.onCredential(r.credential, nonce.raw); },
  });
  parent.replaceChildren();
  id.renderButton(parent, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'center',
    width: String(Math.max(200, Math.min(400, Math.round(opts.width)))),
    locale: gisLocale(opts.lang),
  });
  return true;
}

/** Google's advice for sign-out: stop GIS from signing the same account straight back in. */
export function googleSignedOut(): void {
  try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* GIS not loaded */ }
}
