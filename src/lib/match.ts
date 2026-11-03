// Fit scoring for both sides, and the lists each side sees.
import type { AppState, FamilyState, Helper, Household, YayaState } from './types';
import { HELPERS } from '../data/helpers';
import { HOUSEHOLDS } from '../data/households';
import { regionOf, FREE_LIKES_PER_DAY, FREE_OPEN_CHATS, minWageFor } from '../data/constants';
import { today, getState } from './store';
import { LIVE } from './config';

// Demo: the sample data. Live: the cards loaded from Supabase into the store.
const helpersOf = (s: AppState): Helper[] => (LIVE ? Object.values(s.live?.helpers ?? {}) : HELPERS);
const householdsOf = (s: AppState): Household[] => (LIVE ? Object.values(s.live?.households ?? {}) : HOUSEHOLDS);
export const helperById = (id: string): Helper | undefined => (LIVE ? getState().live?.helpers[id] : HELPERS.find(h => h.id === id));
export const householdById = (id: string): Household | undefined => (LIVE ? getState().live?.households[id] : HOUSEHOLDS.find(h => h.id === id));
export const helperName = (h: Helper) => (h.lastInitial ? `${h.firstName} ${h.lastInitial}.` : h.firstName);

const now = () => Date.now();

// ---------- entitlements (family) ----------
export const hasPass = (f: FamilyState) => (f.passUntil ?? 0) > now() || (f.premiumUntil ?? 0) > now();
export const isPremium = (f: FamilyState) => (f.premiumUntil ?? 0) > now();
export const urgentOn = (f: FamilyState) => (f.urgentUntil ?? 0) > now();
export const chatUnlocked = (f: FamilyState, id: string) => hasPass(f) || f.unlocked.includes(id);
export const reportUnlocked = (f: FamilyState, id: string) => isPremium(f) || f.reports.includes(id);
export function likesLeft(f: FamilyState): number {
  if (hasPass(f)) return Infinity;
  const used = f.likeDay === today() ? f.likesUsedToday : 0;
  return Math.max(0, FREE_LIKES_PER_DAY - used);
}
// Chats where the family has spent its free opener and has not unlocked: these count toward the free cap.
export function openFreeChats(f: FamilyState): number {
  return Object.values(f.chats).filter(c => c.openerUsed && !f.unlocked.includes(c.id) && !f.blocked.includes(c.id)).length;
}
export const freeChatCap = FREE_OPEN_CHATS;
export function planLeft(until: number | null): { days: number; hours: number } {
  const ms = Math.max(0, (until ?? 0) - now());
  return { days: Math.ceil(ms / 86400000), hours: Math.ceil(ms / 3600000) };
}

// ---------- family → helper ----------
export function helperFit(f: FamilyState, h: Helper): number {
  let s = 0;
  if (h.roles.some(r => f.roles.includes(r))) s += 40;
  if (h.city === f.city) s += 22; else if (regionOf(h.city) === regionOf(f.city)) s += 12; else s -= 25;
  if (h.rate >= f.budgetMin && h.rate <= f.budgetMax) s += 20;
  else if (h.rate < f.budgetMin) s += 14;
  else s -= Math.min(30, ((h.rate - f.budgetMax) / 1000) * 6);
  if (h.arrangement === f.arrangement) s += 10;
  if (h.languages.some(l => f.langs.includes(l))) s += 5;
  if (h.checks.id) s += 4;
  if (urgentOn(f) && h.startIn === 'now') s += 30;
  if (h.likedYou) s += 3;
  return s;
}

export function discoverList(s: AppState): Helper[] {
  const f = s.family;
  const fl = f.filters;
  const adv = hasPass(f);
  return helpersOf(s)
    .filter(h => !f.likes.includes(h.id) && !f.passes.includes(h.id) && !f.matches.includes(h.id) && !f.blocked.includes(h.id))
    .filter(h => f.roleFilter === 'all' ? h.roles.some(r => f.roles.includes(r)) || f.roles.length === 0 : h.roles.includes(f.roleFilter))
    .filter(h => regionOf(h.city) === regionOf(f.city))
    .filter(h => !adv || ((!fl.idOnly || !!h.checks.id) && (!fl.liveInOnly || h.arrangement === 'livein') && (fl.maxRate == null || h.rate <= fl.maxRate)
      && (!fl.lang || h.languages.includes(fl.lang)) && h.years >= fl.minYears))
    .sort((a, b) => helperFit(f, b) - helperFit(f, a));
}

// How many helpers liked the family. Live families without a pass cannot read who (RLS), only how many (if the server says).
export function likedYouCount(s: AppState): number {
  if (LIVE && !hasPass(s.family)) return s.live?.likedCount ?? 0;
  return likedYouList(s).length;
}

export function likedYouList(s: AppState): Helper[] {
  const f = s.family;
  return helpersOf(s).filter(h => h.likedYou && !f.matches.includes(h.id) && !f.blocked.includes(h.id) && !f.passes.includes(h.id) && regionOf(h.city) === regionOf(f.city));
}

// ---------- yaya → household ----------
export function householdFit(y: YayaState, k: Household): number {
  let s = 0;
  if (k.needs.some(r => y.roles.includes(r))) s += 40;
  if (y.workCities.includes(k.city)) s += 25;
  else if (y.homeCity && k.city === y.homeCity) s += 25;
  else if (y.homeCity && regionOf(k.city) === regionOf(y.homeCity)) s += 8;
  else s -= 30;
  if (k.rateMax >= y.rate) s += 20; else s -= Math.min(30, ((y.rate - k.rateMax) / 1000) * 8);
  if (k.arrangement === y.arrangement) s += 15;
  if (k.daysOff.some(d => y.daysOff.includes(d))) s += 5;
  if (k.languages.some(l => y.langs.includes(l))) s += 4;
  if (k.likedYou) s += 3;
  return s;
}

export function familiesList(s: AppState, chip: 'all' | 'role' | 'arr' | 'near' = 'all'): Household[] {
  const y = s.yaya;
  return householdsOf(s)
    .filter(k => !y.hidden.includes(k.id) && !y.blocked.includes(k.id) && !y.matches.includes(k.id))
    .filter(k => !y.homeCity || regionOf(k.city) === regionOf(y.homeCity))
    .filter(k => chip !== 'role' || k.needs.some(r => y.roles.includes(r)))
    .filter(k => chip !== 'arr' || k.arrangement === y.arrangement)
    .filter(k => chip !== 'near' || y.workCities.includes(k.city) || k.city === y.homeCity)
    .sort((a, b) => householdFit(y, b) - householdFit(y, a));
}

export function familiesLikingYou(s: AppState): Household[] {
  const y = s.yaya;
  return householdsOf(s).filter(k => k.likedYou && !y.matches.includes(k.id) && !y.hidden.includes(k.id) && !y.blocked.includes(k.id)
    && (!y.homeCity || regionOf(k.city) === regionOf(y.homeCity)));
}

export function yayaStrength(y: YayaState): number {
  let n = 0;
  if (y.name) n += 10;
  if (y.homeCity) n += 5;
  if (y.roles.length) n += 15;
  if (y.skills.length) n += 10;
  if (y.workCities.length) n += 10;
  if (y.photo) n += 15;
  if (y.voiceSec || y.bio.trim().length > 20) n += 15;
  if (y.idCheck) n += 15;
  if (y.nbi) n += 5;
  return Math.min(100, n);
}

export function rateFloor(y: YayaState): number {
  return y.homeCity ? minWageFor(y.homeCity).amount : 7800;
}
