// Live implementations of the actions in src/lib/actions.ts. Screens never import this file directly.
// Each one updates the store right away where that is safe, then asks the server, and puts things back if it says no.
import { getState, setState, toast, setUi, getUi } from '../store';
import type { AppState, Side, LikeResult, InterestResult, SendResult, PlanInput, CheckStatus } from '../types';
import { translate } from '../i18n';
import { nav } from '../router';
import { CONFIG, appUrl } from '../config';
import type { IdType, Product } from '../../data/constants';
import { hasPass, likesLeft } from '../match';
import { db, fn, storage, auth, uuid, ApiError } from './client';
import {
  afterSignIn, signOutLive, hydrate, addPending, settlePending, addMatchRow, addHireRow, setHireChecklist, pullMessages, markReadSoon,
  friendlyError, uidNow, defaultChecklist, refOf, purchasesInto, refreshInbox,
} from './sync';
import { BOOT, RETURN_KEY } from './boot';
import * as M from './map';
import { resizeToBlob, toJpegBase64, dataUrlToBlob } from './media';

const tr = (key: string, vars?: Record<string, string | number>) => translate(getState().lang, key, vars);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const me = () => uidNow() ?? '';
const L = () => getState().live!;
const ss = {
  set(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  take(k: string) { try { const v = sessionStorage.getItem(k); sessionStorage.removeItem(k); return v; } catch { return null; } },
};
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// ---------- sign-in ----------
export async function sendCode(email: string): Promise<'ok' | 'error' | 'limit'> {
  try { await auth.sendEmailCode(email); return 'ok'; } catch (e) { return e instanceof ApiError && e.status === 429 ? 'limit' : 'error'; }
}

export async function verifyCode(email: string, code: string): Promise<'ok' | 'wrong' | 'error'> {
  try { await auth.verifyEmailCode(email, code); } catch (e) {
    return e instanceof ApiError && e.status >= 400 && e.status < 500 ? 'wrong' : 'error';
  }
  await afterSignIn();
  return 'ok';
}

export async function signInSample(email: string): Promise<boolean> {
  if (!CONFIG?.seedPassword) return false;
  try { await auth.signInWithPassword(email, CONFIG.seedPassword); } catch { toast(tr('live.err.sample')); return false; }
  await afterSignIn({ demo: true });
  return true;
}

export function oauth(provider: 'google' | 'facebook') {
  location.assign(auth.oauthUrl(provider));
}

export async function signOut() {
  await signOutLive();
  nav('welcome', undefined, { replace: true });
}

/** First choice after sign-up. The server keeps the side fixed afterwards. */
export async function chooseSide(side: Side): Promise<boolean> {
  const st = getState();
  const lang = st.langChosen ? st.lang : side === 'yaya' ? 'tl' : 'en';
  try {
    await db.update('profiles', `id=eq.${me()}`, { side, lang }, false);
  } catch (e) { toast(friendlyError(e)); return false; }
  setState(d => { d.live!.side = side; d.lang = lang; d[side].verified = true; });
  return true;
}

let langTimer: number | null = null;
export function saveLang(lang: 'en' | 'tl') {
  if (!uidNow()) return;
  if (langTimer) window.clearTimeout(langTimer);
  langTimer = window.setTimeout(() => { db.update('profiles', `id=eq.${me()}`, { lang }, false).catch(() => {}); }, 700);
}

// ---------- own card ----------
let cardTimer: number | null = null;
/** After onboarding, edits save themselves shortly after the last change. */
export function scheduleCardSave() {
  if (!L()?.onboarded) return;
  if (cardTimer) window.clearTimeout(cardTimer);
  cardTimer = window.setTimeout(() => { void saveCard().catch(e => toast(friendlyError(e))); }, 900);
}

async function saveCard(): Promise<void> {
  const st = getState(); const uid = me();
  if (L().side === 'family') {
    await db.insert('families', M.cardFromFamily(st.family, uid), { upsert: true, onConflict: 'id', returning: false });
    return;
  }
  const y = st.yaya;
  let photoPath = M.photoPathOf(y.photo);
  if (!photoPath && y.photo && y.photo.startsWith('data:')) {
    const url = await uploadPhotoBlob(dataUrlToBlob(y.photo));
    photoPath = storage.pathOf('photos', url);
    setState(d => { d.yaya.photo = url; });
  }
  const voicePath = y.voiceUrl ? storage.pathOf('voice', y.voiceUrl) : null;
  await db.insert('helpers', M.cardFromYaya(getState().yaya, uid, photoPath, voicePath), { upsert: true, onConflict: 'id', returning: false });
}

export async function finishOnboarding(side: Side): Promise<void> {
  // optimistic, so the next screen is allowed right away
  setState(d => { d.live!.onboarded = true; d[side].onboarded = true; });
  try {
    await saveCard();
    await db.rpc('finish_onboarding');
  } catch (e) {
    setState(d => { d.live!.onboarded = false; d[side].onboarded = false; });
    toast(friendlyError(e));
    nav(side === 'family' ? 'f-setup' : 'y-intro', undefined, { replace: true });
    return;
  }
  setState(d => { d.live!.loaded = false; });
  await hydrate();
}

// ---------- likes and passes ----------
async function openMatch(other: string, matchId: string) {
  try {
    const [m] = await db.select('matches', `id=eq.${matchId}&select=*`);
    const side = L().side;
    addMatchRow(m ?? { id: matchId, family_id: side === 'family' ? me() : other, helper_id: side === 'family' ? other : me(), created_at: new Date().toISOString() });
    await pullMessages([matchId]);
  } catch { /* the 20 s poll picks it up */ }
}

export async function likeHelper(id: string): Promise<LikeResult> {
  const f = getState().family;
  if (likesLeft(f) <= 0) return 'limit';
  const counted = !hasPass(f);
  const had = f.likes.includes(id);
  setState(d => { if (!had) d.family.likes.push(id); if (counted && !had) d.family.likesUsedToday += 1; });
  const undo = () => setState(d => { if (!had) d.family.likes = d.family.likes.filter(x => x !== id); if (counted && !had) d.family.likesUsedToday = Math.max(0, d.family.likesUsedToday - 1); });
  try {
    const r = await db.rpc<{ result: string; match_id?: string }>('like_profile', { target: id });
    if (r.result === 'limit') { undo(); setState(d => { d.family.likesUsedToday = 10; }); return 'limit'; }
    if (r.result === 'blocked') { undo(); return 'error'; }
    if (r.result === 'match' && r.match_id) { await openMatch(id, r.match_id); return 'match'; }
    return 'liked';
  } catch (e) { undo(); toast(friendlyError(e)); return 'error'; }
}

export async function interestHousehold(id: string): Promise<InterestResult> {
  const had = getState().yaya.interested.includes(id);
  setState(d => { if (!had) d.yaya.interested.push(id); });
  try {
    const r = await db.rpc<{ result: string; match_id?: string }>('like_profile', { target: id });
    if (r.result === 'match' && r.match_id) { await openMatch(id, r.match_id); return 'match'; }
    if (r.result === 'blocked') { if (!had) setState(d => { d.yaya.interested = d.yaya.interested.filter(x => x !== id); }); return 'error'; }
    return 'sent';
  } catch (e) {
    if (!had) setState(d => { d.yaya.interested = d.yaya.interested.filter(x => x !== id); });
    toast(friendlyError(e)); return 'error';
  }
}

const listOf = (d: AppState, side: Side): string[] => (side === 'family' ? d.family.passes : d.yaya.hidden);
const setList = (d: AppState, side: Side, v: string[]) => { if (side === 'family') d.family.passes = v; else d.yaya.hidden = v; };
export function passProfile(side: Side, id: string) {
  setState(d => { const a = listOf(d, side); if (!a.includes(id)) setList(d, side, [...a, id]); });
  db.rpc('pass_profile', { target: id }).catch(e => toast(friendlyError(e)));
}
export function unpassProfile(side: Side, id: string) {
  setState(d => setList(d, side, listOf(d, side).filter(x => x !== id)));
  db.rpc('unpass_profile', { target: id }).catch(e => toast(friendlyError(e)));
}
export function resetPassed(side: Side) {
  const ids = [...listOf(getState(), side)];
  setState(d => setList(d, side, []));
  Promise.all(ids.map(id => db.rpc('unpass_profile', { target: id }))).catch(e => toast(friendlyError(e)));
}

export function markSeen(otherId: string) { markReadSoon(otherId); }

// ---------- messages ----------
function onNeedsId(side: Side) {
  setState(d => { d[side].idCheck = null; if (d.live!.idStatus === 'passed') d.live!.idStatus = 'none'; });
}

export async function sendMessage(side: Side, other: string, body: string, kind: 'text' | 'number' | 'plan' = 'text', meta: Record<string, unknown> = {}): Promise<SendResult> {
  const matchId = L().matchOf[other];
  if (!matchId) return 'locked';
  const tmp = addPending(matchId, kind, body, meta);
  try {
    const r = await db.rpc<{ result: string; id?: string }>('send_message', { m: matchId, body, kind, meta });
    if (r.result !== 'ok') {
      settlePending(matchId, tmp, null);
      if (r.result === 'needs_id') onNeedsId(side);
      return (['locked', 'capped', 'needs_id', 'blocked', 'denied'].includes(r.result) ? r.result : 'error') as SendResult;
    }
    settlePending(matchId, tmp, r.id ?? null);
    // sample profiles answer inside the same call, so look for the reply right away
    void pullMessages([matchId]).then(() => markReadSoon(other)).catch(() => {});
    return 'ok';
  } catch (e) {
    settlePending(matchId, tmp, null);
    toast(friendlyError(e));
    return 'error';
  }
}

const HOW_EN: Record<string, string> = { messenger: 'Messenger', viber: 'Viber', phone: 'Phone call', in_person: 'In person' };
export function sendPlan(side: Side, other: string, p: PlanInput): Promise<SendResult> {
  const when = new Date(p.at);
  const body = `Plan · ${HOW_EN[p.how]} · ${when.toISOString()}${p.note ? ` · ${p.note}` : ''}`.slice(0, 500);
  return sendMessage(side, other, body, 'plan', { when: when.toISOString(), how: p.how, note: p.note.slice(0, 300) });
}

export async function shareNumber(other: string, phone: string): Promise<SendResult> {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits !== getState().yaya.phoneShare.replace(/\D/g, '').slice(-10)) {
    try { await db.update('profiles', `id=eq.${me()}`, { phone: '+63' + digits }, false); } catch (e) { toast(friendlyError(e)); return 'error'; }
    setState(d => { d.yaya.phoneShare = '+63' + digits; });
  }
  const pretty = `+63 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  const r = await sendMessage('yaya', other, pretty, 'number');
  if (r === 'ok') setState(d => { const c = d.yaya.chats[other]; if (c) c.iShared = true; });
  return r;
}

// ---------- hire ----------
export async function markHired(other: string): Promise<boolean> {
  const matchId = L().matchOf[other];
  if (!matchId) return false;
  setState(d => {
    if (!d.family.hires.find(h => h.helperId === other)) d.family.hires.unshift({ helperId: other, at: Date.now(), checklist: defaultChecklist() });
    const c = d.family.chats[other]; if (c) c.hired = true;
  });
  try {
    const hid = await db.rpc<string>('mark_hired', { m: matchId, start: null });
    addHireRow({ id: hid, match_id: matchId, family_id: me(), helper_id: other, checklist: {}, created_at: new Date().toISOString() });
    setState(d => { d.live!.hireOf[other] = String(hid); });
    void pullMessages([matchId]).catch(() => {});
    return true;
  } catch (e) {
    setState(d => { d.family.hires = d.family.hires.filter(h => h.helperId !== other); });
    toast(friendlyError(e));
    return false;
  }
}

export async function toggleChecklist(helperId: string, key: string) {
  const hid = L().hireOf[helperId];
  setState(d => { const h = d.family.hires.find(x => x.helperId === helperId); if (h) h.checklist[key] = !h.checklist[key]; });
  if (!hid) return;
  try {
    const cl = await db.rpc<Record<string, boolean>>('toggle_checklist', { h: hid, item: key });
    const matchId = L().matchOf[helperId];
    if (matchId && cl) setHireChecklist(matchId, cl);
    setState(d => { const h = d.family.hires.find(x => x.helperId === helperId); if (h && cl) h.checklist = { ...defaultChecklist(), ...cl }; });
  } catch (e) {
    setState(d => { const h = d.family.hires.find(x => x.helperId === helperId); if (h) h.checklist[key] = !h.checklist[key]; });
    toast(friendlyError(e));
  }
}

export async function confirmHired(familyId: string): Promise<boolean> {
  const matchId = L().matchOf[familyId];
  if (!matchId) return false;
  try { await db.rpc('confirm_hired', { m: matchId }); } catch (e) { toast(friendlyError(e)); return false; }
  setState(d => { d.yaya.hired = { householdId: familyId, at: Date.now(), confirmed: true }; d.yaya.visible = false; d.yaya.availableUntil = null; });
  return true;
}

// ---------- safety ----------
export function block(id: string) {
  db.insert('blocks', { user_id: me(), blocked_id: id }, { returning: false }).catch(e => { if (!(e instanceof ApiError && e.status === 409)) toast(friendlyError(e)); });
}
export function unblock(id: string) {
  db.remove('blocks', `user_id=eq.${me()}&blocked_id=eq.${id}`).catch(e => toast(friendlyError(e)));
}
export function report(id: string, reason: string, note: string) {
  db.insert('reports', { reporter_id: me(), target_id: id, reason, note: note.trim() || null }, { returning: false }).catch(e => toast(friendlyError(e)));
}

// ---------- yaya card switches ----------
export function setAvailable(until: number | null) {
  db.update('helpers', `id=eq.${me()}`, { available_now: !!until, available_until: until ? new Date(until).toISOString() : null }, false).catch(e => toast(friendlyError(e)));
}
export function setVisible(v: boolean) {
  db.update('helpers', `id=eq.${me()}`, { visible: v }, false).catch(e => toast(friendlyError(e)));
}

// ---------- uploads ----------
async function uploadPhotoBlob(blob: Blob): Promise<string> {
  const path = `${me()}/${uuid()}.jpg`;
  await storage.upload('photos', path, blob);
  return storage.publicUrl('photos', path);
}
export async function uploadPhoto(file: File): Promise<string | null> {
  try { return await uploadPhotoBlob(await resizeToBlob(file, 900)); } catch (e) { toast(friendlyError(e)); return null; }
}
export async function uploadVoice(blob: Blob): Promise<string | null> {
  const ext = /ogg/.test(blob.type) ? 'ogg' : /mp4|aac|m4a/.test(blob.type) ? 'm4a' : 'webm';
  try {
    const path = `${me()}/${uuid()}.${ext}`;
    await storage.upload('voice', path, blob);
    return storage.publicUrl('voice', path);
  } catch (e) { toast(friendlyError(e)); return null; }
}

// ---------- biodata ----------
export interface BiodataFields { full_name?: string | null; age?: number | null; city?: string | null; roles?: string[]; years?: Record<string, number>; skills?: string[]; languages?: string[]; rate?: number | null; arrangement?: string | null; days_off?: string[] }

export async function readBiodata(file: File): Promise<BiodataFields | null> {
  try {
    const image_base64 = await toJpegBase64(file, 1600);
    const r = await fn<{ mode: string; fields: BiodataFields }>('biodata-read', { image_base64, media_type: 'image/jpeg' });
    return r?.fields ?? null;
  } catch { return null; }
}

// ---------- payments ----------
const CHECKOUT_KEY = 'ym-checkout';

export async function startCheckout(item: Product, returnTo: string, target?: string): Promise<void> {
  if (getUi().busy) return;
  setUi({ busy: true });
  try {
    const r = await fn<{ mode: 'live' | 'test'; url?: string; purchase_id: string }>('checkout', { item, target_id: target ?? null, return_url: appUrl() });
    if (r.mode === 'live' && r.url) {
      ss.set(RETURN_KEY, '#f-checkout');
      ss.set(CHECKOUT_KEY, JSON.stringify({ item, target, returnTo, purchaseId: r.purchase_id }));
      location.assign(r.url);
      return;
    }
    setUi({ checkout: { item, target, returnTo, side: 'family', purchaseId: r.purchase_id }, busy: false });
    nav('f-checkout');
  } catch (e) {
    setUi({ busy: false });
    toast(friendlyError(e));
  }
}

async function refreshPurchases() {
  const rows = await db.select('purchases', `user_id=eq.${me()}&select=*&order=created_at.desc`);
  const hadPass = hasPass(getState().family);
  setState(d => purchasesInto(d.family, rows));
  // a new pass opens the received likes (RLS): load them now
  if (!hadPass && hasPass(getState().family)) void refreshInbox();
  return rows;
}

/** Test mode: the simulated payment screens finish here. */
export async function completeTestPurchase(method: string): Promise<string | null> {
  const pid = getUi().checkout?.purchaseId;
  if (!pid) return null;
  try {
    const r = await fn<{ status: string }>('checkout-test', { purchase_id: pid, method });
    if (r.status !== 'paid') return null;
    await refreshPurchases();
    return refOf(pid);
  } catch (e) { toast(friendlyError(e)); return null; }
}

/** Back from PayMongo: the webhook marks the purchase paid, usually within seconds. */
export async function waitForPaid(pid: string, tries = 24): Promise<'paid' | 'pending' | 'failed'> {
  for (let i = 0; i < tries; i++) {
    try {
      const rows = await refreshPurchases();
      const p = rows.find(x => x.id === pid);
      if (p?.status === 'paid') return 'paid';
      if (p?.status === 'failed' || p?.status === 'expired') return 'failed';
    } catch { /* retry */ }
    await sleep(2500);
  }
  return 'pending';
}

export const purchaseRef = refOf;

// ---------- ID check ----------
const ID_RETURN_KEY = 'ym-id-return';

export async function startIdCheck(side: Side): Promise<'test' | 'redirect' | 'error'> {
  try {
    const r = await fn<{ mode: string; url?: string }>('id-check-start', { return_url: appUrl() });
    if (r.mode === 'live' && r.url) {
      ss.set(RETURN_KEY, side === 'family' ? '#f-idcheck' : '#y-idcheck');
      ss.set(ID_RETURN_KEY, getUi().idReturn ?? '');
      location.assign(r.url);
      return 'redirect';
    }
    setState(d => { d.live!.idStatus = 'pending'; });
    return 'test';
  } catch (e) { toast(friendlyError(e)); return 'error'; }
}

export async function finishTestIdCheck(side: Side, type: IdType): Promise<boolean> {
  try {
    const r = await fn<{ status: string; checked_on?: string }>('id-check-test', { id_type: M.idTypeToServer(type) });
    if (r.status !== 'passed') return false;
    const month = M.ym(r.checked_on) ?? thisMonth();
    setState(d => { d[side].idCheck = { type, month }; d.live!.idStatus = 'passed'; });
    return true;
  } catch (e) { toast(friendlyError(e)); return false; }
}

/** After Didit: wait until the webhook has stored the result. */
export async function pollIdCheck(side: Side, tries = 40): Promise<CheckStatus> {
  const kind = side === 'family' ? 'household_id' : 'id';
  for (let i = 0; i < tries; i++) {
    try {
      const rows = await db.select<M.CheckRow>('checks', `user_id=eq.${me()}&kind=eq.${kind}&select=${M.CHECK_COLS}`);
      const c = rows[0];
      const status = (c?.status ?? 'pending') as CheckStatus;
      if (status !== 'pending') {
        const month = c ? (M.ym(c.checked_on) ?? M.ym(c.updated_at)) : undefined;
        setState(d => {
          d.live!.idStatus = status;
          d[side].idCheck = status === 'passed' && c && month ? { type: M.idTypeOf(c.id_type), month } : null;
        });
        return status;
      }
    } catch { /* retry */ }
    await sleep(3000);
  }
  return 'pending';
}

/** Returns from Didit and PayMongo, read once after the first load. The ID screen then calls consumeDidit(). */
export function takeReturns() {
  if (BOOT.didit) {
    const back = ss.take(ID_RETURN_KEY);
    if (back) setUi({ idReturn: back });
  }
  if (BOOT.paid || BOOT.cancelled) {
    let ctx: { item: Product; target?: string; returnTo: string } | null = null;
    try { ctx = JSON.parse(ss.take(CHECKOUT_KEY) ?? 'null'); } catch { ctx = null; }
    if (BOOT.paid) {
      setUi({ checkout: { item: ctx?.item ?? 'pass', target: ctx?.target, returnTo: ctx?.returnTo ?? 'f-discover', side: 'family', purchaseId: BOOT.paid, returned: 'paid' } });
      nav('f-checkout', undefined, { replace: true });
    } else {
      setUi({ checkout: null });
      toast(tr('live.payCancelled'), { ms: 5000 });
      nav(ctx?.returnTo ?? 'f-plans', undefined, { replace: true });
    }
    BOOT.paid = undefined; BOOT.cancelled = undefined;
  }
}
/** True once, right after coming back from Didit. */
export function consumeDidit(): boolean { const v = !!BOOT.didit; BOOT.didit = undefined; return v; }
