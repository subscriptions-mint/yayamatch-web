import { useSyncExternalStore } from 'react';
import type { AppState, FamilyState, YayaState, Lang, LiveState } from './types';
import type { Product } from '../data/constants';
import { LIVE } from './config';

// The demo and the live app never share saved data.
const KEY = LIVE ? 'yayamatch-live-v1' : 'yayamatch-web-v1';

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function defaultFamily(): FamilyState {
  // The demo starts with sample answers; a real family starts with a blank form (except safe defaults).
  const sample = !LIVE;
  return {
    phone: '', verified: false, onboarded: false, name: sample ? 'Santos' : '',
    roles: sample ? ['nanny', 'housekeeper'] : [], city: 'makati', kids: sample ? [3, 6] : [], elder: false, pets: sample ? ['dog'] : [], langs: ['tagalog', 'english'],
    arrangement: 'livein', schedule: 'fulltime', restDays: ['sun'], budgetMin: 12000, budgetMax: 15000, perks: sample ? ['ownRoom'] : [],
    likes: [], passes: [], likeDay: today(), likesUsedToday: 0, matches: [], chats: {},
    passUntil: null, premiumUntil: null, urgentUntil: null, unlocked: [], reports: [], blocked: [], reported: [],
    filters: { idOnly: false, liveInOnly: false, maxRate: null, lang: null, minYears: 0 }, roleFilter: 'all',
    hires: [], purchases: [], seenMatches: [], idCheck: null,
  };
}

export function defaultYaya(): YayaState {
  return {
    phone: '', verified: false, onboarded: false, fromBiodata: false, name: '', age: 27, homeCity: null,
    roles: [], yearsByRole: {}, skills: [], caredFor: [], abroad: false, countries: [], langs: ['tagalog'],
    rate: 12000, arrangement: 'liveout', daysOff: ['sun'], workCities: [], startIn: '2weeks', photo: null, voiceSec: null, bio: '',
    idCheck: null, nbi: false, availableUntil: null, interested: [], hidden: [], matches: [], chats: {}, blocked: [], reported: [],
    hired: null, visible: true, seenMatches: [], lastInitial: '', phoneShare: '', voiceUrl: null,
  };
}

export function defaultLive(): LiveState {
  return {
    status: 'boot', loaded: false, uid: null, email: null, role: 'user', side: null, onboarded: false, demoLogin: false,
    helpers: {}, households: {}, likedMe: [], likedCount: 0, matchOf: {}, hireOf: {}, idStatus: 'none', samples: [],
  };
}

// Sample answers, as if read from a paper biodata.
export function biodataSample(): Partial<YayaState> {
  return {
    fromBiodata: true, name: 'Kristine', age: 27, homeCity: 'qc', roles: ['nanny', 'housekeeper'], yearsByRole: { nanny: 5, housekeeper: 2 },
    skills: ['childcare', 'cooking', 'laundry', 'tutoring'], caredFor: ['baby', 'toddler'], abroad: false, countries: [], langs: ['tagalog', 'english'],
    rate: 12000, arrangement: 'liveout', daysOff: ['sat', 'sun'], workCities: ['qc', 'pasig', 'mandaluyong'], startIn: '2weeks', photo: 'kristine.jpg',
    bio: 'Dating preschool aide. May simpleng routine ako para sa mga bata: tulog, laro, basa. Maayos at organisado.',
  };
}

function initial(): AppState {
  const st: AppState = { v: 1, lang: 'en', langChosen: false, family: defaultFamily(), yaya: defaultYaya() };
  if (LIVE) st.live = defaultLive();
  return st;
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s && s.v === 1) {
        // merge with defaults so new fields always exist; clear transient typing flags
        const base = initial();
        const st: AppState = { ...base, ...s, family: { ...base.family, ...s.family }, yaya: { ...base.yaya, ...s.yaya } };
        // live: the session is checked again on every load, so start in 'boot'
        if (LIVE) st.live = { ...defaultLive(), ...s.live, status: 'boot', loaded: false };
        for (const c of Object.values(st.family.chats)) c.typing = false;
        for (const c of Object.values(st.yaya.chats)) c.typing = false;
        return st;
      }
    }
  } catch { /* storage unavailable: start fresh in memory */ }
  return initial();
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function getState(): AppState { return state; }

export function setState(mut: (draft: AppState) => void): void {
  const next = structuredClone(state);
  mut(next);
  state = next;
  persist();
  listeners.forEach(l => l());
}

export function resetState(lang?: Lang): void {
  state = initial();
  if (lang) state.lang = lang;
  persist();
  listeners.forEach(l => l());
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

export function useStore<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

// ---------- transient UI state (not saved) ----------
export interface Toast { id: number; text: string; action?: { label: string; run: () => void }; tone?: 'ok' | 'info' }
export interface Checkout {
  item: Product; target?: string; returnTo: string; side: 'family';
  purchaseId?: string; // live: purchases.id from the checkout function
  returned?: 'paid'; // live: back from PayMongo, waiting for the webhook
}
interface UiState {
  toasts: Toast[];
  checkout: Checkout | null;
  editing: boolean;
  activeChat: string | null;
  plansCtx: { kind: 'chat' | 'limit' | 'filters' | 'likes' | 'chats' | 'report' | 'generic'; target?: string; returnTo: string } | null;
  idReturn: string | null; // where the ID check sends you when it is done (e.g. back to a chat)
  authEmail: string; // live: the email the sign-in code went to
  busy: boolean; // live: a request the screen is waiting for
}
let ui: UiState = { toasts: [], checkout: null, editing: false, activeChat: null, plansCtx: null, idReturn: null, authEmail: '', busy: false };
const uiListeners = new Set<() => void>();
export function getUi(): UiState { return ui; }
export function setUi(patch: Partial<UiState>): void {
  ui = { ...ui, ...patch };
  uiListeners.forEach(l => l());
}
function subUi(cb: () => void) { uiListeners.add(cb); return () => { uiListeners.delete(cb); }; }
export function useUi<T>(sel: (s: UiState) => T): T { return useSyncExternalStore(subUi, () => sel(ui)); }

let toastId = 1;
export function toast(text: string, opts: { action?: Toast['action']; tone?: Toast['tone']; ms?: number } = {}): void {
  if (ui.toasts.some(x => x.text === text)) return;
  const t: Toast = { id: toastId++, text, action: opts.action, tone: opts.tone };
  setUi({ toasts: [...ui.toasts.slice(-2), t] });
  setTimeout(() => setUi({ toasts: ui.toasts.filter(x => x.id !== t.id) }), opts.ms ?? (opts.action ? 6000 : 3200));
}
export function dismissToast(id: number) { setUi({ toasts: ui.toasts.filter(x => x.id !== id) }); }
