// Admin console (#admin, live only, profiles.role = 'admin'): reports, ID reviews, members, sample profiles.
import { useEffect, useState } from 'react';
import { useT, ago } from '../../lib/i18n';
import { useStore, toast } from '../../lib/store';
import { back } from '../../lib/router';
import { Screen, TopBar, Button, Tag, Card, Empty, Toggle, Field, Avatar, Note, Icon } from '../../components/ui';
import { SlimHeader, PageHead } from '../../components/desktop';
import { useIsDesktop } from '../../lib/useIsDesktop';
import * as A from '../../lib/live/admin';
import type { Person, AdminReport, AdminReview } from '../../lib/live/admin';

type Tab = 'reports' | 'reviews' | 'members' | 'samples';

export function Admin() {
  const t = useT();
  const L = useStore(s => s.live);
  const desk = useIsDesktop();
  const [tab, setTab] = useState<Tab>('reports');
  const home = !L?.side ? 'welcome' : L.side === 'family' ? 'f-me' : 'y-me';
  const tabs: [Tab, string, string][] = [['reports', 'flag', t('admin.tabs.reports')], ['reviews', 'id', t('admin.tabs.reviews')], ['members', 'users', t('admin.tabs.members')], ['samples', 'star', t('admin.tabs.samples')]];
  const bar = (
    <div className="seg admin__tabs" role="tablist" aria-label={t('admin.title')}>
      {tabs.map(([k, ic, label]) => (
        <button key={k} type="button" role="tab" aria-selected={tab === k ? 'true' : 'false'} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)} data-testid={`admin-tab-${k}`}>
          <Icon name={ic} size={16} /><span>{label}</span>
        </button>
      ))}
    </div>
  );
  const body = tab === 'reports' ? <Reports /> : tab === 'reviews' ? <Reviews /> : tab === 'members' ? <Members /> : <Samples />;
  return (
    <Screen tone="cream" label={t('admin.title')} nav={<SlimHeader back={home} home={home} />} desk="admin"
      header={desk ? <PageHead title={t('admin.title')} sub={L?.email ?? ''} /> : <TopBar onBack={() => back(home)} title={t('admin.title')} sub={L?.email ?? ''} />}>
      <div className="pad-s admin" data-testid="admin">
        {bar}
        <div className="admin__body">{body}</div>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]): [T | null, boolean, () => void, string | null] {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setBusy(true); setErr(null);
    load().then(d => { if (alive) { setData(d); setBusy(false); } }, e => { if (alive) { setErr(String(e?.message ?? e)); setBusy(false); } });
    return () => { alive = false; };
  }, [...deps, n]);
  return [data, busy, () => setN(x => x + 1), err];
}

function Loading({ busy, err, empty }: { busy: boolean; err: string | null; empty: boolean }) {
  const t = useT();
  if (busy) return <div className="admin__state"><span className="spinner" /></div>;
  if (err) return <Note tone="warn" icon="alert">{t('admin.failed', { msg: err })}</Note>;
  if (empty) return <Card><Empty icon="check" title={t('admin.none')} /></Card>;
  return null;
}

function Who({ p, fallback }: { p?: Person; fallback?: string }) {
  const t = useT();
  if (!p) return <span className="muted">{fallback ?? t('admin.unknown')}</span>;
  return (
    <span className="admin__who">
      <b>{p.name}</b>
      {p.email && <small>{p.email}</small>}
      <span className="tags">
        <Tag tone="navy">{p.side === 'family' ? t('admin.family') : p.side === 'yaya' ? t('admin.yaya') : t('admin.noSide')}</Tag>
        {p.isSeed && !p.demoLogin && <Tag tone="muted">{t('admin.seed')}</Tag>}
        {p.demoLogin && <Tag tone="muted">{t('admin.demo')}</Tag>}
        {p.role === 'admin' && <Tag tone="warn">{t('admin.adminTag')}</Tag>}
      </span>
    </span>
  );
}

const REASON_KEYS = ['inaccurate', 'inappropriate', 'unsafe', 'fees', 'other'];

function Reports() {
  const t = useT();
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [list, busy, reload, err] = useLoad<AdminReport[]>(() => A.loadReports(onlyOpen), [onlyOpen]);
  const act = (r: AdminReport, status: 'actioned' | 'dismissed') => {
    A.resolveReport(r.id, status).then(() => { toast(t('admin.done')); reload(); }, e => toast(t('admin.failed', { msg: String(e?.message ?? e) })));
  };
  const card = (r: AdminReport, visible: boolean) => {
    if (!r.target) return;
    A.setCardVisible(r.target, visible).then(() => { toast(t('admin.done')); reload(); }, e => toast(t('admin.failed', { msg: String(e?.message ?? e) })));
  };
  return (
    <>
      <div className="row gap-10 admin__filters">
        <div className="seg seg--inline" role="tablist">
          <button type="button" className={onlyOpen ? 'is-on' : ''} onClick={() => setOnlyOpen(true)}>{t('admin.open')}</button>
          <button type="button" className={!onlyOpen ? 'is-on' : ''} onClick={() => setOnlyOpen(false)}>{t('admin.all')}</button>
        </div>
        <span className="flex1" />
        <Button kind="ghost" size="sm" block={false} icon="refresh" onClick={reload}>{t('admin.refresh')}</Button>
      </div>
      <Loading busy={busy} err={err} empty={!list?.length} />
      {!busy && list?.map(r => {
        const open = r.status === 'open' || r.status === 'reviewing';
        const reason = REASON_KEYS.includes(r.reason) ? t(`admin.reasons.${r.reason}`) : r.reason;
        return (
          <Card key={r.id} className="admin__card" >
            <div data-testid={`report-${r.id}`}>
              <div className="row gap-8"><b className="flex1 admin__title">{reason}</b><Tag tone={open ? 'warn' : 'muted'}>{t(`admin.status.${r.status}`)}</Tag><span className="small muted">{ago(t, Date.parse(r.createdAt))}</span></div>
              <div className="admin__pair">
                <div><div className="eyebrow">{t('admin.reportedT')}</div><Who p={r.target} fallback={r.targetId.slice(0, 8)} /></div>
                <div><div className="eyebrow">{t('admin.reporterT')}</div><Who p={r.reporter} /></div>
              </div>
              {r.note && <p className="admin__note">“{r.note}”</p>}
              <div className="row gap-8 admin__actions">
                {open && <Button size="sm" block={false} onClick={() => act(r, 'actioned')} testId={`rep-action-${r.id}`}>{t('admin.actioned')}</Button>}
                {open && <Button kind="ghost" size="sm" block={false} onClick={() => act(r, 'dismissed')} testId={`rep-dismiss-${r.id}`}>{t('admin.dismiss')}</Button>}
                {r.target?.visible != null && (r.target.visible
                  ? <Button kind="ghost" size="sm" block={false} icon="eyeoff" onClick={() => card(r, false)} testId={`rep-hide-${r.id}`}>{t('admin.hideCard')}</Button>
                  : <Button kind="ghost" size="sm" block={false} onClick={() => card(r, true)}>{t('admin.showCard')}</Button>)}
              </div>
            </div>
          </Card>
        );
      })}
    </>
  );
}

function Reviews() {
  const t = useT();
  const [list, busy, reload, err] = useLoad<AdminReview[]>(() => A.loadReviews(), []);
  const decide = (r: AdminReview, d: 'passed' | 'failed') => {
    A.decideReview(r.check.id!, d).then(res => { toast(res === 'nodate' ? t('admin.noDate') : t('admin.done'), { ms: res === 'nodate' ? 6000 : undefined }); reload(); },
      e => toast(t('admin.failed', { msg: String(e?.message ?? e) })));
  };
  return (
    <>
      <div className="row gap-10 admin__filters"><span className="flex1" /><Button kind="ghost" size="sm" block={false} icon="refresh" onClick={reload}>{t('admin.refresh')}</Button></div>
      <Loading busy={busy} err={err} empty={!list?.length} />
      {!busy && list?.map(r => (
        <Card key={r.check.id} className="admin__card">
          <div className="row gap-12" data-testid={`review-${r.check.id}`}>
            <span className="list-row__icon"><Icon name="id" size={19} /></span>
            <div className="flex1">
              <Who p={r.person} fallback={r.check.user_id.slice(0, 8)} />
              <div className="small muted mt-6">
                {t(`admin.kind.${r.check.kind === 'household_id' ? 'household_id' : 'id'}`)}
                {r.check.id_type ? ` · ${r.check.id_type}` : ''} · {r.check.age_ok === true ? t('admin.ageOk') : r.check.age_ok === false ? t('admin.ageUnder') : t('admin.ageUnknown')}
                {r.check.updated_at ? ` · ${ago(t, Date.parse(r.check.updated_at))}` : ''}
              </div>
            </div>
          </div>
          <div className="row gap-8 admin__actions">
            <Button size="sm" block={false} onClick={() => decide(r, 'passed')} testId={`review-pass-${r.check.id}`}>{t('admin.pass')}</Button>
            <Button kind="ghost" size="sm" block={false} onClick={() => decide(r, 'failed')} testId={`review-fail-${r.check.id}`}>{t('admin.fail')}</Button>
          </div>
        </Card>
      ))}
    </>
  );
}

function Members() {
  const t = useT();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const id = window.setTimeout(() => setQuery(q), 350); return () => window.clearTimeout(id); }, [q]);
  const [list, busy, reload, err] = useLoad<Person[]>(() => A.searchMembers(query), [query]);
  const toggle = (p: Person, v: boolean) => {
    A.setCardVisible(p, v).then(() => { toast(t('admin.done')); reload(); }, e => toast(t('admin.failed', { msg: String(e?.message ?? e) })));
  };
  return (
    <>
      <div className="admin__filters"><Field label={t('admin.search')} value={q} icon="search" onChange={setQ} testId="admin-search" /></div>
      <Loading busy={busy} err={err} empty={!list?.length} />
      {!busy && !!list?.length && (
        <Card className="admin__list">
          {list.map(p => (
            <div key={p.id} className="list-row admin__member" data-testid={`member-${p.id}`}>
              <Avatar initials={(p.name || '?').slice(0, 1).toUpperCase()} size={42} bg={p.side === 'yaya' ? 'var(--coral-deep)' : 'var(--navy)'} />
              <div className="flex1"><Who p={p} /><small className="muted">{t('admin.joined', { when: ago(t, Date.parse(p.createdAt)) })}</small></div>
              {p.visible == null ? <span className="small muted">{t('admin.noCard')}</span> : (
                <label className="row gap-8 admin__vis"><span className="small">{t('admin.visible')}</span><Toggle on={!!p.visible} onChange={v => toggle(p, v)} label={`${t('admin.visible')}: ${p.name}`} testId={`member-visible-${p.id}`} /></label>
              )}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function Samples() {
  const t = useT();
  const [state, busy, reload, err] = useLoad(() => A.samplesState(), []);
  const [saving, setSaving] = useState(false);
  const on = !!state && state.visible > 0;
  const set = (v: boolean) => {
    setSaving(true);
    A.setSamplesVisible(v).then(n => { setSaving(false); toast(t('admin.changed', { n })); reload(); }, e => { setSaving(false); toast(t('admin.failed', { msg: String(e?.message ?? e) })); });
  };
  return (
    <Card className="admin__card">
      <div className="row gap-12">
        <span className="list-row__icon"><Icon name="star" size={19} /></span>
        <div className="flex1"><b className="admin__title">{t('admin.samplesT')}</b><p className="small muted mt-4">{t('admin.samplesB')}</p></div>
        {busy || saving ? <span className="spinner" /> : <Toggle on={on} onChange={set} label={t('admin.samplesT')} testId="admin-samples-toggle" />}
      </div>
      {err && <Note className="mt-12" tone="warn" icon="alert">{t('admin.failed', { msg: err })}</Note>}
      {state && <p className="small strong mt-12" data-testid="admin-samples-count">{t('admin.samplesCount', { visible: state.visible, total: state.total })}</p>}
    </Card>
  );
}
