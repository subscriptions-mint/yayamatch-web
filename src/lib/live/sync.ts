// Live mode: restores the session, loads the signed-in user's data into the store, and keeps it fresh
// (realtime for the open chat, plus polling every 4 s for the open chat and every 20 s for the inbox).
import { getState, setState, resetState, toast, getUi, setUi, today, defaultLive, defaultFamily, defaultYaya } from '../store';
import type { AppState, Helper, Household, Purchase, FamilyState, Side } from '../types';
import { translate } from '../i18n';
import { nav } from '../router';
import { db, auth, getSession, setSession, sessionFrom, onSession, inList, isMissing, ApiError, type Session } from './client';
import { subscribeMessages, closeRealtime, updateRealtimeToken } from './realtime';
import { BOOT } from './boot';
import * as M from './map';
import type { Row, CheckRow } from './map';

const tr = (key: string, vars?: Record<string, string | number>) => translate(getState().lang, key, vars);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const CHUNK = 80;

// Raw rows kept between polls, so a chat can be rebuilt when one message arrives.
const R = {
  matches: new Map<string, Row>(), // match id -> row
  messages: new Map<string, Row[]>(), // match id -> rows by created_at
  hires: new Map<string, Row>(), // match id -> hire row
};

export const uidNow = (): string | null => getState().live?.uid ?? null;
export const sideNow = (): Side | null => getState().live?.side ?? null;

function chunks<T>(a: T[], n = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}
const uniq = <T,>(a: T[]) => [...new Set(a)];

async function selectIn<T = Row>(table: string, col: string, ids: string[], rest: string): Promise<T[]> {
  if (!ids.length) return [];
  const parts = await Promise.all(chunks(uniq(ids)).map(c => db.select<T>(table, `${col}=${inList(c)}&${rest}`)));
  return parts.flat();
}

export function friendlyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return tr('live.err.network');
    if (e.status === 429) return tr('live.err.tooMany');
  }
  return tr('live.err.generic');
}

// ---------- sign-in lifecycle ----------
let started = false;

/** Called once on load (live build only). */
export async function startLive(): Promise<void> {
  if (started) return;
  started = true;
  onSession(s => { if (s) updateRealtimeToken(s.access_token); });
  if (BOOT.tokens) {
    const s = sessionFrom(BOOT.tokens);
    setSession(s);
    try { const user = await auth.getUser(); setSession({ ...s, user }); } catch { /* keep the id from the token */ }
  }
  if (BOOT.authError) {
    const e = BOOT.authError.toLowerCase();
    window.setTimeout(() => toast(tr(/provider|not enabled|unsupported|disabled/.test(e) ? 'live.err.providerOff' : /expired|invalid/.test(e) ? 'live.err.linkExpired' : 'live.err.signin'), { ms: 6000 }), 300);
  }
  const s = getSession();
  if (!s) { markSignedOut(); return; }
  try {
    const user = await auth.getUser();
    setSession({ ...s, user });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { setSession(null); markSignedOut(); return; }
    // offline: keep the saved data and try again on the next poll
  }
  await afterSignIn();
}

function markSignedOut() {
  setState(d => { d.live = { ...defaultLive(), status: 'out', loaded: true }; });
}

/** After any sign-in (code, password, OAuth). Loads everything, then keeps it fresh. */
export async function afterSignIn(opts: { demo?: boolean } = {}): Promise<void> {
  const s = getSession();
  if (!s) { markSignedOut(); return; }
  const prev = getState().live;
  if (prev?.uid && prev.uid !== s.user.id) {
    // another account was used on this device: start clean
    resetState(getState().lang);
    clearUi();
  }
  setState(d => {
    d.live = { ...(d.live ?? defaultLive()), status: 'in', uid: s.user.id, email: s.user.email ?? null, loaded: false };
  });
  if (opts.demo) {
    // shared sample sign-ins start from a clean copy every time
    try { await db.rpc('reset_my_demo'); } catch (e) { if (!isMissing(e)) console.warn('reset_my_demo', e); }
    R.matches.clear(); R.messages.clear(); R.hires.clear();
    setState(d => {
      d.family = defaultFamily(); d.yaya = defaultYaya();
      d.live = { ...d.live!, helpers: {}, households: {}, likedMe: [], matchOf: {}, hireOf: {} };
    });
  }
  await hydrate();
  startPolling();
}

// Nothing from one account (toasts with Undo, a checkout in progress, a pending ID return) may reach the next one.
function clearUi() {
  setUi({ toasts: [], checkout: null, editing: false, activeChat: null, plansCtx: null, idReturn: null, busy: false });
}

export async function signOutLive(): Promise<void> {
  clearUi();
  stopPolling();
  closeRealtime();
  R.matches.clear(); R.messages.clear(); R.hires.clear();
  await auth.signOut();
  const lang = getState().lang;
  resetState(lang);
  setState(d => { d.live = { ...defaultLive(), status: 'out', loaded: true }; });
}

// ---------- hydrate ----------
export async function hydrate(): Promise<void> {
  const uid = uidNow();
  if (!uid) return;
  try {
    let prof = (await db.select<Row>('profiles', `id=eq.${uid}&select=*`))[0];
    if (!prof) { await sleep(800); prof = (await db.select<Row>('profiles', `id=eq.${uid}&select=*`))[0]; }
    let samples: string[] = [];
    try {
      const r = await db.rpc<unknown[]>('sample_ids');
      samples = (Array.isArray(r) ? r : []).map(x => (typeof x === 'string' ? x : x && typeof x === 'object' ? String(Object.values(x as Row)[0]) : '')).filter(Boolean);
    } catch { /* older backend: no tags */ }
    const side: Side | null = prof?.side === 'family' || prof?.side === 'yaya' ? prof.side : null;
    setState(d => {
      const L = d.live!;
      L.role = prof?.role === 'admin' ? 'admin' : 'user';
      L.side = side;
      L.onboarded = !!prof?.onboarded;
      L.demoLogin = !!prof?.demo_login;
      L.samples = samples;
      if (prof?.email && !L.email) L.email = prof.email;
      if (prof?.lang === 'en' || prof?.lang === 'tl') { if (!d.langChosen) d.lang = prof.lang; }
      d.yaya.phoneShare = typeof prof?.phone === 'string' ? prof.phone : '';
      if (side === 'family') { d.family.verified = true; d.family.onboarded = !!prof?.onboarded; }
      if (side === 'yaya') { d.yaya.verified = true; d.yaya.onboarded = !!prof?.onboarded; }
    });
    if (side === 'family') await loadFamily(uid);
    else if (side === 'yaya') await loadYaya(uid);
    setState(d => { d.live!.loaded = true; });
  } catch (e) {
    console.warn('hydrate', e);
    setState(d => { d.live!.loaded = true; });
    toast(friendlyError(e));
  }
}

function checksBy(rows: CheckRow[]): Map<string, CheckRow[]> {
  const m = new Map<string, CheckRow[]>();
  for (const r of rows) { const a = m.get(r.user_id) ?? []; a.push(r); m.set(r.user_id, a); }
  return m;
}

export function purchasesInto(f: FamilyState, rows: Row[]) {
  const now = Date.now();
  const paid = rows.filter(p => p.status === 'paid');
  const until = (item: string) => {
    const xs = paid.filter(p => p.item === item).map(p => (p.expires_at ? Date.parse(p.expires_at) : Infinity));
    const max = xs.length ? Math.max(...xs) : 0;
    return max > now ? (max === Infinity ? now + 3650 * 86400000 : max) : null;
  };
  f.passUntil = until('pass');
  f.premiumUntil = until('premium');
  f.urgentUntil = until('urgent');
  f.unlocked = uniq(paid.filter(p => p.item === 'chat_unlock' && p.target_id).map(p => String(p.target_id)));
  f.reports = uniq(paid.filter(p => p.item === 'report' && p.target_id).map(p => String(p.target_id)));
  f.purchases = paid.map((p): Purchase => ({
    id: p.id, item: p.item, amount: Number(p.amount) || 0, method: methodLabel(p.method), at: Date.parse(p.paid_at ?? p.created_at) || now,
    ref: refOf(p.id), target: p.target_id ?? undefined,
  }));
}
export const refOf = (purchaseId: string) => 'YM-' + String(purchaseId).replace(/-/g, '').slice(0, 8).toUpperCase();
function methodLabel(m: unknown): string {
  const s = String(m ?? '').toLowerCase();
  if (!s || s === 'test') return 'PayMongo';
  if (s.includes('qr')) return 'QR Ph';
  if (s.includes('gcash')) return 'GCash';
  if (s.includes('maya') || s.includes('paymaya')) return 'Maya';
  if (s.includes('card')) return 'Card';
  return String(m);
}

function ownCheck(rows: CheckRow[], kind: 'id' | 'household_id') {
  const c = rows.find(r => r.kind === kind);
  const status = (c?.status ?? 'none') as 'none' | 'pending' | 'passed' | 'failed' | 'review';
  const month = c ? (M.ym(c.checked_on) ?? M.ym(c.updated_at) ?? M.ym(c.created_at)) : undefined;
  return { status, check: status === 'passed' && month ? { type: M.idTypeOf(c!.id_type), month } : null };
}

async function loadFamily(uid: string) {
  const [card, visible, sent, got, passes, blocks, matches, purchases, hires, mine, reported, likesToday] = await Promise.all([
    db.select('families', `id=eq.${uid}&select=*`),
    db.select('helpers', `select=*&visible=eq.true&id=neq.${uid}&order=updated_at.desc&limit=400`),
    db.select('likes', `from_id=eq.${uid}&select=to_id,created_at`),
    db.select('likes', `to_id=eq.${uid}&select=from_id,created_at`),
    db.select('passes', `user_id=eq.${uid}&select=target_id`),
    db.select('blocks', `user_id=eq.${uid}&select=blocked_id`),
    db.select('matches', `family_id=eq.${uid}&select=*&order=created_at.desc`),
    db.select('purchases', `user_id=eq.${uid}&select=*&order=created_at.desc`),
    db.select('hires', `family_id=eq.${uid}&select=*`),
    db.select<CheckRow>('checks', `user_id=eq.${uid}&select=${M.CHECK_COLS}`),
    db.select('reports', `reporter_id=eq.${uid}&select=target_id`),
    db.rpc<number>('likes_today', { uid }).catch(() => null),
  ]);
  const likedMe = got.map(l => String(l.from_id));
  const matchedIds = matches.map(m => String(m.helper_id));
  const have = new Set(visible.map(h => String(h.id)));
  const extra = await selectIn('helpers', 'id', uniq([...matchedIds, ...likedMe]).filter(id => !have.has(id)), 'select=*');
  const cards = [...visible, ...extra];
  const checks = checksBy(await selectIn<CheckRow>('checks', 'user_id', cards.map(c => String(c.id)), `status=eq.passed&select=${M.CHECK_COLS}`));
  const msgs = await selectIn('messages', 'match_id', matches.map(m => String(m.id)), 'select=*&order=created_at.asc&limit=5000');
  rememberRows(matches, msgs, hires);
  const own = ownCheck(mine, 'household_id');
  const likedCount = passOn(purchases) ? likedMe.length : await likedCountRpc();
  const samples = new Set(getState().live!.samples);
  setState(d => {
    const L = d.live!; const f = d.family;
    if (card[0]) Object.assign(f, M.familyFromCard(card[0], f));
    const helpers: Record<string, Helper> = {};
    // keep cards we saw before for matches the server no longer shows (hidden after a hire)
    for (const id of matchedIds) if (L.helpers[id]) helpers[id] = L.helpers[id];
    for (const r of cards) helpers[r.id] = M.helperFromRow(r, checks.get(r.id) ?? [], likedMe.includes(r.id), samples.has(r.id));
    for (const id of matchedIds) if (!helpers[id]) helpers[id] = M.placeholderHelper(id);
    L.helpers = helpers;
    L.likedMe = likedMe;
    L.likedCount = likedCount;
    L.idStatus = own.status;
    f.idCheck = own.check;
    f.likes = sent.map(l => String(l.to_id));
    f.passes = passes.map(p => String(p.target_id));
    f.blocked = blocks.map(b => String(b.blocked_id));
    f.reported = uniq(reported.map(r => String(r.target_id)));
    purchasesInto(f, purchases);
    f.likeDay = today();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    f.likesUsedToday = typeof likesToday === 'number' ? likesToday : sent.filter(l => Date.parse(l.created_at) >= todayStart.getTime()).length;
    applyMatches(d, 'family', uid);
    f.hires = hires.map(h => ({ helperId: String(h.helper_id), at: Date.parse(h.created_at) || Date.now(), checklist: { ...defaultChecklist(), ...(h.checklist ?? {}) } }));
  });
}

const passOn = (purchases: Row[]) => purchases.some(p => p.status === 'paid' && (p.item === 'pass' || p.item === 'premium') && (!p.expires_at || Date.parse(p.expires_at) > Date.now()));
/** Families without a pass can't read who liked them (RLS). rpc/likes_received_count (0003) gives just the number. */
async function likedCountRpc(): Promise<number> {
  try { return Number(await db.rpc<number>('likes_received_count')) || 0; } catch { return 0; }
}

export const defaultChecklist = () => ({ contract: false, minWage: false, benefits: false, thirteenth: false, rest: false, payslip: false, noFees: false });

async function loadYaya(uid: string) {
  const [card, visible, sent, got, passes, blocks, matches, hires, mine, reported] = await Promise.all([
    db.select('helpers', `id=eq.${uid}&select=*`),
    db.select('families', `select=*&visible=eq.true&id=neq.${uid}&order=updated_at.desc&limit=400`),
    db.select('likes', `from_id=eq.${uid}&select=to_id,created_at`),
    db.select('likes', `to_id=eq.${uid}&select=from_id,created_at`),
    db.select('passes', `user_id=eq.${uid}&select=target_id`),
    db.select('blocks', `user_id=eq.${uid}&select=blocked_id`),
    db.select('matches', `helper_id=eq.${uid}&select=*&order=created_at.desc`),
    db.select('hires', `helper_id=eq.${uid}&select=*`),
    db.select<CheckRow>('checks', `user_id=eq.${uid}&select=${M.CHECK_COLS}`),
    db.select('reports', `reporter_id=eq.${uid}&select=target_id`),
  ]);
  const likedMe = got.map(l => String(l.from_id));
  const matchedIds = matches.map(m => String(m.family_id));
  const have = new Set(visible.map(h => String(h.id)));
  const extra = await selectIn('families', 'id', uniq([...matchedIds, ...likedMe]).filter(id => !have.has(id)), 'select=*');
  const cards = [...visible, ...extra];
  const checks = checksBy(await selectIn<CheckRow>('checks', 'user_id', cards.map(c => String(c.id)), `status=eq.passed&select=${M.CHECK_COLS}`));
  const msgs = await selectIn('messages', 'match_id', matches.map(m => String(m.id)), 'select=*&order=created_at.asc&limit=5000');
  rememberRows(matches, msgs, hires);
  const own = ownCheck(mine, 'id');
  const samples = new Set(getState().live!.samples);
  setState(d => {
    const L = d.live!; const y = d.yaya;
    if (card[0]) Object.assign(y, M.yayaFromCard(card[0], y));
    const households: Record<string, Household> = {};
    for (const id of matchedIds) if (L.households[id]) households[id] = L.households[id];
    for (const r of cards) households[r.id] = M.householdFromRow(r, checks.get(r.id) ?? [], likedMe.includes(r.id), samples.has(r.id));
    for (const id of matchedIds) if (!households[id]) households[id] = M.placeholderHousehold(id);
    L.households = households;
    L.likedMe = likedMe;
    L.idStatus = own.status;
    y.idCheck = own.check;
    y.nbi = mine.some(c => c.kind === 'nbi');
    y.interested = sent.map(l => String(l.to_id));
    y.hidden = passes.map(p => String(p.target_id));
    y.blocked = blocks.map(b => String(b.blocked_id));
    y.reported = uniq(reported.map(r => String(r.target_id)));
    applyMatches(d, 'yaya', uid);
    const done = hires.find(h => h.helper_confirmed);
    y.hired = done ? { householdId: String(done.family_id), at: Date.parse(done.created_at) || Date.now(), confirmed: true } : null;
  });
}

function rememberRows(matches: Row[], msgs: Row[], hires: Row[]) {
  R.matches.clear(); R.messages.clear(); R.hires.clear();
  for (const m of matches) { R.matches.set(m.id, m); R.messages.set(m.id, []); }
  for (const r of msgs) R.messages.get(r.match_id)?.push(r);
  for (const list of R.messages.values()) list.sort(byTime);
  for (const h of hires) R.hires.set(h.match_id, h);
}

/** Rebuilds every chat of the signed-in side from the raw rows. */
function applyMatches(d: AppState, side: Side, uid: string) {
  const L = d.live!;
  const st = side === 'family' ? d.family : d.yaya;
  const list = [...R.matches.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  st.matches = list.map(m => M.otherOf(m, uid));
  L.matchOf = {}; L.hireOf = {};
  const chats: typeof st.chats = {};
  for (const m of list) {
    const other = M.otherOf(m, uid);
    L.matchOf[other] = m.id;
    const hire = R.hires.get(m.id);
    if (hire) L.hireOf[other] = hire.id;
    const name = side === 'family' ? (L.helpers[other]?.firstName ?? '') : (L.households[other]?.name ?? '');
    chats[other] = M.chatFromRows(m, R.messages.get(m.id) ?? [], uid, other, name, !!hire);
    const mine = m.family_id === uid ? m.family_read_at : m.helper_read_at;
    if ((mine || chats[other].messages.some(x => x.from === 'me')) && !st.seenMatches.includes(other)) st.seenMatches.push(other);
    if (getUi().activeChat === (side === 'family' ? 'f-' : 'y-') + other) chats[other].unread = 0;
  }
  st.chats = chats;
}

function rebuild() {
  const uid = uidNow(); const side = sideNow();
  if (!uid || !side) return;
  setState(d => applyMatches(d, side, uid));
}

// ---------- messages ----------
let tmpN = 0;
/** Adds a message we just sent, before the server answers. Returns its temporary id. */
export function addPending(matchId: string, kind: string, body: string, meta: Row = {}): string {
  const id = `tmp-${++tmpN}`;
  const uid = uidNow();
  R.messages.get(matchId)?.push({ id, match_id: matchId, sender_id: uid, kind, body, meta, created_at: new Date().toISOString(), pending: true });
  rebuild();
  return id;
}
export function settlePending(matchId: string, tmp: string, realId: string | null) {
  const list = R.messages.get(matchId);
  if (!list) return;
  const i = list.findIndex(r => r.id === tmp);
  if (i < 0) return;
  if (!realId || list.some(r => r.id === realId)) list.splice(i, 1);
  // keep it until the server copy arrives; its client-side time never moves the "since" cursor
  else list[i] = { ...list[i], id: realId, pending: false, local: true };
  rebuild();
}
export function addMatchRow(m: Row) {
  if (!R.matches.has(m.id)) { R.matches.set(m.id, m); R.messages.set(m.id, []); }
  rebuild();
}
export function addHireRow(h: Row) { R.hires.set(h.match_id, h); rebuild(); }
export function setHireChecklist(matchId: string, checklist: Row) {
  const h = R.hires.get(matchId); if (h) h.checklist = checklist;
}

// Same-transaction rows share created_at (e.g. a message and the sample profile's auto-reply): auto-replies go last.
const byTime = (a: Row, b: Row) => (Date.parse(a.created_at) - Date.parse(b.created_at)) || ((a.meta?.auto ? 1 : 0) - (b.meta?.auto ? 1 : 0));

function mergeMessages(rows: Row[]): boolean {
  let changed = false;
  for (const r of rows) {
    const list = R.messages.get(r.match_id);
    if (!list) continue;
    const same = list.findIndex(x => x.id === r.id);
    if (same >= 0) {
      if (!list[same].local) continue;
      list[same] = r; // the server copy of a message we sent
    } else {
      // a pending row with the same body is the one we sent: replace it
      const p = list.findIndex(x => x.pending && x.sender_id === r.sender_id && x.kind === r.kind && x.body === r.body);
      if (p >= 0) list.splice(p, 1);
      list.push(r);
    }
    list.sort(byTime);
    changed = true;
  }
  return changed;
}

function lastServerAt(matchIds: string[]): string | null {
  let max = '';
  for (const id of matchIds) for (const r of R.messages.get(id) ?? []) if (!r.pending && !r.local && r.created_at > max) max = r.created_at;
  return max || null;
}

/** Fetches new messages for some matches. Returns true when something new arrived. */
export async function pullMessages(matchIds: string[]): Promise<boolean> {
  if (!matchIds.length) return false;
  const since = lastServerAt(matchIds);
  const rows = await selectIn('messages', 'match_id', matchIds, `select=*&order=created_at.asc${since ? `&created_at=gte.${encodeURIComponent(since)}` : ''}`);
  const changed = mergeMessages(rows);
  if (changed) rebuild();
  return changed;
}

// ---------- mark read ----------
const readTimers = new Map<string, number>();
export function markReadSoon(otherId: string) {
  const matchId = getState().live?.matchOf[otherId];
  const uid = uidNow();
  if (!matchId || !uid) return;
  const m = R.matches.get(matchId);
  if (m) { if (m.family_id === uid) m.family_read_at = new Date().toISOString(); else m.helper_read_at = new Date().toISOString(); }
  if (readTimers.has(matchId)) return;
  readTimers.set(matchId, window.setTimeout(() => {
    readTimers.delete(matchId);
    db.rpc('mark_read', { m: matchId }).catch(() => { /* not important */ });
  }, 600));
}

// ---------- open chat ----------
/** While a chat is open: realtime plus a 4 s poll. Returns the cleanup. */
export function watchChat(otherId: string): () => void {
  const matchId = getState().live?.matchOf[otherId];
  if (!matchId) return () => {};
  let alive = true;
  markReadSoon(otherId);
  const tick = async () => {
    if (!alive) return;
    try { if (await pullMessages([matchId])) markReadSoon(otherId); } catch { /* next tick */ }
  };
  const unsub = subscribeMessages(matchId, rec => {
    if (mergeMessages([rec])) { rebuild(); markReadSoon(otherId); }
  });
  const id = window.setInterval(tick, 4000);
  void tick();
  return () => { alive = false; window.clearInterval(id); unsub(); };
}

// ---------- inbox polling ----------
let pollId: number | null = null;
let pollN = 0;
function startPolling() {
  stopPolling();
  pollId = window.setInterval(() => { void refreshInbox(); }, 20000);
}
function stopPolling() { if (pollId) window.clearInterval(pollId); pollId = null; }

/** Every 20 s: new matches, new messages, new likes (and the cards every few minutes). */
export async function refreshInbox(): Promise<void> {
  const uid = uidNow(); const side = sideNow();
  if (!uid || !side || !getState().live?.onboarded) return;
  pollN++;
  if (pollN % 9 === 0) { await hydrate(); return; }
  try {
    const col = side === 'family' ? 'family_id' : 'helper_id';
    const [matches, got] = await Promise.all([
      db.select('matches', `${col}=eq.${uid}&select=*&order=created_at.desc`),
      db.select('likes', `to_id=eq.${uid}&select=from_id`),
    ]);
    const fresh = matches.filter(m => !R.matches.has(m.id));
    for (const m of matches) {
      const old = R.matches.get(m.id);
      if (old) { R.matches.set(m.id, { ...m, family_read_at: laterOf(old.family_read_at, m.family_read_at), helper_read_at: laterOf(old.helper_read_at, m.helper_read_at) }); }
      else { R.matches.set(m.id, m); R.messages.set(m.id, []); }
    }
    const likedMe = got.map(l => String(l.from_id));
    const likedCount = side === 'family' && !likedMe.length ? await likedCountRpc() : likedMe.length;
    const L = getState().live!;
    const known = side === 'family' ? L.helpers : L.households;
    const missing = uniq([...fresh.map(m => M.otherOf(m, uid)), ...likedMe]).filter(id => !known[id]);
    if (missing.length) {
      const rows = await selectIn(side === 'family' ? 'helpers' : 'families', 'id', missing, 'select=*');
      const checks = checksBy(await selectIn<CheckRow>('checks', 'user_id', rows.map(r => String(r.id)), `status=eq.passed&select=${M.CHECK_COLS}`));
      const samples = new Set(L.samples);
      setState(d => {
        for (const r of rows) {
          if (side === 'family') d.live!.helpers[r.id] = M.helperFromRow(r, checks.get(r.id) ?? [], likedMe.includes(r.id), samples.has(r.id));
          else d.live!.households[r.id] = M.householdFromRow(r, checks.get(r.id) ?? [], likedMe.includes(r.id), samples.has(r.id));
        }
      });
    }
    setState(d => {
      const L2 = d.live!;
      L2.likedMe = likedMe;
      L2.likedCount = likedCount;
      if (side === 'family') for (const h of Object.values(L2.helpers)) h.likedYou = likedMe.includes(h.id);
      else for (const k of Object.values(L2.households)) k.likedYou = likedMe.includes(k.id);
    });
    await pullMessages([...R.matches.keys()]);
    rebuild();
    for (const m of fresh) {
      const other = M.otherOf(m, uid);
      const st = getState();
      if (side === 'family') {
        const h = st.live!.helpers[other];
        if (h && st.family.likes.includes(other)) toast(tr('fam.discover.likedBack', { name: h.firstName }), { action: { label: tr('fam.discover.view'), run: () => nav('f-match', other) }, tone: 'ok' });
      } else {
        const k = st.live!.households[other];
        if (k && st.yaya.interested.includes(other)) toast(tr('ya.families.matchedBack', { name: k.name }), { action: { label: tr('ya.families.view'), run: () => nav('y-match', other) }, tone: 'ok' });
      }
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { await signOutLive(); nav('welcome', undefined, { replace: true }); }
  }
}
const laterOf = (a?: string | null, b?: string | null) => (!a ? b ?? null : !b ? a : a > b ? a : b);

export function matchRow(matchId: string): Row | undefined { return R.matches.get(matchId); }
export type { Session };
