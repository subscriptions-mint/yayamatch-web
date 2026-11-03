// Maps Supabase rows to the app's Helper / Household / Chat types (and back), so screens stay unchanged.
import type { Helper, Household, Chat, Message, FamilyState, YayaState, Ym, Quote, PlanHow } from '../types';
import { CITIES, CITY_KEYS, ROLES, SKILLS, LANGS, DAYS, PERKS, CARED_FOR, regionOf, type City, type AnyIdType, type IdType, type Role, type StartIn } from '../../data/constants';
import { storage } from './client';

export type Row = Record<string, any>;

export interface CheckRow {
  id?: string; user_id: string; kind: string; status: string; id_type: string | null; checked_on: string | null;
  valid_until: string | null; age_ok?: boolean | null; detail: string | null; created_at?: string; updated_at?: string;
}
/** checks has column-level grants: always ask for these columns, never `*`. */
export const CHECK_COLS = 'id,user_id,kind,status,id_type,checked_on,valid_until,age_ok,detail,created_at,updated_at';

// ---------- small conversions ----------
const pick = <T extends string>(v: unknown, allowed: readonly T[]): T[] => (Array.isArray(v) ? v.filter((x): x is T => allowed.includes(x)) : []);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);

export function toCity(v: unknown, region?: unknown): City | null {
  if (typeof v !== 'string' || !v.trim()) return region === 'r7' ? 'cebu' : region === 'r11' ? 'davao' : null;
  const s = v.trim().toLowerCase();
  if ((CITY_KEYS as string[]).includes(s)) return s as City;
  const names: Record<string, string[]> = {
    makati: ['makati'], bgc: ['taguig', 'bgc'], qc: ['quezon city', 'quezon'], pasig: ['pasig'], manila: ['manila', 'maynila'], mandaluyong: ['mandaluyong'],
    sanjuan: ['san juan'], pasay: ['pasay'], paranaque: ['parañaque', 'paranaque'], laspinas: ['las piñas', 'las pinas'], muntinlupa: ['muntinlupa'],
    marikina: ['marikina'], caloocan: ['caloocan'], valenzuela: ['valenzuela'], malabon: ['malabon'], navotas: ['navotas'], pateros: ['pateros'],
    cebu: ['cebu'], davao: ['davao'],
  };
  for (const c of CITY_KEYS) if (names[c]?.some(n => s.includes(n))) return c;
  for (const c of CITY_KEYS) if (CITIES[c].aliases.some(a => s.includes(a))) return c;
  return region === 'r7' ? 'cebu' : region === 'r11' ? 'davao' : null;
}

export const toArr = (v: unknown): 'livein' | 'liveout' => (v === 'live-in' ? 'livein' : 'liveout');
export const fromArr = (a: 'livein' | 'liveout') => (a === 'livein' ? 'live-in' : 'live-out');
export const toStart = (v: unknown): StartIn => (v === 'now' ? 'now' : v === '1m' || v === '1month' ? '1month' : '2weeks');
export const fromStart = (s: StartIn) => (s === 'now' ? 'now' : s === '1month' ? '1m' : '2w');

/** 'YYYY-MM' from a date or timestamp string. */
export function ym(v: unknown): Ym | undefined {
  if (typeof v !== 'string' || v.length < 7) return undefined;
  return v.slice(0, 7);
}

/** Didit and the test function use their own names for ID types. */
export function idTypeOf(v: unknown): AnyIdType {
  const s = String(v ?? '').toLowerCase();
  if (!s) return 'other';
  if (s.includes('pass')) return 'passport';
  if (s.includes('driv') || s.includes('licen')) return 'license';
  if (s.includes('umid')) return 'umid';
  if (s.includes('postal')) return 'postal';
  if (s.includes('prc')) return 'prc';
  if (s === 'sss' || s.includes('sss')) return 'sss';
  if (s.includes('vot')) return 'voters';
  if (s.includes('phil') || s.includes('national') || s.includes('identity')) return 'philid';
  return 'other';
}
export const idTypeToServer = (t: IdType): string => (t === 'license' ? 'drivers' : t);

export function photoUrl(path: unknown): string {
  if (typeof path !== 'string' || !path) return '';
  if (path.startsWith('asset:')) return path.slice(6);
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return storage.publicUrl('photos', path);
}
/** The value for helpers.photo_path from what the app holds in `photo`. Data URLs are uploaded first (see actions). */
export function photoPathOf(photo: string | null): string | null {
  if (!photo) return null;
  if (photo.startsWith('data:') || photo.startsWith('blob:')) return null;
  const p = storage.pathOf('photos', photo);
  if (p) return p;
  if (/^https?:/.test(photo)) return photo;
  return 'asset:' + photo;
}
export function voiceUrlOf(path: unknown): string | undefined {
  if (typeof path !== 'string' || !path || path.startsWith('asset:')) return undefined;
  return /^https?:/.test(path) ? path : storage.publicUrl('voice', path);
}

function initialsOf(name: string): string {
  const words = name.replace(/\s+family$/i, '').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || 'F';
}

// ---------- checks ----------
interface Dated { phone?: Ym; id?: { type: AnyIdType; month: Ym }; nbi?: Ym; refs?: { n: number; month: Ym }; hid?: Ym }

/** Passed checks only, each with its month. A passed check without checked_on falls back to when it was updated. */
export function datedChecks(rows: CheckRow[]): Dated {
  const out: Dated = {};
  for (const c of rows) {
    if (c.status !== 'passed') continue;
    const month = ym(c.checked_on) ?? ym(c.updated_at) ?? ym(c.created_at);
    if (c.kind === 'phone' && month) out.phone = month;
    else if (c.kind === 'id' && month) out.id = { type: idTypeOf(c.id_type), month };
    else if (c.kind === 'household_id' && month) out.hid = month;
    else if (c.kind === 'nbi') { const m = ym(c.valid_until) ?? month; if (m) out.nbi = m; }
    else if (c.kind === 'references' && month) out.refs = { n: Math.max(1, parseInt(String(c.detail ?? '1'), 10) || 1), month };
  }
  return out;
}

// ---------- cards ----------
export function helperFromRow(r: Row, checks: CheckRow[], likedYou: boolean, sample: boolean): Helper {
  const years: Record<string, number> = r.years && typeof r.years === 'object' ? r.years : {};
  const maxYears = Object.values(years).reduce((a: number, b) => Math.max(a, Number(b) || 0), 0);
  const c = datedChecks(checks);
  return {
    id: r.id,
    firstName: str(r.first_name) || '—',
    lastInitial: str(r.last_initial),
    gender: r.gender === 'f' || r.gender === 'm' ? r.gender : 'x',
    age: Number(r.age) || 0,
    roles: pick(r.roles, ROLES),
    years: Number.isFinite(Number(r.years_total)) && r.years_total != null ? Number(r.years_total) : maxYears,
    city: toCity(r.city, r.region) ?? 'manila',
    rate: Number(r.rate) || 0,
    arrangement: toArr(r.arrangement),
    languages: pick(r.languages, LANGS),
    bio: str(r.bio),
    skills: pick(r.skills, SKILLS),
    experience: Array.isArray(r.experience) ? r.experience.filter((e: any) => e && typeof e.text === 'string').map((e: any) => ({ years: str(e.years), text: e.text })) : [],
    schedule: str(r.schedule),
    startIn: toStart(r.start_in),
    daysOff: pick(r.days_off, DAYS),
    checks: { phone: c.phone, id: c.id, nbi: c.nbi, refs: c.refs },
    quotes: quotesOf(r.quotes),
    photo: photoUrl(r.photo_path),
    likedYou,
    topPick: !!r.top_pick,
    voice: { sec: Number(r.voice_seconds) || 0, script: str(r.voice_script), url: voiceUrlOf(r.voice_path) },
    favorite: str(r.favorite),
    sample,
  };
}

function quotesOf(v: unknown): Quote[] {
  return Array.isArray(v) ? v.filter((q: any) => q && typeof q.text === 'string').map((q: any) => ({ text: q.text, who: str(q.who) })) : [];
}

export function familyDisplayName(familyName: string): string {
  const n = familyName.trim();
  if (!n) return 'Family';
  return /\bfamily$/i.test(n) ? n : `${n} Family`;
}

export function householdFromRow(r: Row, checks: CheckRow[], likedYou: boolean, sample: boolean): Household {
  const c = datedChecks(checks);
  const name = familyDisplayName(str(r.family_name));
  return {
    id: r.id,
    name,
    initials: initialsOf(name),
    origin: r.origin === 'filipino' || r.origin === 'ofw' || r.origin === 'expat' ? r.origin : null,
    city: toCity(r.city, r.region) ?? 'manila',
    size: r.household_size != null ? Number(r.household_size) : null,
    kidsAges: Array.isArray(r.kids) ? r.kids.map(Number).filter(n => Number.isFinite(n)) : [],
    pets: Array.isArray(r.pets) ? r.pets.map(String) : [],
    needs: pick(r.needs, ROLES),
    rateMin: Number(r.budget_min) || 0,
    rateMax: Number(r.budget_max) || Number(r.budget_min) || 0,
    arrangement: toArr(r.arrangement),
    hours: typeof r.hours === 'string' && r.hours ? r.hours.replace('-', '–') : null,
    daysOff: pick(r.rest_days, DAYS),
    startDate: typeof r.start_date === 'string' ? r.start_date.slice(0, 10) : null,
    bio: str(r.about),
    houseRule: str(r.house_rule),
    languages: pick(r.languages, LANGS),
    checks: { phone: c.phone, id: c.hid },
    extras: pick(r.perks, PERKS),
    notes: quotesOf(r.helper_notes),
    likedYou,
    transport: !!r.transport,
    sample,
  };
}

/** A stand-in for a matched card the server no longer shows (e.g. hidden after a hire). */
export function placeholderHelper(id: string): Helper {
  return helperFromRow({ id, first_name: 'YayaMatch', last_initial: '' }, [], false, false);
}
export function placeholderHousehold(id: string): Household {
  return householdFromRow({ id, family_name: 'YayaMatch' }, [], false, false);
}

// ---------- own card <-> state ----------
export function familyFromCard(r: Row, f: FamilyState): FamilyState {
  return {
    ...f,
    name: str(r.family_name, f.name).replace(/\s+family$/i, ''),
    roles: pick(r.needs, ROLES),
    city: toCity(r.city, r.region) ?? f.city,
    kids: Array.isArray(r.kids) ? r.kids.map(Number) : f.kids,
    elder: !!r.elder,
    pets: Array.isArray(r.pets) ? r.pets.map(String) : f.pets,
    langs: pick(r.languages, LANGS),
    arrangement: toArr(r.arrangement),
    schedule: r.schedule === 'part' ? 'parttime' : 'fulltime',
    restDays: pick(r.rest_days, DAYS),
    budgetMin: Number(r.budget_min) || f.budgetMin,
    budgetMax: Number(r.budget_max) || f.budgetMax,
    perks: pick(r.perks, PERKS),
  };
}

export function cardFromFamily(f: FamilyState, uid: string): Row {
  return {
    id: uid,
    family_name: f.name.trim(),
    city: f.city,
    region: regionOf(f.city),
    needs: f.roles,
    kids: f.kids,
    elder: f.elder,
    pets: f.pets,
    languages: f.langs,
    arrangement: fromArr(f.arrangement),
    schedule: f.schedule === 'parttime' ? 'part' : 'full',
    rest_days: f.restDays,
    budget_min: f.budgetMin,
    budget_max: f.budgetMax,
    perks: f.perks,
    updated_at: new Date().toISOString(),
  };
}

export function yayaFromCard(r: Row, y: YayaState): YayaState {
  const yb: Partial<Record<Role, number>> = {};
  if (r.years && typeof r.years === 'object') for (const [k, v] of Object.entries(r.years)) if ((ROLES as readonly string[]).includes(k)) yb[k as Role] = Number(v) || 0;
  return {
    ...y,
    name: str(r.first_name, y.name),
    lastInitial: str(r.last_initial),
    age: Number(r.age) || y.age,
    homeCity: toCity(r.city, r.region) ?? y.homeCity,
    roles: pick(r.roles, ROLES),
    yearsByRole: yb,
    skills: pick(r.skills, SKILLS),
    caredFor: pick(r.cared_for, CARED_FOR),
    abroad: !!r.abroad,
    langs: pick(r.languages, LANGS),
    rate: Number(r.rate) || y.rate,
    arrangement: toArr(r.arrangement),
    daysOff: pick(r.days_off, DAYS),
    workCities: Array.isArray(r.cities) ? r.cities.map((c: unknown) => toCity(c)).filter((c): c is City => !!c) : y.workCities,
    startIn: toStart(r.start_in),
    photo: photoUrl(r.photo_path) || null,
    voiceSec: r.voice_seconds != null ? Number(r.voice_seconds) : null,
    voiceUrl: voiceUrlOf(r.voice_path) ?? null,
    bio: str(r.bio),
    availableUntil: r.available_until ? Date.parse(r.available_until) : null,
    visible: r.visible !== false,
  };
}

export function cardFromYaya(y: YayaState, uid: string, photoPath: string | null, voicePath: string | null): Row {
  const years = Object.values(y.yearsByRole).reduce<number>((a, b) => Math.max(a, b ?? 0), 0);
  const avail = (y.availableUntil ?? 0) > Date.now();
  return {
    id: uid,
    first_name: y.name.trim(),
    last_initial: y.lastInitial,
    age: y.age,
    city: y.homeCity,
    region: y.homeCity ? regionOf(y.homeCity) : null,
    roles: y.roles,
    years: y.yearsByRole,
    years_total: years,
    skills: y.skills,
    cared_for: y.caredFor,
    abroad: y.abroad,
    languages: y.langs,
    rate: y.rate,
    arrangement: fromArr(y.arrangement),
    days_off: y.daysOff,
    cities: y.workCities,
    start_in: fromStart(y.startIn),
    bio: y.bio,
    photo_path: photoPath,
    voice_path: voicePath,
    voice_seconds: y.voiceSec,
    available_now: avail,
    available_until: avail ? new Date(y.availableUntil!).toISOString() : null,
    visible: y.visible,
    updated_at: new Date().toISOString(),
  };
}

// ---------- chat ----------
const HOWS: PlanHow[] = ['messenger', 'viber', 'phone', 'in_person'];

export function messageFromRow(r: Row, uid: string, otherName: string): Message | null {
  const at = Date.parse(r.created_at) || Date.now();
  const mine = r.sender_id === uid;
  const meta = (r.meta && typeof r.meta === 'object' ? r.meta : {}) as Record<string, unknown>;
  switch (r.kind) {
    case 'system':
      if (r.body === 'matched') return null;
      return { id: r.id, from: 'system', text: str(r.body), at };
    case 'number':
      return { id: r.id, from: 'system', text: '', at, kind: 'number', meta: mine ? { mine: true } : { who: otherName, number: str(r.body) } };
    case 'plan': {
      const when = Date.parse(String(meta.when ?? '')) || at;
      const how = HOWS.includes(meta.how as PlanHow) ? (meta.how as PlanHow) : 'phone';
      return { id: r.id, from: mine ? 'me' : 'them', text: str(r.body), at, kind: 'plan', meta: { at: when, how, note: str(meta.note), ...(mine ? { mine: true } : {}) } };
    }
    case 'hired':
      return { id: r.id, from: 'system', text: '', at, kind: 'hired', meta: { at, who: otherName } };
    default:
      return { id: r.id, from: mine ? 'me' : 'them', text: str(r.body), at, kind: 'text' };
  }
}

export function chatFromRows(match: Row, rows: Row[], uid: string, otherId: string, otherName: string, hired: boolean): Chat {
  const mine = match.family_id === uid ? 'family_read_at' : 'helper_read_at';
  const readAt = match[mine] ? Date.parse(match[mine]) : 0;
  const messages = rows.map(r => messageFromRow(r, uid, otherName)).filter((m): m is Message => !!m);
  const myText = rows.filter(r => r.sender_id === uid && r.kind === 'text').length;
  const plans = messages.filter(m => m.kind === 'plan');
  return {
    id: otherId,
    matchId: match.id,
    matchedAt: Date.parse(match.created_at) || Date.now(),
    messages,
    openerUsed: match.family_id === uid && myText >= 1,
    unread: rows.filter(r => r.sender_id && r.sender_id !== uid && r.kind !== 'system' && Date.parse(r.created_at) > readAt).length,
    typing: false,
    theyShared: rows.some(r => r.kind === 'number' && r.sender_id !== uid),
    iShared: rows.some(r => r.kind === 'number' && r.sender_id === uid),
    callAt: plans.length ? Number(plans[plans.length - 1].meta?.at) : null,
    replies: rows.filter(r => r.sender_id && r.sender_id !== uid && r.kind === 'text').length,
    hired: hired || rows.some(r => r.kind === 'hired'),
  };
}

export const otherOf = (m: Row, uid: string): string => (m.family_id === uid ? m.helper_id : m.family_id);
