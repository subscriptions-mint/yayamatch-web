import { en, type Dict } from '../i18n/en';
import { tl } from '../i18n/tl';
import type { Lang } from './types';
import { useStore } from './store';
import { MIN_WAGE, type City, type Region, regionOf } from '../data/constants';

const DICTS: Record<Lang, Dict> = { en, tl };

type Vars = Record<string, string | number>;

function lookup(d: unknown, key: string): unknown {
  let cur: unknown = d;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

export function translate(lang: Lang, key: string, vars?: Vars): string {
  let v = lookup(DICTS[lang], key);
  if (typeof v !== 'string') v = lookup(en, key);
  if (typeof v !== 'string') return key;
  if (!vars) return v;
  return v.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function raw<T = unknown>(lang: Lang, key: string): T {
  const v = lookup(DICTS[lang], key);
  return (v === undefined ? lookup(en, key) : v) as T;
}

export type T = ((key: string, vars?: Vars) => string) & { lang: Lang; raw: <R = unknown>(key: string) => R };

export function makeT(lang: Lang): T {
  const fn = ((key: string, vars?: Vars) => translate(lang, key, vars)) as T;
  fn.lang = lang;
  fn.raw = <R,>(key: string) => raw<R>(lang, key);
  return fn;
}

export function useT(): T {
  const lang = useStore(s => s.lang);
  return makeT(lang);
}

// ---------- formatting ----------
export const peso = (n: number) => '₱' + Math.round(n).toLocaleString('en-PH');
export const pesoRange = (a: number, b: number) => `${peso(a)}–${peso(b)}`;

export function monthLabel(t: T, ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const months = t.raw<string[]>('months');
  return `${months[m - 1]} ${y}`;
}

export function dateLabel(t: T, iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const months = t.raw<string[]>('months');
  return t.lang === 'tl' ? `${months[d.getMonth()]} ${d.getDate()}` : `${months[d.getMonth()]} ${d.getDate()}`;
}

export function sinceLabel(t: T, iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const months = t.raw<string[]>('months');
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function ago(t: T, ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return t('time.now');
  if (s < 3600) return t('time.min', { n: Math.floor(s / 60) });
  if (s < 86400) return t('time.hr', { n: Math.floor(s / 3600) });
  return t('time.day', { n: Math.floor(s / 86400) });
}

export function clock(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

export function dayClock(t: T, ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  const label = days === 0 ? t('time.today') : days === 1 ? t('time.tomorrow') : days === -1 ? t('time.yesterday') : `${t.raw<Record<string, string>>('daysLong')[['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()]]}`;
  return `${label}, ${clock(ts)}`;
}

export function listJoin(t: T, items: string[]): string {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ` ${t('common.and')} ` + items[items.length - 1];
}

export function minWageLine(t: T, city: City, key: string): string {
  const r: Region = regionOf(city);
  const w = MIN_WAGE[r];
  return t(key, { region: t(`regions.${r}`), amount: peso(w.amount), since: sinceLabel(t, w.since) });
}

export function quoteWho(t: T, who: string): string {
  if (t.lang !== 'tl') return who;
  return who.replace(/^Former /, 'Dating ').replace(/(\d+) yrs?\b/, '$1 taon').replace(/(\d+) mos\b/, '$1 buwan')
    .replace(/ family\b/, ' family');
}

export function daysLabel(t: T, days: string[]): string {
  const map = t.raw<Record<string, string>>('daysLong');
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const sorted = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return listJoin(t, sorted.map(d => map[d]));
}

export function workDaysLabel(t: T, daysOff: string[]): string {
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const work = order.filter(d => !daysOff.includes(d));
  const short = t.raw<Record<string, string>>('days');
  if (work.length >= 3) {
    const contiguous = work.every((d, i) => i === 0 || order.indexOf(d) === order.indexOf(work[i - 1]) + 1);
    if (contiguous) return `${short[work[0]]}–${short[work[work.length - 1]]}`;
  }
  return work.map(d => short[d]).join(', ');
}

export function hoursLabel(hours: string): string {
  const fmt = (hm: string) => {
    const [h, m] = hm.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 || 12;
    return m ? `${hh}:${String(m).padStart(2, '0')} ${ap}` : `${hh} ${ap}`;
  };
  const [a, b] = hours.split('–');
  return `${fmt(a)}–${fmt(b)}`;
}
