// Everything that changes state. Screens only call these.
// Demo build: a local store plus a simulated other side (replies, like-backs, payments).
// Live build (window.__YM_CONFIG__): each action calls Supabase through src/lib/live/actions.ts; there are no timers.
import { getState, setState, toast, getUi, setUi, defaultFamily, defaultYaya, biodataSample, today, resetState } from './store';
import type { Chat, Message, FamilyState, YayaState, Lang, Side, LikeResult, InterestResult, SendResult, PlanInput } from './types';
import { translate, peso, pesoRange, daysLabel, makeT, hoursLabel, workDaysLabel, dateLabel } from './i18n';
import { helperById, householdById, helperFit, householdFit, hasPass, likesLeft, chatUnlocked, openFreeChats, freeChatCap, helperName, rateFloor } from './match';
import { DURATIONS_H, PRICES, type Product, type IdType, AVAILABLE_HOURS, type Role, type Skill, type SpokenLang, type Day, LANGS, ROLES, SKILLS, DAYS } from '../data/constants';
import { nav } from './router';
import { LIVE } from './config';
import * as live from './live/actions';
import { watchChat as liveWatch } from './live/sync';
import { toCity } from './live/map';

export type { LikeResult, InterestResult, SendResult };

const tr = (key: string, vars?: Record<string, string | number>) => translate(getState().lang, key, vars);
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();
const timers = new Set<string>();

/** Runs `cb` with an action's result: right away in the demo, when the server answers in live mode. */
export function settle<T>(v: T | Promise<T>, cb: (v: T) => void): void {
  if (v instanceof Promise) v.then(cb, () => { /* the action already showed a toast */ });
  else cb(v);
}

function newChat(id: string): Chat {
  return { id, matchedAt: now(), messages: [], openerUsed: false, unread: 0, typing: false, theyShared: false, iShared: false, callAt: null, replies: 0, hired: false };
}
function msg(from: Message['from'], text: string, kind: Message['kind'] = 'text', meta?: Message['meta']): Message {
  return { id: uid(), from, text, at: now(), kind, meta };
}
const month = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// ---------- shared ----------
export function setLang(lang: Lang, chosen = true) {
  setState(s => { s.lang = lang; if (chosen) s.langChosen = true; });
  if (LIVE && chosen) live.saveLang(lang);
}
export function enterSide(side: 'family' | 'yaya') {
  const s = getState();
  if (!s.langChosen) setState(d => { d.lang = side === 'yaya' ? 'tl' : 'en'; });
}
export function resetDemo() {
  const lang = getState().lang;
  timers.clear();
  resetState(lang);
  setUi({ checkout: null, editing: false, activeChat: null, plansCtx: null, idReturn: null });
  toast(translate(lang, 'toasts.reset'));
}
export function logout(side: 'family' | 'yaya') {
  if (LIVE) { void live.signOut(); return; }
  setState(s => { if (side === 'family') s.family.verified = false; else s.yaya.verified = false; });
}

// ---------- auth (live) ----------
export const sendSignInCode = live.sendCode;
export const verifySignInCode = live.verifyCode;
export const signInSample = live.signInSample;
export const signInTestAccount = live.signInTestAccount;
export const signInWith = live.oauth;
export const chooseSide = live.chooseSide;

// ---------- auth (demo) ----------
export function setPhone(side: 'family' | 'yaya', phone: string) {
  setState(s => { s[side].phone = phone; });
}
export function verifyPhone(side: 'family' | 'yaya') {
  setState(s => { s[side].verified = true; });
}

// ---------- family onboarding ----------
export function patchFamily(p: Partial<FamilyState>) {
  setState(s => { Object.assign(s.family, p); });
  if (LIVE) live.scheduleCardSave();
}
export function finishFamilyOnboarding() {
  if (LIVE) { void live.finishOnboarding('family'); return; }
  setState(s => { s.family.onboarded = true; });
}

// ---------- family: discover ----------
export function likeHelper(id: string): LikeResult | Promise<LikeResult> {
  if (LIVE) return live.likeHelper(id);
  const s = getState();
  const f = s.family;
  if (likesLeft(f) <= 0) return 'limit';
  const h = helperById(id);
  if (!h) return 'liked';
  setState(d => {
    const ff = d.family;
    if (ff.likeDay !== today()) { ff.likeDay = today(); ff.likesUsedToday = 0; }
    if (!hasPass(ff)) ff.likesUsedToday += 1;
    if (!ff.likes.includes(id)) ff.likes.push(id);
  });
  if (h.likedYou) { createFamilyMatch(id); return 'match'; }
  // simulate a like-back for good fits
  if (helperFit(getState().family, h) >= 55 && !timers.has('lb-' + id)) {
    timers.add('lb-' + id);
    setTimeout(() => {
      timers.delete('lb-' + id);
      const st = getState().family;
      if (!st.likes.includes(id) || st.matches.includes(id) || st.blocked.includes(id)) return;
      createFamilyMatch(id);
      toast(tr('fam.discover.likedBack', { name: h.firstName }), { action: { label: tr('fam.discover.view'), run: () => nav('f-match', id) }, tone: 'ok' });
    }, 4500 + Math.random() * 3000);
  }
  return 'liked';
}
export function passHelper(id: string) {
  if (LIVE) { live.passProfile('family', id); return; }
  setState(s => { if (!s.family.passes.includes(id)) s.family.passes.push(id); });
}
export function resetPasses() {
  if (LIVE) { live.resetPassed('family'); return; }
  setState(s => { s.family.passes = []; });
}
export function createFamilyMatch(id: string) {
  setState(s => {
    const f = s.family;
    if (!f.likes.includes(id)) f.likes.push(id);
    if (!f.matches.includes(id)) f.matches.unshift(id);
    if (!f.chats[id]) f.chats[id] = newChat(id);
  });
}
export function markMatchSeen(side: 'family' | 'yaya', id: string) {
  setState(s => { if (!s[side].seenMatches.includes(id)) s[side].seenMatches.push(id); });
  if (LIVE) live.markSeen(id);
}

// ---------- family: chat ----------
/** What the family may send right now. The household ID check comes first (both modes). */
export function familyCanSend(id: string): SendResult {
  const f = getState().family;
  const c = f.chats[id];
  if (!c) return 'locked';
  if (!f.idCheck) return 'needs_id';
  if (chatUnlocked(f, id)) return 'ok';
  if (c.openerUsed) return 'locked';
  if (openFreeChats(f) >= freeChatCap) return 'capped';
  return 'ok';
}
export function sendFamilyMessage(id: string, text: string): SendResult | Promise<SendResult> {
  const body = text.trim();
  if (!body) return 'empty';
  const can = familyCanSend(id);
  if (can !== 'ok') return can;
  if (LIVE) return live.sendMessage('family', id, body);
  setState(s => {
    const c = s.family.chats[id];
    c.messages.push(msg('me', body));
    if (!chatUnlocked(s.family, id)) c.openerUsed = true;
  });
  scheduleHelperReply(id, body);
  return 'ok';
}

function helperReplyText(id: string, incoming: string): string {
  const h = helperById(id)!;
  const f = getState().family;
  const c = f.chats[id];
  const T = makeT('tl');
  const low = incoming.toLowerCase();
  const arr = h.arrangement === 'livein' ? 'stay-in' : 'stay-out';
  const days = daysLabel(T, h.daysOff);
  const start = { now: 'kahit kailan po, kahit bukas', '2weeks': 'sa loob ng dalawang linggo', '1month': 'sa susunod na buwan' }[h.startIn];
  if (c.replies === 0) {
    const fits = f.arrangement === h.arrangement;
    return `Hello po! Salamat po sa message. ${fits ? `Opo, okay po sa akin ang ${arr}.` : `Ang hanap ko po talaga ay ${arr}, pero pwede po nating pag-usapan.`} ${days} po ang day off ko. Pwede po ba tayong mag-usap muna sa phone para magkakilala?`;
  }
  if (/call|tawag|interview|phone|meet|kita/.test(low)) return 'Sige po! Pwede po ako ng gabi, mga 7 PM. I-send n’yo lang po ang plano dito sa chat.';
  if (/start|simula|kailan|when/.test(low)) return `Pwede po akong magsimula ${start}.`;
  if (/rate|salary|sahod|sweldo|magkano|pay/.test(low)) return `Ang hinihingi ko po ay ${peso(h.rate)} kada buwan, pero bukas po akong pag-usapan.`;
  if (/day off|rest|pahinga|off/.test(low)) return `${days} po ang day off ko. Okay lang po ba iyon sa inyo?`;
  if (/kid|bata|alaga|years|taon|experience|karanasan/.test(low)) return `${h.years} taon na po ako sa trabaho. ${h.experience[0] ? `Pinakahuli po: ${h.experience[0].text}.` : ''}`.trim();
  if (/contract|kontrata|sss|philhealth|pag-ibig/.test(low)) return 'Opo, gusto ko po ng nakasulat na kontrata, at SSS, PhilHealth at Pag-IBIG. Salamat po!';
  if (/hire|tanggap|offer|start on|join/.test(low)) return 'Maraming salamat po! Excited na po ako. Ano po ang mga kailangan kong dalhin?';
  const pool = ['Salamat po sa pagtanong! May iba pa po ba kayong gustong malaman?', 'Opo, kaya ko po iyan.', 'Sige po, noted. Salamat po!', 'Opo. Pwede rin po kayong tumawag sa reference ko kung gusto n’yo.'];
  return pool[c.replies % pool.length];
}

function scheduleHelperReply(id: string, incoming: string) {
  const key = 'hr-' + id + '-' + now();
  timers.add(key);
  setTimeout(() => setState(s => { const c = s.family.chats[id]; if (c) c.typing = true; }), 700);
  setTimeout(() => {
    timers.delete(key);
    const st = getState();
    const c0 = st.family.chats[id];
    if (!c0 || st.family.blocked.includes(id)) return;
    const text = helperReplyText(id, incoming);
    const h = helperById(id)!;
    setState(s => {
      const c = s.family.chats[id];
      c.typing = false;
      c.messages.push(msg('them', text));
      c.replies += 1;
      if (getUi().activeChat !== 'f-' + id) c.unread += 1;
      if (!c.theyShared && (c.replies >= 3 || (c.callAt && c.replies >= 2))) {
        c.theyShared = true;
        c.messages.push(msg('system', '', 'number', { who: h.firstName, number: `0917 555 ${String(1000 + (parseInt(id.slice(2)) * 37) % 9000).slice(0, 4)}` }));
      }
    });
  }, 1900 + Math.random() * 1400);
}

/** "Plan a call or meeting": a plan card in the chat. No calls happen inside the app. */
export function planFamilyCall(id: string, p: PlanInput): SendResult | Promise<SendResult> {
  if (!getState().family.idCheck) return 'needs_id';
  if (LIVE) return live.sendPlan('family', id, p);
  setState(s => {
    const c = s.family.chats[id];
    if (!c) return;
    c.callAt = p.at;
    c.messages.push(msg('me', '', 'plan', { at: p.at, how: p.how, note: p.note, mine: true }));
  });
  setTimeout(() => setState(s => {
    const c = s.family.chats[id];
    if (!c) return;
    c.messages.push(msg('them', 'Sige po, salamat! Nakita ko po ang plano. See you po.'));
    c.replies += 1;
    if (getUi().activeChat !== 'f-' + id) c.unread += 1;
  }), 1600);
  return 'ok';
}

export function markFamilyHired(id: string) {
  if (LIVE) { void live.markHired(id); return; }
  setState(s => {
    const f = s.family;
    if (!f.hires.find(h => h.helperId === id)) f.hires.unshift({ helperId: id, at: now(), checklist: { contract: false, minWage: false, benefits: false, thirteenth: false, rest: false, payslip: false, noFees: false } });
    const c = f.chats[id];
    if (c) { c.hired = true; c.messages.push(msg('system', '', 'hired', { at: now() })); }
  });
}
export function toggleChecklist(id: string, key: string) {
  if (LIVE) { void live.toggleChecklist(id, key); return; }
  setState(s => { const h = s.family.hires.find(x => x.helperId === id); if (h) h.checklist[key] = !h.checklist[key]; });
}
export function readChat(side: 'family' | 'yaya', id: string) {
  const c = getState()[side].chats[id];
  if (c && c.unread) setState(s => { s[side].chats[id].unread = 0; });
}
/** Live: keeps an open chat fresh (realtime + 4 s poll). Returns the cleanup. The demo needs nothing. */
export function watchChat(id: string): () => void {
  if (!LIVE) return () => {};
  return liveWatch(id);
}

export function blockParty(side: 'family' | 'yaya', id: string) {
  setState(s => {
    const p = s[side];
    if (!p.blocked.includes(id)) p.blocked.push(id);
  });
  if (LIVE) live.block(id);
}
export function unblockParty(side: 'family' | 'yaya', id: string) {
  setState(s => { s[side].blocked = s[side].blocked.filter(x => x !== id); });
  if (LIVE) live.unblock(id);
}
export function reportParty(side: 'family' | 'yaya', id: string, reason = 'other', note = '') {
  setState(s => { if (!s[side].reported.includes(id)) s[side].reported.push(id); });
  if (LIVE) live.report(id, reason, note);
}

// ---------- family: filters ----------
export function setRoleFilter(r: FamilyState['roleFilter']) { setState(s => { s.family.roleFilter = r; }); }
export function setFilters(fl: FamilyState['filters']) { setState(s => { s.family.filters = fl; }); }

// ---------- purchases (families only; helpers never pay) ----------
export function openPlans(kind: NonNullable<ReturnType<typeof getUi>['plansCtx']>['kind'], returnTo: string, target?: string) {
  setUi({ plansCtx: { kind, returnTo, target } });
  nav('f-plans');
}
export function startCheckout(item: Product, returnTo: string, target?: string) {
  if (LIVE) { void live.startCheckout(item, returnTo, target); return; }
  setUi({ checkout: { item, returnTo, target, side: 'family' } });
  nav('f-checkout');
}
/** Demo: records the purchase. Live (test mode): the server marks it paid. Resolves to the receipt reference. */
export function completePurchase(item: Product, method: string, target?: string): string | null | Promise<string | null> {
  if (LIVE) return live.completeTestPurchase(method);
  const ref = 'YM-' + String(Math.floor(10000 + Math.random() * 89999));
  setState(s => {
    const f = s.family;
    const t = now();
    f.purchases.unshift({ id: uid(), item, amount: PRICES[item], method, at: t, ref, target });
    const add = (DURATIONS_H[item] ?? 0) * 3600000;
    if (item === 'chat_unlock' && target && !f.unlocked.includes(target)) f.unlocked.push(target);
    if (item === 'pass') f.passUntil = Math.max(t, f.passUntil ?? 0) + add;
    if (item === 'premium') f.premiumUntil = Math.max(t, f.premiumUntil ?? 0) + add;
    if (item === 'urgent') f.urgentUntil = Math.max(t, f.urgentUntil ?? 0) + add;
    if (item === 'report' && target && !f.reports.includes(target)) f.reports.push(target);
  });
  return ref;
}
export const waitForPaid = live.waitForPaid;
export const purchaseRef = live.purchaseRef;

// ---------- yaya onboarding ----------
export function patchYaya(p: Partial<YayaState>) {
  setState(s => { Object.assign(s.yaya, p); });
  if (LIVE) live.scheduleCardSave();
}
export function applyBiodata() { setState(s => { Object.assign(s.yaya, biodataSample()); }); }

/** Live: reads a biodata photo on the server and fills in the answers. Resolves false when it could not. */
export async function readBiodataPhoto(file: File): Promise<boolean> {
  const f = await live.readBiodata(file);
  if (!f) return false;
  const y = getState().yaya;
  const parts = (f.full_name ?? '').trim().split(/\s+/).filter(Boolean);
  const roles = (f.roles ?? []).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
  const years: Partial<Record<Role, number>> = {};
  for (const [k, v] of Object.entries(f.years ?? {})) if ((ROLES as readonly string[]).includes(k)) years[k as Role] = Math.max(0, Math.round(Number(v) || 0));
  const city = toCity(f.city ?? '') ?? y.homeCity;
  const patch: Partial<YayaState> = {
    fromBiodata: true,
    name: parts[0] ?? y.name,
    lastInitial: parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : y.lastInitial,
    age: typeof f.age === 'number' && f.age >= 18 ? Math.min(70, f.age) : y.age,
    homeCity: city,
    roles: roles.length ? roles : y.roles,
    yearsByRole: Object.keys(years).length ? years : y.yearsByRole,
    skills: (f.skills ?? []).filter((x): x is Skill => (SKILLS as readonly string[]).includes(x)),
    langs: ((f.languages ?? []).filter((x): x is SpokenLang => (LANGS as readonly string[]).includes(x))),
    arrangement: f.arrangement === 'live-in' ? 'livein' : f.arrangement === 'live-out' ? 'liveout' : y.arrangement,
    daysOff: (f.days_off ?? []).filter((x): x is Day => (DAYS as readonly string[]).includes(x)),
    workCities: y.workCities.length ? y.workCities : city ? [city] : [],
  };
  if (!patch.skills!.length) delete patch.skills;
  if (!patch.langs!.length) delete patch.langs;
  if (!patch.daysOff!.length) delete patch.daysOff;
  setState(s => { Object.assign(s.yaya, patch); });
  if (typeof f.rate === 'number') setState(s => { s.yaya.rate = Math.max(rateFloor(s.yaya), Math.round(f.rate! / 500) * 500); });
  return true;
}

export function startManualYaya() { setState(s => { s.yaya.fromBiodata = false; }); }
export function finishYayaOnboarding() {
  if (LIVE) { void live.finishOnboarding('yaya'); return; }
  setState(s => { s.yaya.onboarded = true; });
}

/** Photo for the yaya card. Demo: a small data URL. Live: uploaded to storage. */
export async function setYayaPhoto(file: File, readSmall: (f: File) => Promise<string>): Promise<boolean> {
  if (LIVE) {
    const url = await live.uploadPhoto(file);
    if (!url) return false;
    patchYaya({ photo: url });
    return true;
  }
  try { patchYaya({ photo: await readSmall(file) }); return true; } catch { return false; }
}
/** Voice intro. Live: uploaded to storage (when the browser gave us a recording). */
export async function setYayaVoice(blob: Blob | null, sec: number): Promise<void> {
  if (LIVE && blob) {
    const url = await live.uploadVoice(blob);
    patchYaya({ voiceSec: sec, voiceUrl: url ?? getState().yaya.voiceUrl });
    return;
  }
  patchYaya({ voiceSec: sec });
}

// ---------- ID checks (both sides: required before the first message) ----------
/** Demo: local result. */
export function setIdChecked(side: Side, type: IdType) {
  setState(s => { s[side].idCheck = { type, month: month() }; });
}
/** 'test': run the in-app ID photo and selfie screens. 'redirect': leaving for Didit. */
export function startIdCheck(side: Side): 'test' | 'redirect' | 'error' | Promise<'test' | 'redirect' | 'error'> {
  if (LIVE) return live.startIdCheck(side);
  return 'test';
}
/** After the selfie. Demo: passes after a short wait. Live test mode: the server records a passed check. */
export function finishIdCheck(side: Side, type: IdType): Promise<boolean> {
  if (LIVE) return live.finishTestIdCheck(side, type);
  return new Promise(res => setTimeout(() => { setIdChecked(side, type); res(true); }, 2700));
}
export const pollIdCheck = live.pollIdCheck;
export const consumeDidit = live.consumeDidit;

export function toggleAvailable(on: boolean) {
  const until = on ? now() + AVAILABLE_HOURS * 3600000 : null;
  setState(s => { s.yaya.availableUntil = until; });
  if (LIVE) live.setAvailable(until);
}

// ---------- yaya: families ----------
export function interestHousehold(id: string): InterestResult | Promise<InterestResult> {
  if (LIVE) return live.interestHousehold(id);
  const k = householdById(id);
  if (!k) return 'sent';
  setState(s => { if (!s.yaya.interested.includes(id)) s.yaya.interested.push(id); });
  if (k.likedYou) { createYayaMatch(id); return 'match'; }
  if (householdFit(getState().yaya, k) >= 50 && !timers.has('ylb-' + id)) {
    timers.add('ylb-' + id);
    setTimeout(() => {
      timers.delete('ylb-' + id);
      const y = getState().yaya;
      if (!y.interested.includes(id) || y.matches.includes(id) || y.blocked.includes(id)) return;
      createYayaMatch(id);
      toast(tr('ya.families.matchedBack', { name: k.name }), { action: { label: tr('ya.families.view'), run: () => nav('y-match', id) }, tone: 'ok' });
    }, 4500 + Math.random() * 3000);
  }
  return 'sent';
}
export function hideHousehold(id: string) {
  if (LIVE) { live.passProfile('yaya', id); return; }
  setState(s => { if (!s.yaya.hidden.includes(id)) s.yaya.hidden.push(id); });
}
export function unhideHousehold(id: string) {
  if (LIVE) { live.unpassProfile('yaya', id); return; }
  setState(s => { s.yaya.hidden = s.yaya.hidden.filter(x => x !== id); });
}
export function resetHidden() {
  if (LIVE) { live.resetPassed('yaya'); return; }
  setState(s => { s.yaya.hidden = []; });
}

export function createYayaMatch(id: string) {
  const fresh = !getState().yaya.chats[id];
  setState(s => {
    const y = s.yaya;
    if (!y.interested.includes(id)) y.interested.push(id);
    if (!y.matches.includes(id)) y.matches.unshift(id);
    if (!y.chats[id]) y.chats[id] = newChat(id);
  });
  if (fresh) {
    // families who liked first open the conversation
    const k = householdById(id)!;
    setTimeout(() => setState(s => { const c = s.yaya.chats[id]; if (c) c.typing = true; }), 1200);
    setTimeout(() => setState(s => {
      const c = s.yaya.chats[id];
      if (!c || s.yaya.blocked.includes(id)) return;
      const name = s.yaya.name || 'po';
      const opener = k.id === 'k-13'
        ? `Hi ${name}! Nagustuhan namin ang routine mo para sa mga bata. Pwede ba tayong mag-usap sa phone bukas ng 7 PM?`
        : k.languages.includes('tagalog') || k.languages.includes('bisaya')
          ? `Hi ${name}! Nagustuhan namin ang profile mo. Pwede ba tayong mag-usap muna dito, tapos sa phone?`
          : `Hi ${name}! We like your profile. Can we chat here first, then talk on the phone this week?`;
      c.typing = false;
      c.messages.push(msg('them', opener));
      c.replies += 1;
      if (getUi().activeChat !== 'y-' + id) c.unread += 1;
    }), 3200);
  }
}

/** What the yaya may send right now: her own ID check comes first. */
export function yayaCanSend(id: string): SendResult {
  const y = getState().yaya;
  if (!y.chats[id]) return 'locked';
  if (!y.idCheck) return 'needs_id';
  return 'ok';
}
export function sendYayaMessage(id: string, text: string): SendResult | Promise<SendResult> {
  const body = text.trim();
  if (!body) return 'empty';
  const can = yayaCanSend(id);
  if (can !== 'ok') return can;
  if (LIVE) return live.sendMessage('yaya', id, body);
  setState(s => { s.yaya.chats[id].messages.push(msg('me', body)); });
  scheduleFamilyReply(id, body);
  return 'ok';
}

function familyReplyText(id: string, incoming: string): { text: string; hire?: boolean; plan?: number } {
  const k = householdById(id)!;
  const y = getState().yaya;
  const c = y.chats[id];
  const T = makeT('tl');
  const low = incoming.toLowerCase();
  const tagalog = k.languages.includes('tagalog') || k.languages.includes('bisaya');
  const range = pesoRange(k.rateMin, k.rateMax);
  const work = workDaysLabel(T, k.daysOff);
  const off = daysLabel(T, k.daysOff);
  const myMsgs = c.messages.filter(m => m.from === 'me').length;
  if ((c.callAt && myMsgs >= 3) || myMsgs >= 5) {
    if (!c.hired) {
      const start = k.startDate ? dateLabel(T, k.startDate) : 'sa susunod na Lunes';
      return { text: tagalog ? `Gusto ka naming i-hire, ${y.name || 'po'}! Pwede ka bang magsimula sa ${start}? Ipapadala namin ang kontrata.` : `We would like to hire you, ${y.name}! Could you start on ${start}? We will send the contract.`, hire: true };
    }
  }
  if (/call|tawag|phone|usap/.test(low)) {
    const at = nextAt(1, 19);
    return { text: tagalog ? 'Sige! Bukas ng 7 PM, tawag sa phone, okay ba? Inilagay ko ang plano dito.' : 'Great! Tomorrow at 7 PM, a phone call, okay? I put the plan here.', plan: at };
  }
  if (/oras|hours|time|schedule/.test(low)) return { text: k.hours ? `${work}, ${hoursLabel(k.hours)}. Day off ang ${off}.` : tagalog ? `Stay-in, at ${off} ang day off. Pag-uusapan natin ang oras na komportable sa’yo.` : `It is live-in, with ${off} off. We will agree on hours together.` };
  if (/pamasahe|fare|transport/.test(low)) return { text: k.transport || k.extras.includes('load') ? (tagalog ? 'Oo, may pamasahe at load allowance kada buwan.' : 'Yes, we cover transport and a phone load allowance.') : (tagalog ? 'Stay-in ang setup kaya hindi na kailangan, pero sagot namin ang pamasahe pauwi minsan sa isang taon.' : 'It is live-in, and we cover your fare home once a year.') };
  if (/kwarto|room/.test(low)) return { text: k.extras.includes('ownRoom') ? (tagalog ? 'Oo, may sarili kang kwarto na may electric fan at kandado.' : 'Yes, you will have your own room with a lock.') : (tagalog ? 'Stay-out ang setup, kaya uuwi ka gabi-gabi.' : 'It is a live-out job, so you go home every evening.') };
  if (/sahod|sweldo|pay|salary|magkano|rate/.test(low)) return { text: tagalog ? `Ang alok namin ay ${range} kada buwan, plus 13th month at SSS, PhilHealth at Pag-IBIG.` : `We offer ${range} a month, plus 13th month pay and SSS, PhilHealth and Pag-IBIG.` };
  if (/kontrata|contract/.test(low)) return { text: tagalog ? 'Oo, gagamit tayo ng Form BK-1 ng DOLE. May kopya ka at ang barangay.' : 'Yes, we will use DOLE Form BK-1. You and the barangay each get a copy.' };
  const pool = tagalog
    ? ['Salamat! May tanong ka pa ba para sa amin?', 'Ayos! Gusto ka rin naming makilala nang mas mabuti.', 'Noted, salamat sa pagsagot.']
    : ['Thank you! Any questions for us?', 'Great, we would love to get to know you better.', 'Noted, thanks for answering.'];
  return { text: pool[c.replies % pool.length] };
}

function nextAt(daysAhead: number, hour: number): number {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function scheduleFamilyReply(id: string, incoming: string) {
  setTimeout(() => setState(s => { const c = s.yaya.chats[id]; if (c) c.typing = true; }), 700);
  setTimeout(() => {
    const st = getState();
    if (!st.yaya.chats[id] || st.yaya.blocked.includes(id)) return;
    const r = familyReplyText(id, incoming);
    const k = householdById(id)!;
    setState(s => {
      const c = s.yaya.chats[id];
      c.typing = false;
      c.messages.push(msg('them', r.text));
      c.replies += 1;
      if (r.plan && !c.callAt) { c.callAt = r.plan; c.messages.push(msg('them', '', 'plan', { at: r.plan, how: 'phone', note: '' })); }
      if (r.hire && !c.hired) { c.hired = true; c.messages.push(msg('system', '', 'hired', { at: now(), who: k.name })); }
      if (getUi().activeChat !== 'y-' + id) c.unread += 1;
    });
  }, 1900 + Math.random() * 1400);
}

export function planYayaCall(id: string, p: PlanInput): SendResult | Promise<SendResult> {
  if (!getState().yaya.idCheck) return 'needs_id';
  if (LIVE) return live.sendPlan('yaya', id, p);
  setState(s => { const c = s.yaya.chats[id]; if (!c) return; c.callAt = p.at; c.messages.push(msg('me', '', 'plan', { at: p.at, how: p.how, note: p.note, mine: true })); });
  return 'ok';
}
/** Share-number, after the yaya ticks the three pre-checks. Live: `phone` is saved privately first. */
export function shareYayaNumber(id: string, phone?: string): SendResult | Promise<SendResult> {
  if (!getState().yaya.idCheck) return 'needs_id';
  if (LIVE) return live.shareNumber(id, phone ?? getState().yaya.phoneShare);
  setState(s => { const c = s.yaya.chats[id]; if (!c) return; c.iShared = true; c.messages.push(msg('system', '', 'number', { mine: true })); });
  return 'ok';
}
export function confirmYayaHired(id: string): boolean | Promise<boolean> {
  if (LIVE) return live.confirmHired(id);
  setState(s => { s.yaya.hired = { householdId: id, at: now(), confirmed: true }; s.yaya.visible = false; s.yaya.availableUntil = null; });
  return true;
}
export function setYayaVisible(v: boolean) {
  setState(s => { s.yaya.visible = v; });
  if (LIVE) live.setVisible(v);
}

// ---------- helpers for screens ----------
export function freshFamily() { setState(s => { s.family = defaultFamily(); }); }
export function freshYaya() { setState(s => { s.yaya = defaultYaya(); }); }
export const helperLabel = (id: string) => { const h = helperById(id); return h ? helperName(h) : ''; };
