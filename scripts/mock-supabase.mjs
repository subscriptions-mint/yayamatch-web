// In-memory stand-in for the YayaMatch Supabase project, for scripts/e2e-live.mjs.
// Implements what the app calls: Auth (email code, password, OAuth redirect, refresh), PostgREST (filters, upsert,
// a light version of the RLS rules in 0001/0002), the RPCs (0001 + 0002, plus the two proposed in 0003),
// the edge functions (test mode, plus switchable "live" Didit / PayMongo returns) and Storage.
// Realtime is not mocked on purpose: the app must keep working on polling alone.
import { randomUUID, randomInt } from 'node:crypto';

const ID_TYPE = { license: 'drivers' };
const ARR = a => (a === 'livein' ? 'live-in' : 'live-out');
const START = s => (s === 'now' ? 'now' : s === '1month' ? '1m' : '2w');
const iso = (d = new Date()) => d.toISOString();
const ymDay = ym => (ym ? `${ym}-15` : null);
const REGION = { cebu: 'r7', davao: 'r11' };

export function createMock({ helpers, households, seedPassword, appUrl }) {
  const T = { profiles: [], families: [], helpers: [], checks: [], likes: [], passes: [], blocks: [], matches: [], messages: [], purchases: [], hires: [], reports: [] };
  const users = new Map(); // email -> { id, email, password }
  const tokens = new Map(); // access or refresh token -> uid
  const storage = new Map(); // bucket/path -> { body, type }
  const mail = {}; // email -> last code
  const calls = []; // rpc and function names, in order
  const flags = { diditLive: false, paymongoLive: false, has0003: true };
  let clock = Date.now() - 3600_000;
  const tick = () => new Date((clock += 1000)).toISOString();

  // ---------- seed data ----------
  const profile = (p) => {
    const row = { id: randomUUID(), side: null, lang: 'en', display_name: null, email: null, phone: null, role: 'user', is_seed: false, seed_likes_new: false,
      onboarded: false, demo_login: false, created_at: tick(), updated_at: iso(), ...p };
    T.profiles.push(row);
    return row;
  };
  const check = (user_id, kind, extra) => T.checks.push({ id: randomUUID(), user_id, kind, status: 'passed', id_type: null, checked_on: null, valid_until: null, age_ok: true, detail: null,
    vendor: 'seed', vendor_ref: null, note: null, created_at: tick(), updated_at: iso(), ...extra });
  const helperRow = (h, id) => ({
    id, first_name: h.firstName, last_initial: h.lastInitial, gender: h.gender, age: h.age, city: h.city, region: REGION[h.city] ?? 'ncr', roles: h.roles,
    years: { [h.roles[0]]: h.years }, years_total: h.years, skills: h.skills, cared_for: [], abroad: false, languages: h.languages, rate: h.rate, arrangement: ARR(h.arrangement),
    days_off: h.daysOff, cities: [h.city], start_in: START(h.startIn), bio: h.bio, favorite: h.favorite, photo_path: 'asset:' + h.photo, voice_path: null,
    voice_seconds: h.voice.sec, voice_script: h.voice.script, quotes: h.quotes, experience: h.experience, available_now: h.startIn === 'now', available_until: null,
    visible: true, hired_at: null, schedule: h.schedule, top_pick: !!h.topPick, updated_at: iso(),
  });
  const familyRow = (k, id) => ({
    id, family_name: k.name.replace(/\s+Family$/, ''), city: k.city, region: REGION[k.city] ?? 'ncr', needs: k.needs, kids: k.kidsAges, elder: false, pets: k.pets,
    languages: k.languages, arrangement: ARR(k.arrangement), schedule: 'full', rest_days: k.daysOff, hours: k.hours, budget_min: k.rateMin, budget_max: k.rateMax,
    perks: k.extras, start_date: k.startDate, about: k.bio, origin: k.origin, household_size: k.size, helper_notes: k.notes, visible: true, house_rule: k.houseRule,
    transport: !!k.transport, updated_at: iso(),
  });
  for (const h of helpers) {
    const p = profile({ side: 'yaya', lang: 'tl', is_seed: true, seed_likes_new: h.likedYou, onboarded: true, display_name: h.firstName });
    T.helpers.push(helperRow(h, p.id));
    check(p.id, 'phone', { checked_on: ymDay(h.checks.phone) });
    if (h.checks.id) check(p.id, 'id', { id_type: ID_TYPE[h.checks.id.type] ?? h.checks.id.type, checked_on: ymDay(h.checks.id.month) });
    if (h.checks.nbi) check(p.id, 'nbi', { valid_until: ymDay(h.checks.nbi), checked_on: '2026-09-01' });
    if (h.checks.refs) check(p.id, 'references', { checked_on: ymDay(h.checks.refs.month), detail: String(h.checks.refs.n) });
  }
  for (const k of households) {
    const p = profile({ side: 'family', lang: 'en', is_seed: true, seed_likes_new: k.likedYou, onboarded: true, display_name: k.name });
    T.families.push(familyRow(k, p.id));
    check(p.id, 'phone', { checked_on: ymDay(k.checks.phone) });
    if (k.checks.id) check(p.id, 'household_id', { checked_on: ymDay(k.checks.id) });
  }
  // the two shared sample sign-ins
  const addUser = (email, password, p) => { const prof = profile({ email, ...p }); users.set(email, { id: prof.id, email, password }); return prof; };
  const kristine = addUser('kristine.seed@example.com', seedPassword, { side: 'yaya', lang: 'tl', is_seed: true, demo_login: true, onboarded: true, display_name: 'Kristine' });
  T.helpers.push({ ...helperRow({ ...helpers[0], firstName: 'Kristine', lastInitial: 'V', city: 'qc', photo: 'kristine.jpg' }, kristine.id) });
  check(kristine.id, 'id', { id_type: 'philid', checked_on: '2026-10-20' });
  const santos = addUser('santos.seed@example.com', seedPassword, { side: 'family', lang: 'en', is_seed: true, demo_login: true, onboarded: true, display_name: 'Santos Family' });
  T.families.push({ ...familyRow({ ...households[1], name: 'Santos Family', city: 'makati' }, santos.id) });
  check(santos.id, 'household_id', { checked_on: '2026-10-20' });
  // an admin, and one ID check waiting for review
  const admin = addUser('admin@yayamatch.test', null, { side: 'family', role: 'admin', onboarded: true, display_name: 'Ops' });
  T.families.push({ ...familyRow({ ...households[2], name: 'Ops Family' }, admin.id), visible: false });
  const reviewee = addUser('joy@example.com', null, { side: 'yaya', lang: 'tl', onboarded: true, display_name: 'Joy' });
  T.helpers.push({ ...helperRow({ ...helpers[3], firstName: 'Joy', lastInitial: 'M' }, reviewee.id), visible: true });
  T.checks.push({ id: randomUUID(), user_id: reviewee.id, kind: 'id', status: 'review', id_type: 'Identity Card', checked_on: null, valid_until: null, age_ok: null,
    detail: null, vendor: 'didit', vendor_ref: 'x', note: 'no birth date read', created_at: tick(), updated_at: iso() });

  // ---------- helpers ----------
  const prof = uid => T.profiles.find(p => p.id === uid);
  const isAdmin = uid => prof(uid)?.role === 'admin';
  const isDemo = uid => !!prof(uid)?.demo_login;
  const isSample = uid => { const p = prof(uid); return !!p && p.is_seed && !p.demo_login; };
  const canSeeCard = (me, card) => (isDemo(me) ? isSample(card) : !isDemo(card));
  const blockedBetween = (a, b) => T.blocks.some(x => (x.user_id === a && x.blocked_id === b) || (x.user_id === b && x.blocked_id === a));
  const hasPass = uid => T.purchases.some(p => p.user_id === uid && p.status === 'paid' && (p.item === 'pass' || p.item === 'premium') && (!p.expires_at || Date.parse(p.expires_at) > Date.now()));
  const isPremium = uid => T.purchases.some(p => p.user_id === uid && p.status === 'paid' && p.item === 'premium' && (!p.expires_at || Date.parse(p.expires_at) > Date.now()));
  const likesToday = uid => { const d = new Date(); d.setHours(0, 0, 0, 0); return T.likes.filter(l => l.from_id === uid && prof(l.to_id)?.side === 'yaya' && Date.parse(l.created_at) >= d.getTime()).length; };
  const chatUnlocked = (fam, helper) => hasPass(fam) || T.purchases.some(p => p.user_id === fam && p.status === 'paid' && p.item === 'chat_unlock' && p.target_id === helper);

  // RLS, roughly as in 0001 + 0002
  const canRead = (table, r, me) => {
    const adm = isAdmin(me);
    switch (table) {
      case 'profiles': return r.id === me || adm;
      case 'families': case 'helpers': return r.id === me || adm || (r.visible && !blockedBetween(me, r.id) && canSeeCard(me, r.id));
      case 'checks': return r.status === 'passed' || r.user_id === me || adm;
      case 'likes': return r.from_id === me || (r.to_id === me && (prof(me)?.side === 'yaya' || hasPass(me))) || adm;
      case 'passes': return r.user_id === me;
      case 'blocks': return r.user_id === me || adm;
      case 'matches': case 'hires': return r.family_id === me || r.helper_id === me || adm;
      case 'messages': { const m = T.matches.find(x => x.id === r.match_id); return adm || (!!m && (m.family_id === me || m.helper_id === me)); }
      case 'purchases': return r.user_id === me || adm;
      case 'reports': return r.reporter_id === me || adm;
      default: return false;
    }
  };
  const canWrite = (table, r, me, op) => {
    const adm = isAdmin(me);
    switch (table) {
      case 'profiles': return op === 'update' && (r.id === me || adm);
      case 'families': return op === 'insert' ? r.id === me && prof(me)?.side === 'family' : r.id === me || adm;
      case 'helpers': return op === 'insert' ? r.id === me && prof(me)?.side === 'yaya' : r.id === me || adm;
      case 'checks': return op === 'update' && adm;
      case 'blocks': return (op === 'insert' || op === 'delete') && r.user_id === me;
      case 'reports': return op === 'insert' ? r.reporter_id === me : op === 'update' && adm;
      default: return false;
    }
  };

  // ---------- PostgREST filters ----------
  function splitTop(s) { // split by commas outside parens
    const out = []; let depth = 0; let cur = '';
    for (const c of s) { if (c === '(') depth++; if (c === ')') depth--; if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c; }
    if (cur) out.push(cur);
    return out;
  }
  function test(val, expr) {
    const i = expr.indexOf('.');
    const op = expr.slice(0, i); const arg = expr.slice(i + 1);
    const s = val == null ? null : typeof val === 'object' ? JSON.stringify(val) : String(val);
    switch (op) {
      case 'eq': return s === arg;
      case 'neq': return s !== arg;
      case 'gt': return s != null && s > arg;
      case 'gte': return s != null && s >= arg;
      case 'lt': return s != null && s < arg;
      case 'lte': return s != null && s <= arg;
      case 'is': return arg === 'null' ? val == null : arg === 'true' ? val === true : val === false;
      case 'in': { const list = arg.replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/^"|"$/g, '')); return list.includes(s); }
      case 'ilike': case 'like': { const re = new RegExp('^' + arg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', op === 'ilike' ? 'i' : ''); return s != null && re.test(s); }
      default: throw new Error('unsupported filter ' + op);
    }
  }
  function applyFilters(rows, params) {
    let out = rows;
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
      if (k === 'or') {
        const parts = splitTop(v.replace(/^\(|\)$/g, ''));
        out = out.filter(r => parts.some(p => { const j = p.indexOf('.'); return test(r[p.slice(0, j)], p.slice(j + 1)); }));
      } else out = out.filter(r => test(r[k], v));
    }
    const order = params.get('order');
    if (order) {
      const [col, dir] = order.split('.');
      out = [...out].sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? -1 : String(a[col] ?? '') > String(b[col] ?? '') ? 1 : 0) * (dir === 'desc' ? -1 : 1));
    }
    const limit = params.get('limit');
    if (limit) out = out.slice(0, Number(limit));
    return out;
  }
  const pickCols = (rows, select) => (!select || select === '*' ? rows : rows.map(r => Object.fromEntries(select.split(',').map(c => [c, r[c]]))));

  // ---------- RPC ----------
  const err = (status, message, code = 'P0001') => ({ status, body: { code, message, details: null, hint: null } });
  const ok = (body, status = 200) => ({ status, body });
  const insertMessage = (m) => { const r = { id: randomUUID(), match_id: m.match_id, sender_id: m.sender_id ?? null, kind: m.kind ?? 'text', body: m.body ?? '', meta: m.meta ?? {}, created_at: m.created_at ?? iso() }; T.messages.push(r); return r; };
  const matchOf = (a, b) => T.matches.find(m => (m.family_id === a && m.helper_id === b) || (m.family_id === b && m.helper_id === a));

  function canSend(me, mid) {
    const mt = T.matches.find(m => m.id === mid);
    if (!mt || (me !== mt.family_id && me !== mt.helper_id)) return 'denied';
    if (blockedBetween(mt.family_id, mt.helper_id)) return 'blocked';
    if (!T.checks.some(c => c.user_id === me && (c.kind === 'id' || c.kind === 'household_id') && c.status === 'passed')) return 'needs_id';
    if (me === mt.helper_id) return 'ok';
    if (chatUnlocked(me, mt.helper_id)) return 'ok';
    if (T.messages.filter(x => x.match_id === mid && x.sender_id === me && x.kind === 'text').length >= 1) return 'locked';
    if (new Set(T.messages.filter(x => x.sender_id === me && x.kind === 'text').map(x => x.match_id)).size >= 3) return 'capped';
    return 'ok';
  }

  const rpcs = {
    like_profile(me, { target }) {
      const mine = prof(me)?.side; const theirs = prof(target)?.side;
      if (!mine || !theirs || mine === theirs) return err(400, 'invalid target');
      if (isDemo(me) && !isSample(target)) return ok({ result: 'blocked' });
      if (blockedBetween(me, target)) return ok({ result: 'blocked' });
      if (T.likes.some(l => l.from_id === me && l.to_id === target)) { const m = matchOf(me, target); return ok({ result: m ? 'match' : 'liked', match_id: m?.id ?? null }); }
      if (mine === 'family' && !hasPass(me) && likesToday(me) >= 10) return ok({ result: 'limit' });
      T.likes.push({ from_id: me, to_id: target, created_at: iso() });
      T.passes = T.passes.filter(p => !(p.user_id === me && p.target_id === target));
      if (isSample(target) && !isSample(me) && !T.likes.some(l => l.from_id === target && l.to_id === me)) T.likes.push({ from_id: target, to_id: me, created_at: iso() });
      if (T.likes.some(l => l.from_id === target && l.to_id === me)) {
        let m = matchOf(me, target);
        if (!m) {
          m = { id: randomUUID(), family_id: mine === 'family' ? me : target, helper_id: mine === 'family' ? target : me, created_at: iso(), last_message_at: iso(), family_read_at: null, helper_read_at: null };
          T.matches.push(m);
          insertMessage({ match_id: m.id, kind: 'system', body: 'matched' });
        }
        return ok({ result: 'match', match_id: m.id });
      }
      return ok({ result: 'liked' });
    },
    pass_profile(me, { target }) { if (!T.passes.some(p => p.user_id === me && p.target_id === target)) T.passes.push({ user_id: me, target_id: target, created_at: iso() }); return ok(null, 204); },
    unpass_profile(me, { target }) { T.passes = T.passes.filter(p => !(p.user_id === me && p.target_id === target)); return ok(null, 204); },
    can_send(me, { m }) { return ok(canSend(me, m)); },
    send_message(me, { m, body, kind = 'text', meta = {} }) {
      if (!['text', 'number', 'plan', 'hired'].includes(kind)) return err(400, 'bad kind');
      const v = canSend(me, m);
      if (kind === 'text' && v !== 'ok') return ok({ result: v });
      if (kind !== 'text' && ['denied', 'blocked', 'needs_id'].includes(v)) return ok({ result: v });
      const mt = T.matches.find(x => x.id === m);
      const at = iso();
      const row = insertMessage({ match_id: m, sender_id: me, kind, body, meta, created_at: at });
      mt.last_message_at = at;
      if (me === mt.family_id) mt.family_read_at = at; else mt.helper_read_at = at;
      const other = me === mt.family_id ? mt.helper_id : mt.family_id;
      if (prof(other)?.is_seed && kind === 'text') {
        const n = T.messages.filter(x => x.match_id === m && x.sender_id === me && x.kind === 'text').length;
        if (n <= 2) {
          const reply = other === mt.helper_id
            ? (n === 1 ? 'Hello po! Salamat po sa message. Opo, interesado po ako. Ano po ang oras ng trabaho at ilang taon po ang mga bata?' : 'Sige po. Pwede po tayong mag-usap muna dito, tapos magkita po tayo kapag okay na sa inyo.')
            : (n === 1 ? 'Hi! Salamat sa interes mo. Pwede ka ba sa stay-out, Lunes hanggang Biyernes, 8 AM hanggang 5 PM?' : 'Salamat! Ano ang pinakamaagang petsa na pwede kang magsimula?');
          insertMessage({ match_id: m, sender_id: other, kind: 'text', body: reply, meta: { auto: true }, created_at: at });
        }
      }
      return ok({ result: 'ok', id: row.id });
    },
    mark_read(me, { m }) { const mt = T.matches.find(x => x.id === m); if (mt) { if (mt.family_id === me) mt.family_read_at = iso(); if (mt.helper_id === me) mt.helper_read_at = iso(); } return ok(null, 204); },
    mark_hired(me, { m, start }) {
      const mt = T.matches.find(x => x.id === m && x.family_id === me);
      if (!mt) return err(400, 'not your match');
      let h = T.hires.find(x => x.match_id === m);
      if (!h) { h = { id: randomUUID(), match_id: m, family_id: mt.family_id, helper_id: mt.helper_id, start_date: start ?? null, family_confirmed: true, helper_confirmed: false, checklist: {}, created_at: iso() }; T.hires.push(h); }
      else h.family_confirmed = true;
      insertMessage({ match_id: m, sender_id: me, kind: 'hired', body: 'hired' });
      return ok(h.id);
    },
    confirm_hired(me, { m }) {
      const mt = T.matches.find(x => x.id === m && x.helper_id === me);
      if (!mt) return err(400, 'not your match');
      const h = T.hires.find(x => x.match_id === m); if (h) h.helper_confirmed = true;
      const card = T.helpers.find(x => x.id === me); if (card) { card.hired_at = iso(); card.visible = false; }
      return ok(null, 204);
    },
    toggle_checklist(me, { h, item }) {
      const hire = T.hires.find(x => x.id === h && x.family_id === me);
      if (!hire) return ok(null);
      if (hire.checklist[item]) delete hire.checklist[item]; else hire.checklist[item] = true;
      return ok(hire.checklist);
    },
    finish_onboarding(me) {
      const s = prof(me)?.side;
      if (!s) return err(400, 'pick a side first');
      prof(me).onboarded = true;
      for (const p of T.profiles) if (p.is_seed && !p.demo_login && p.seed_likes_new && p.side !== s && !T.likes.some(l => l.from_id === p.id && l.to_id === me)) T.likes.push({ from_id: p.id, to_id: me, created_at: iso() });
      return ok(null, 204);
    },
    has_pass(_me, { uid }) { return ok(hasPass(uid)); },
    likes_today(_me, { uid }) { return ok(likesToday(uid)); },
    chat_unlocked(_me, { fam, helper }) { return ok(chatUnlocked(fam, helper)); },
    report_unlocked(_me, { fam, helper }) { return ok(isPremium(fam) || T.purchases.some(p => p.user_id === fam && p.status === 'paid' && p.item === 'report' && p.target_id === helper)); },
    // 0002
    reset_my_demo(me) {
      if (!isDemo(me)) return err(400, 'only for the sample sign-ins');
      const mids = T.matches.filter(m => m.family_id === me || m.helper_id === me).map(m => m.id);
      T.matches = T.matches.filter(m => !mids.includes(m.id));
      T.messages = T.messages.filter(m => !mids.includes(m.match_id));
      T.hires = T.hires.filter(h => !mids.includes(h.match_id));
      T.likes = T.likes.filter(l => l.from_id !== me && l.to_id !== me);
      T.passes = T.passes.filter(p => p.user_id !== me);
      T.blocks = T.blocks.filter(b => b.user_id !== me && b.blocked_id !== me);
      T.purchases = T.purchases.filter(p => p.user_id !== me);
      T.reports = T.reports.filter(r => r.reporter_id !== me);
      const s = prof(me).side; prof(me).phone = null; prof(me).onboarded = true;
      for (const p of T.profiles) if (p.is_seed && !p.demo_login && p.seed_likes_new && p.side !== s) T.likes.push({ from_id: p.id, to_id: me, created_at: iso() });
      return ok(null, 204);
    },
    sample_ids() { return ok(T.profiles.filter(p => p.is_seed && !p.demo_login).map(p => p.id)); },
    set_samples_visible(me, { v }) {
      if (!isAdmin(me)) return err(400, 'admins only');
      let n = 0;
      for (const r of [...T.helpers, ...T.families]) if (isSample(r.id) && r.visible !== v) { r.visible = v; n++; }
      return ok(n);
    },
    // 0003 (proposed in supabase/migrations/0003_live_app.sql)
    likes_received_count(me) { return flags.has0003 ? ok(T.likes.filter(l => l.to_id === me && !blockedBetween(me, l.from_id) && !matchOf(me, l.from_id)).length) : null; },
    admin_review_check(me, { check_id, decision }) {
      if (!flags.has0003) return null;
      if (!isAdmin(me)) return err(400, 'admins only');
      const c = T.checks.find(x => x.id === check_id);
      if (!c) return err(400, 'not found');
      c.status = decision; c.checked_on = decision === 'passed' ? new Date().toISOString().slice(0, 10) : null; c.updated_at = iso();
      return ok(null, 204);
    },
  };

  // ---------- edge functions ----------
  const PRICES = { chat_unlock: 79, pass: 199, premium: 399, report: 99, urgent: 199 };
  const HOURS = { pass: 168, premium: 720, urgent: 72 };
  const withParams = (url, params) => { const u = new URL(url); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); return u.toString(); };
  const functions = {
    'id-check-start'(me, { return_url }) {
      const kind = prof(me)?.side === 'family' ? 'household_id' : 'id';
      let c = T.checks.find(x => x.user_id === me && x.kind === kind);
      if (!c) { c = { id: randomUUID(), user_id: me, kind, status: 'pending', id_type: null, checked_on: null, valid_until: null, age_ok: null, detail: null, created_at: iso(), updated_at: iso() }; T.checks.push(c); }
      c.status = 'pending';
      if (flags.diditLive && !isDemo(me)) {
        // Didit returns to return_url?didit=1&verificationSessionId=…&status=…; the webhook lands a moment later
        setTimeout(() => { c.status = 'passed'; c.id_type = 'Passport'; c.checked_on = new Date().toISOString().slice(0, 10); c.age_ok = true; c.updated_at = iso(); }, 2500);
        return ok({ mode: 'live', url: withParams(withParams(return_url, { didit: '1' }), { verificationSessionId: 'sess-1', status: 'Approved' }), kind });
      }
      return ok({ mode: 'test', kind });
    },
    'id-check-test'(me, { id_type }) {
      const kind = prof(me)?.side === 'family' ? 'household_id' : 'id';
      let c = T.checks.find(x => x.user_id === me && x.kind === kind);
      if (!c) { c = { id: randomUUID(), user_id: me, kind, created_at: iso() }; T.checks.push(c); }
      Object.assign(c, { status: 'passed', id_type: id_type ?? 'philid', checked_on: new Date().toISOString().slice(0, 10), valid_until: null, age_ok: true, detail: null, updated_at: iso() });
      return ok({ status: 'passed', checked_on: c.checked_on, kind, test: true });
    },
    checkout(me, { item, target_id, return_url }) {
      if (!PRICES[item]) return err(400, 'unknown item');
      if (prof(me)?.side !== 'family') return ok({ error: 'helpers never pay' }, 403);
      const p = { id: randomUUID(), user_id: me, item, target_id: target_id ?? null, amount: PRICES[item], status: 'pending', provider: 'test', method: null, paid_at: null, expires_at: null, created_at: iso() };
      T.purchases.push(p);
      if (flags.paymongoLive && !isDemo(me)) {
        setTimeout(() => { if (p.status === 'pending' && !p.cancel) { p.status = 'paid'; p.paid_at = iso(); p.method = 'gcash'; p.expires_at = HOURS[item] ? new Date(Date.now() + HOURS[item] * 3600_000).toISOString() : null; } }, 2500);
        const url = flags.paymongoCancel ? withParams(return_url, { cancelled: p.id }) : withParams(return_url, { paid: p.id });
        if (flags.paymongoCancel) p.cancel = true;
        return ok({ mode: 'live', url, purchase_id: p.id });
      }
      return ok({ mode: 'test', purchase_id: p.id, amount: p.amount });
    },
    'checkout-test'(me, { purchase_id, method }) {
      const p = T.purchases.find(x => x.id === purchase_id && x.user_id === me);
      if (!p) return ok({ error: 'not found' }, 404);
      Object.assign(p, { status: 'paid', paid_at: iso(), method: method ?? 'test', expires_at: HOURS[p.item] ? new Date(Date.now() + HOURS[p.item] * 3600_000).toISOString() : null });
      return ok({ status: 'paid', expires_at: p.expires_at, test: true });
    },
    'biodata-read'() {
      return ok({ mode: 'test', fields: { full_name: 'Kristine Villanueva', age: 27, city: 'Quezon City', roles: ['nanny', 'housekeeper'], years: { nanny: 5, housekeeper: 2 },
        skills: ['childcare', 'cooking', 'laundry', 'tutoring'], languages: ['tagalog', 'english'], rate: 12000, arrangement: 'live-out', days_off: ['sat', 'sun'] } });
    },
  };

  // ---------- auth ----------
  function issue(uid) {
    const access = 'at-' + randomUUID(); const refresh = 'rt-' + randomUUID();
    tokens.set(access, uid); tokens.set(refresh, uid);
    const u = T.profiles.find(p => p.id === uid);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, token_type: 'bearer', user: { id: uid, email: u?.email } };
  }
  function userFor(email) {
    let u = users.get(email);
    if (!u) { const p = profile({ email }); u = { id: p.id, email, password: null }; users.set(email, u); }
    return u;
  }

  // ---------- request handler ----------
  async function handle(req) {
    const url = new URL(req.url);
    const method = req.method;
    const auth = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const me = tokens.get(auth) ?? null;
    const body = req.body;
    const p = url.pathname;

    if (method === 'OPTIONS') return { status: 204, body: null };

    // auth
    if (p === '/auth/v1/otp' && method === 'POST') { const email = String(body.email).toLowerCase(); mail[email] = String(randomInt(100000, 999999)); return ok({}); }
    if (p === '/auth/v1/verify' && method === 'POST') {
      const email = String(body.email).toLowerCase();
      if (!mail[email] || mail[email] !== String(body.token)) return { status: 403, body: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } };
      delete mail[email];
      return ok(issue(userFor(email).id));
    }
    if (p === '/auth/v1/token' && method === 'POST') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const u = users.get(String(body.email).toLowerCase());
        if (!u || !u.password || u.password !== body.password) return { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid login credentials' } };
        return ok(issue(u.id));
      }
      if (grant === 'refresh_token') { const uid = tokens.get(body.refresh_token); if (!uid) return { status: 400, body: { error: 'invalid_grant' } }; return ok(issue(uid)); }
    }
    if (p === '/auth/v1/user' && method === 'GET') {
      if (!me) return { status: 401, body: { msg: 'invalid JWT' } };
      return ok({ id: me, email: prof(me)?.email });
    }
    if (p === '/auth/v1/logout') { tokens.delete(auth); return { status: 204, body: null }; }
    if (p === '/auth/v1/authorize') {
      const provider = url.searchParams.get('provider');
      const back = url.searchParams.get('redirect_to') ?? appUrl;
      let to;
      if (provider === 'google') {
        const s = issue(userFor('oauth.google@example.com').id);
        to = `${back}#access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&token_type=bearer&type=signup`;
      } else {
        to = withParams(back, { error: 'validation_failed', error_description: 'Unsupported provider: provider is not enabled' });
      }
      return { status: 200, html: `<!doctype html><script>location.replace(${JSON.stringify(to)})</script>` };
    }

    // storage
    let m;
    if ((m = /^\/storage\/v1\/object\/public\/(photos|voice)\/(.+)$/.exec(p)) && method === 'GET') {
      const o = storage.get(m[1] + '/' + m[2]);
      return o ? { status: 200, raw: o.body, type: o.type } : { status: 404, body: { message: 'not found' } };
    }
    if ((m = /^\/storage\/v1\/object\/(photos|voice)\/(.+)$/.exec(p)) && method === 'POST') {
      if (!me) return { status: 401, body: { message: 'unauthorized' } };
      if (m[2].split('/')[0] !== me) return { status: 403, body: { message: 'new row violates row-level security policy' } };
      storage.set(m[1] + '/' + m[2], { body: req.raw, type: req.headers['content-type'] });
      return ok({ Key: `${m[1]}/${m[2]}` });
    }

    if (!me) return { status: 401, body: { message: 'JWT expired', code: 'PGRST301' } };

    // functions
    if ((m = /^\/functions\/v1\/([\w-]+)$/.exec(p))) {
      calls.push('fn:' + m[1]);
      const f = functions[m[1]];
      return f ? f(me, body ?? {}) : { status: 404, body: { error: 'no function' } };
    }
    // rpc
    if ((m = /^\/rest\/v1\/rpc\/(\w+)$/.exec(p))) {
      calls.push('rpc:' + m[1]);
      const f = rpcs[m[1]];
      const r = f ? f(me, body ?? {}) : null;
      return r ?? { status: 404, body: { code: 'PGRST202', message: `Could not find the function public.${m[1]}` } };
    }
    // tables
    if ((m = /^\/rest\/v1\/(\w+)$/.exec(p))) {
      const table = m[1];
      const rows = T[table];
      if (!rows) return { status: 404, body: { code: 'PGRST205', message: 'no table' } };
      const params = url.searchParams;
      const prefer = req.headers.prefer ?? '';
      const minimal = prefer.includes('return=minimal');
      if (method === 'GET') return ok(pickCols(applyFilters(rows.filter(r => canRead(table, r, me)), params), params.get('select')));
      if (method === 'POST') {
        const list = Array.isArray(body) ? body : [body];
        const out = [];
        for (const r0 of list) {
          const conflict = params.get('on_conflict');
          const existing = conflict ? rows.find(r => conflict.split(',').every(c => r[c] === r0[c])) : table === 'blocks' ? rows.find(r => r.user_id === r0.user_id && r.blocked_id === r0.blocked_id) : null;
          if (existing && prefer.includes('merge-duplicates')) {
            if (!canWrite(table, existing, me, 'update')) return err(403, 'new row violates row-level security policy', '42501');
            Object.assign(existing, r0); out.push(existing); continue;
          }
          if (existing) return err(409, 'duplicate key value violates unique constraint', '23505');
          const row = { ...(table === 'reports' ? { id: randomUUID(), status: 'open', created_at: iso() } : table === 'blocks' ? { created_at: iso() } : {}), ...r0 };
          if (table === 'families' || table === 'helpers') Object.assign(row, { visible: r0.visible ?? true, quotes: r0.quotes ?? [], experience: r0.experience ?? [], helper_notes: r0.helper_notes ?? [] });
          if (!canWrite(table, row, me, 'insert')) return err(403, 'new row violates row-level security policy', '42501');
          rows.push(row); out.push(row);
        }
        return minimal ? { status: 201, body: null } : ok(out, 201);
      }
      if (method === 'PATCH') {
        const hits = applyFilters(rows.filter(r => canRead(table, r, me) && canWrite(table, r, me, 'update')), params);
        for (const r of hits) {
          const patch = { ...body };
          if (table === 'profiles' && !isAdmin(me)) { delete patch.role; delete patch.is_seed; delete patch.demo_login; if (r.side) delete patch.side; }
          if (table === 'checks') for (const k of Object.keys(patch)) if (!['status', 'note', 'updated_at'].includes(k)) return err(403, `permission denied for column ${k}`, '42501');
          Object.assign(r, patch);
        }
        return minimal ? { status: 204, body: null } : ok(hits);
      }
      if (method === 'DELETE') {
        const hits = applyFilters(rows.filter(r => canWrite(table, r, me, 'delete')), params);
        T[table] = rows.filter(r => !hits.includes(r));
        return { status: 204, body: null };
      }
    }
    return { status: 404, body: { message: 'not mocked: ' + method + ' ' + p } };
  }

  return { T, users, mail, calls, flags, storage, handle, prof, ids: { kristine: kristine.id, santos: santos.id, admin: admin.id, reviewee: reviewee.id } };
}
