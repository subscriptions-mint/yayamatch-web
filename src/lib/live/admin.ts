// Admin console data (live only). RLS lets profiles.role = 'admin' read and update these tables.
import { db, inList, isMissing } from './client';
import { uidNow } from './sync';
import { CHECK_COLS, type CheckRow, familyDisplayName, type Row } from './map';

export interface Person {
  id: string; email: string | null; name: string; side: 'family' | 'yaya' | null; role: string; isSeed: boolean; demoLogin: boolean;
  onboarded: boolean; visible: boolean | null; city: string | null; createdAt: string;
}
export interface AdminReport { id: string; reason: string; note: string | null; status: string; createdAt: string; reporter?: Person; target?: Person; targetId: string }
export interface AdminReview { check: CheckRow; person?: Person }

const clean = (q: string) => q.replace(/[^\p{L}\p{N}@._ -]/gu, '').trim().slice(0, 60);

async function peopleByIds(ids: string[]): Promise<Map<string, Person>> {
  const u = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, Person>();
  if (!u.length) return out;
  const parts: string[][] = [];
  for (let i = 0; i < u.length; i += 80) parts.push(u.slice(i, i + 80));
  const [profiles, helpers, families] = await Promise.all([
    Promise.all(parts.map(p => db.select('profiles', `id=${inList(p)}&select=id,email,display_name,side,role,is_seed,demo_login,onboarded,created_at`))).then(x => x.flat()),
    Promise.all(parts.map(p => db.select('helpers', `id=${inList(p)}&select=id,first_name,last_initial,visible,city`))).then(x => x.flat()),
    Promise.all(parts.map(p => db.select('families', `id=${inList(p)}&select=id,family_name,visible,city`))).then(x => x.flat()),
  ]);
  const h = new Map(helpers.map(r => [r.id as string, r]));
  const f = new Map(families.map(r => [r.id as string, r]));
  for (const p of profiles) {
    const card: Row | undefined = h.get(p.id) ?? f.get(p.id);
    const name = h.has(p.id) ? `${card!.first_name ?? ''} ${card!.last_initial ? card!.last_initial + '.' : ''}`.trim()
      : f.has(p.id) ? familyDisplayName(String(card!.family_name ?? '')) : '';
    out.set(p.id, {
      id: p.id, email: p.email ?? null, name: name || p.display_name || p.email || p.id.slice(0, 8), side: p.side ?? null, role: p.role ?? 'user',
      isSeed: !!p.is_seed, demoLogin: !!p.demo_login, onboarded: !!p.onboarded, visible: card ? card.visible !== false : null,
      city: card?.city ?? null, createdAt: p.created_at,
    });
  }
  return out;
}

export async function loadReports(onlyOpen: boolean): Promise<AdminReport[]> {
  const rows = await db.select('reports', `select=*&order=created_at.desc&limit=150${onlyOpen ? '&status=in.(open,reviewing)' : ''}`);
  const people = await peopleByIds(rows.flatMap(r => [r.reporter_id, r.target_id]));
  return rows.map(r => ({ id: r.id, reason: r.reason, note: r.note ?? null, status: r.status, createdAt: r.created_at, reporter: people.get(r.reporter_id), target: people.get(r.target_id), targetId: r.target_id }));
}

export async function resolveReport(id: string, status: 'actioned' | 'dismissed'): Promise<void> {
  await db.update('reports', `id=eq.${id}`, { status, resolved_at: new Date().toISOString(), resolved_by: uidNow() }, false);
}

export async function loadReviews(): Promise<AdminReview[]> {
  const rows = await db.select<CheckRow>('checks', `status=eq.review&select=${CHECK_COLS}&order=updated_at.desc&limit=100`);
  const people = await peopleByIds(rows.map(r => r.user_id));
  return rows.map(c => ({ check: c, person: people.get(c.user_id) }));
}

/**
 * Pass or fail a check that is under review. Prefers rpc/admin_review_check (0003), which also sets checked_on.
 * Without it, only status can be changed (column grants), and the app shows the review date instead.
 */
export async function decideReview(checkId: string, decision: 'passed' | 'failed'): Promise<'ok' | 'nodate'> {
  try {
    await db.rpc('admin_review_check', { check_id: checkId, decision });
    return 'ok';
  } catch (e) {
    if (!isMissing(e)) throw e;
  }
  await db.update('checks', `id=eq.${checkId}`, { status: decision, updated_at: new Date().toISOString() }, false);
  return decision === 'passed' ? 'nodate' : 'ok';
}

export async function searchMembers(q: string): Promise<Person[]> {
  const s = clean(q);
  let ids: string[];
  if (!s) {
    const rows = await db.select('profiles', 'select=id&order=created_at.desc&limit=40');
    ids = rows.map(r => r.id);
  } else {
    const like = encodeURIComponent(`*${s}*`);
    const [a, b, c] = await Promise.all([
      db.select('profiles', `or=(email.ilike.${like},display_name.ilike.${like})&select=id&limit=40`),
      db.select('helpers', `first_name=ilike.${like}&select=id&limit=40`),
      db.select('families', `family_name=ilike.${like}&select=id&limit=40`),
    ]);
    ids = [...a, ...b, ...c].map(r => r.id);
  }
  const people = await peopleByIds(ids);
  return ids.filter((id, i) => ids.indexOf(id) === i).map(id => people.get(id)).filter((p): p is Person => !!p);
}

export async function setCardVisible(p: Person, visible: boolean): Promise<void> {
  await db.update(p.side === 'family' ? 'families' : 'helpers', `id=eq.${p.id}`, { visible }, false);
}

export async function samplesState(): Promise<{ total: number; visible: number }> {
  const r = await db.rpc<unknown[]>('sample_ids');
  const ids = (Array.isArray(r) ? r : []).map(x => (typeof x === 'string' ? x : x && typeof x === 'object' ? String(Object.values(x as Row)[0]) : '')).filter(Boolean);
  const people = await peopleByIds(ids);
  const cards = [...people.values()].filter(p => p.visible !== null);
  return { total: cards.length, visible: cards.filter(p => p.visible).length };
}

/** rpc/set_samples_visible (0002). Returns how many cards changed. */
export async function setSamplesVisible(v: boolean): Promise<number> {
  const n = await db.rpc<number>('set_samples_visible', { v });
  return Number(n) || 0;
}
