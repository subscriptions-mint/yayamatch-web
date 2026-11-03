// Build-time config. `node scripts/build.mjs --live` writes window.__YM_CONFIG__ into the page; the demo build leaves it out.
export interface YmConfig {
  supabaseUrl: string;
  supabaseKey: string;
  mode: 'live';
  seedPassword?: string;
  appUrl?: string;
}

declare global { interface Window { __YM_CONFIG__?: YmConfig } }

const raw: YmConfig | undefined = typeof window !== 'undefined' ? window.__YM_CONFIG__ : undefined;

export const CONFIG: YmConfig | null = raw && raw.mode === 'live' && raw.supabaseUrl && raw.supabaseKey
  ? { ...raw, supabaseUrl: raw.supabaseUrl.replace(/\/+$/, '') }
  : null;

/** True in the live build (Supabase backend). False in the offline demo. */
export const LIVE = !!CONFIG;

/** Staging only: sample accounts are listed on Welcome when a seed password is configured. */
export const SEEDS_ON = !!CONFIG?.seedPassword;

/** Where Supabase, Didit and PayMongo send people back to. */
export function appUrl(): string {
  if (CONFIG?.appUrl) return CONFIG.appUrl;
  return location.origin + location.pathname;
}
