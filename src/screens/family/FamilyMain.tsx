import { useEffect, useRef, useState } from 'react';
import { useT, peso, monthLabel, dayClock, ago, type T } from '../../lib/i18n';
import { useStore, useUi, setUi, toast, getState } from '../../lib/store';
import { nav, back, useRoute } from '../../lib/router';
import {
  Screen, TopBar, Footer, Button, IconButton, Icon, Chip, Tag, Card, Note, Avatar, Sheet, TabBar, Toggle, Empty, Section, QrCode, Field, LangToggle, Fact, asset,
} from '../../components/ui';
import {
  helperChecks, helperRoles, VoicePlayer, QuoteCard, HelperFacts, startTag, MessageView, TypingDots, lastPreview, ReportSheet, PlanSheet, IdGate, SampleTag, HelperPhoto, hearLabel, availabilityLine,
} from '../../components/domain';
import {
  likeHelper, passHelper, resetPasses, setRoleFilter, setFilters, sendFamilyMessage, familyCanSend, planFamilyCall, markFamilyHired, toggleChecklist,
  readChat, blockParty, unblockParty, openPlans, startCheckout, completePurchase, markMatchSeen, resetDemo, logout, enterSide, setLang, settle, watchChat,
  waitForPaid, purchaseRef, type LikeResult,
} from '../../lib/actions';
import {
  discoverList, likedYouList, likedYouCount, helperById, helperName, hasPass, isPremium, urgentOn, likesLeft, chatUnlocked, reportUnlocked, planLeft, openFreeChats, freeChatCap,
} from '../../lib/match';
import { LIVE } from '../../lib/config';
import { ROLES, PRICES, FREE_LIKES_PER_DAY, QR_TTL_SEC, type Product, type Role, minWageFor, regionOf } from '../../data/constants';
import type { Helper } from '../../lib/types';
import { NotFound } from '../shared/Shared';
import { formatPhone } from './FamilyOnboarding';
import { useIsDesktop } from '../../lib/useIsDesktop';
import { FamilyNav, PageHead, BackLink, SideNav, EmptyThread, WageTable, useFamilyNavItems } from '../../components/desktop';

// ---------- tabs ----------
// Same items as the desktop top nav (useFamilyNavItems), shown as the bottom tab bar on phones.
function useFamilyTabs() {
  const items = useFamilyNavItems();
  return (active: string) => <TabBar active={active} items={items} />;
}

function afterLike(t: T, h: Helper, r: LikeResult | Promise<LikeResult>, onLimit: () => void) {
  settle(r, v => {
    if (v === 'limit') onLimit();
    else if (v === 'match') nav('f-match', h.id);
    else if (v === 'liked') toast(t('fam.discover.liked', { name: h.firstName }));
  });
}

// ---------- Discover ----------
export function FamilyDiscover() {
  const t = useT();
  const s = useStore(st => st);
  const f = s.family;
  const tabs = useFamilyTabs();
  const [limit, setLimit] = useState(false);
  const [filters, setFiltersOpen] = useState(false);
  const list = discoverList(s);
  const h = list[0];
  const liked = likedYouList(s);
  const likedN = likedYouCount(s);
  const left = likesLeft(f);
  const city = t(`cities.${f.city}`);
  const sub = left === Infinity ? t('fam.discover.subUnlimited', { city }) : left === 1 ? t('fam.discover.subOne', { city }) : t('fam.discover.sub', { city, n: left });
  const roleChips: (Role | 'all')[] = ['all', ...f.roles, ...ROLES.filter(r => !f.roles.includes(r))];
  const like = () => { if (!h) return; afterLike(t, h, likeHelper(h.id), () => setLimit(true)); };
  const desk = useIsDesktop();
  if (desk) {
    const next = list.slice(1, 4);
    return (
      <Screen tone="cream" side="family" label={t('fam.discover.title')} nav={<FamilyNav active="discover" />} wide desk="discover"
        header={<PageHead title={t('fam.discover.title')} sub={<span data-testid="likes-left">{sub}</span>}
          right={<Button kind="ghost" size="md" block={false} icon="sliders" onClick={() => setFiltersOpen(true)} testId="filters">{t('fam.discover.filters')}</Button>} />}
        overlay={<>
          {limit && (
            <Sheet title={t('fam.discover.limitTitle')} onClose={() => setLimit(false)} testId="limit-sheet"
              actions={<><Button onClick={() => { setLimit(false); openPlans('limit', 'f-discover'); }}>{t('fam.discover.seePlans')}</Button><Button kind="ghost" onClick={() => setLimit(false)}>{t('fam.discover.maybeLater')}</Button></>}>
              <p className="lead" style={{ marginTop: 0 }}>{t('fam.discover.limitBody', { n: FREE_LIKES_PER_DAY })}</p>
            </Sheet>
          )}
          {filters && <FiltersSheet onClose={() => setFiltersOpen(false)} />}
        </>}>
        <div className="dgrid dgrid--discover">
          <aside className="rail"><FilterRail roleChips={roleChips} /></aside>
          <section className="dmain">
            {urgentOn(f) && <Note className="dnote" tone="warn" icon="zap">{t('fam.discover.urgentOn', { h: planLeft(f.urgentUntil).hours })}</Note>}
            {h ? <HelperDeskCard key={h.id} h={h} onLike={like} /> : (
              <Card className="dempty">
                <Empty icon="search" title={t('fam.discover.emptyTitle')} body={t('fam.discover.emptyBody')}>
                  <div className="row gap-10">
                    {f.passes.length > 0 && <Button kind="ghost" block={false} onClick={resetPasses}>{t('fam.discover.resetPasses')}</Button>}
                    {f.roleFilter !== 'all' && <Button kind="ghost" block={false} onClick={() => setRoleFilter('all')}>{t('fam.discover.clearFilters')}</Button>}
                  </div>
                </Empty>
              </Card>
            )}
          </section>
          <aside className="rail rail--right">
            {likedN > 0 && (
              <button type="button" className="banner banner--stack" onClick={() => nav('f-likes')} data-testid="liked-banner">
                {liked.length > 0 && <span className="avatar-stack">{liked.slice(0, 3).map(x => <Avatar key={x.id} src={x.photo} initials={x.firstName[0]} size={36} ring="var(--blush)" />)}</span>}
                <span><strong style={{ fontWeight: 600 }}>{likedN === 1 ? t('fam.discover.likedBannerOne') : t('fam.discover.likedBanner', { n: likedN })}</strong>{' '}
                  {hasPass(f) ? t('fam.discover.likedOpen') : t('fam.discover.likedLocked')}</span>
                <span className="banner__go">{hasPass(f) ? t('fam.inbox.likesUnlock') : t('fam.plans.passTitle')}<Icon name="next" size={16} /></span>
              </button>
            )}
            {next.length > 0 && (
              <Card className="upnext">
                <div className="eyebrow">{t('desk.discover.upNext')}</div>
                {next.map(x => (
                  <button key={x.id} type="button" className="list-row" onClick={() => nav('f-helper', x.id)}>
                    <Avatar src={x.photo} initials={x.firstName[0]} size={52} square />
                    <div className="flex1"><b>{helperName(x)}, {x.age}</b><small>{helperRoles(t, x)}</small><small>{peso(x.rate)} · {t(`cities.${x.city}`)}</small></div>
                    <Icon name="next" size={18} />
                  </button>
                ))}
              </Card>
            )}
            <Card tone="blush" className="tipcard">
              <div className="row gap-8"><span style={{ color: 'var(--coral-deep)' }}><Icon name="alert" size={18} /></span><b>{t('fam.match.stepsTitle')}</b></div>
              <ul>{['s1', 's2', 's3'].map(k => <li key={k}>{t(`fam.match.${k}`)}</li>)}</ul>
            </Card>
          </aside>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="cream" side="family" label={t('fam.discover.title')}
      header={
        <header>
          <div className="row gap-12" style={{ padding: 'calc(16px + var(--safe-t)) 20px 0' }}>
            <div className="flex1">
              <h1 className="h1 h1--sm">{t('fam.discover.title')}</h1>
              <div className="small muted" data-testid="likes-left">{sub}</div>
            </div>
            <IconButton name="sliders" label={t('fam.discover.filters')} onClick={() => setFiltersOpen(true)} dot={hasPass(f) && (f.filters.idOnly || f.filters.liveInOnly || f.filters.maxRate != null || !!f.filters.lang || f.filters.minYears > 0)} testId="filters" />
          </div>
          <div className="chips chips--scroll pad-s" style={{ marginTop: 10 }}>
            {roleChips.map(r => <Chip key={r} small on={f.roleFilter === r} onClick={() => setRoleFilter(r)} testId={`rf-${r}`}>{r === 'all' ? t('fam.discover.all') : t(`roles.${r}`)}</Chip>)}
          </div>
        </header>
      }
      tabbar={tabs(t('tabs.discover'))}
      overlay={<>
        {limit && (
          <Sheet title={t('fam.discover.limitTitle')} onClose={() => setLimit(false)} testId="limit-sheet"
            actions={<><Button onClick={() => { setLimit(false); openPlans('limit', 'f-discover'); }}>{t('fam.discover.seePlans')}</Button><Button kind="ghost" onClick={() => setLimit(false)}>{t('fam.discover.maybeLater')}</Button></>}>
            <p className="lead" style={{ marginTop: 0 }}>{t('fam.discover.limitBody', { n: FREE_LIKES_PER_DAY })}</p>
          </Sheet>
        )}
        {filters && <FiltersSheet onClose={() => setFiltersOpen(false)} />}
        {h && (
          <div className="deck-actions">
            <button type="button" className="iconbtn iconbtn--big" aria-label={t('fam.discover.pass')} onClick={() => passHelper(h.id)} data-testid="pass"><Icon name="x" size={26} sw={2.4} /></button>
            <button type="button" className="iconbtn iconbtn--big iconbtn--like" aria-label={t('fam.discover.like', { name: h.firstName })} onClick={like} data-testid="like"><Icon name="heart" size={26} sw={2.2} /></button>
          </div>
        )}
      </>}>
      <div className="pad-s">
        {urgentOn(f) && <Note className="mt-12" tone="warn" icon="zap">{t('fam.discover.urgentOn', { h: planLeft(f.urgentUntil).hours })}</Note>}
        {likedN > 0 && (
          <button type="button" className="banner mt-12" onClick={() => nav('f-likes')} data-testid="liked-banner">
            {liked.length > 0 ? <span className="avatar-stack">{liked.slice(0, 2).map(x => <Avatar key={x.id} src={x.photo} initials={x.firstName[0]} size={30} ring="var(--blush)" />)}</span>
              : <span className="list-row__icon"><Icon name="heart" size={18} /></span>}
            <span className="flex1"><strong style={{ fontWeight: 600 }}>{likedN === 1 ? t('fam.discover.likedBannerOne') : t('fam.discover.likedBanner', { n: likedN })}</strong>{' '}
              {hasPass(f) ? t('fam.discover.likedOpen') : t('fam.discover.likedLocked')}</span>
            <Icon name="next" size={18} />
          </button>
        )}
        {h ? (
          <div style={{ paddingBottom: 96 }}>
            <button type="button" className="pcard mt-12" onClick={() => nav('f-helper', h.id)} aria-label={`${helperName(h)}, ${h.age}. ${t('fam.discover.cardHint')}`} data-testid="helper-card">
              <div className="pcard__photo">
                <HelperPhoto h={h} />
                <div className="pcard__tl">{startTag(t, h)}{h.likedYou && <Tag tone="solid" icon="heart">{t('fam.discover.likedYou')}</Tag>}<SampleTag on={h.sample} /></div>
                {h.checks.id && <div className="pcard__tr"><Tag tone="ok" icon="check">{t('fam.discover.idChecked', { month: monthLabel(t, h.checks.id.month).split(' ')[0] })}</Tag></div>}
              </div>
              <div className="pcard__body">
                <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
                  <span className="pcard__name">{helperName(h)}, {h.age}</span>
                  {h.rate > f.budgetMax && <Tag tone="warn">{t('fam.discover.overBudget')}</Tag>}
                </div>
                <div className="small muted" style={{ fontSize: 13.5 }}>{helperRoles(t, h)}</div>
                <HelperFacts h={h} />
                {h.favorite && <div className="prompt"><small>{t('fam.discover.favorite')}</small><span>{h.favorite}</span></div>}
              </div>
            </button>
          </div>
        ) : (
          <Empty icon="search" title={t('fam.discover.emptyTitle')} body={t('fam.discover.emptyBody')}>
            <div className="stack gap-10" style={{ width: '100%' }}>
              {f.passes.length > 0 && <Button kind="ghost" onClick={resetPasses}>{t('fam.discover.resetPasses')}</Button>}
              {f.roleFilter !== 'all' && <Button kind="ghost" onClick={() => setRoleFilter('all')}>{t('fam.discover.clearFilters')}</Button>}
            </div>
          </Empty>
        )}
      </div>
    </Screen>
  );
}

function FiltersSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const f = useStore(s => s.family);
  const [fl, setFl] = useState(f.filters);
  const locked = !hasPass(f);
  const rates = [10000, 12000, 15000, 18000];
  return (
    <Sheet title={t('fam.discover.fTitle')} onClose={onClose} testId="filters-sheet" wide
      actions={locked
        ? <Button icon="lock" onClick={() => { onClose(); openPlans('filters', 'f-discover'); }}>{t('fam.discover.fUnlock')}</Button>
        : <><Button onClick={() => { setFilters(fl); onClose(); toast(t('fam.discover.fApplied')); }}>{t('fam.discover.fApply')}</Button>
          <Button kind="ghost" onClick={() => { const c = { idOnly: false, liveInOnly: false, maxRate: null, lang: null, minYears: 0 }; setFl(c); setFilters(c); }}>{t('fam.discover.fClear')}</Button></>}>
      <div className="label">{t('fam.discover.fRole')}</div>
      <div className="chips">
        <Chip small on={f.roleFilter === 'all'} onClick={() => setRoleFilter('all')}>{t('fam.discover.all')}</Chip>
        {ROLES.map(r => <Chip key={r} small on={f.roleFilter === r} onClick={() => setRoleFilter(r)}>{t(`roles.${r}`)}</Chip>)}
      </div>
      {locked && <Note className="mt-16" tone="info" icon="lock">{t('fam.discover.fLocked')}</Note>}
      <div style={{ opacity: locked ? 0.5 : 1, pointerEvents: locked ? 'none' : undefined }} aria-disabled={locked ? 'true' : 'false'}>
        <div className="row mt-16" style={{ justifyContent: 'space-between' }}><span className="label">{t('fam.discover.fIdOnly')}</span><Toggle on={fl.idOnly} onChange={v => setFl({ ...fl, idOnly: v })} label={t('fam.discover.fIdOnly')} /></div>
        <div className="row mt-14" style={{ justifyContent: 'space-between' }}><span className="label">{t('fam.discover.fLiveIn')}</span><Toggle on={fl.liveInOnly} onChange={v => setFl({ ...fl, liveInOnly: v })} label={t('fam.discover.fLiveIn')} /></div>
        <div className="label mt-16">{t('fam.discover.fMaxRate')}</div>
        <div className="chips">
          <Chip small on={fl.maxRate == null} onClick={() => setFl({ ...fl, maxRate: null })}>{t('fam.discover.fAny')}</Chip>
          {rates.map(r => <Chip key={r} small on={fl.maxRate === r} onClick={() => setFl({ ...fl, maxRate: r })}>{peso(r)}</Chip>)}
        </div>
        <div className="label mt-16">{t('fam.discover.fLang')}</div>
        <div className="chips">
          <Chip small on={!fl.lang} onClick={() => setFl({ ...fl, lang: null })}>{t('fam.discover.fAny')}</Chip>
          {(['tagalog', 'english', 'bisaya', 'ilocano'] as const).map(l => <Chip key={l} small on={fl.lang === l} onClick={() => setFl({ ...fl, lang: l })}>{t(`langs.${l}`)}</Chip>)}
        </div>
        <div className="label mt-16">{t('fam.discover.fMinYears')}</div>
        <div className="chips">{[0, 3, 5, 10].map(y => <Chip key={y} small on={fl.minYears === y} onClick={() => setFl({ ...fl, minYears: y })}>{y === 0 ? t('fam.discover.fAny') : t('fam.discover.fYears', { n: y })}</Chip>)}</div>
      </div>
    </Sheet>
  );
}

// Desktop filter rail (pattern C): every filter visible; advanced ones are locked without a pass.
function FilterRail({ roleChips }: { roleChips: (Role | 'all')[] }) {
  const t = useT();
  const f = useStore(s => s.family);
  const locked = !hasPass(f);
  const fl = f.filters;
  const set = (p: Partial<typeof fl>) => { if (locked) { openPlans('filters', 'f-discover'); return; } setFilters({ ...fl, ...p }); };
  const rates = [10000, 12000, 15000, 18000];
  const lock = locked ? <Icon name="lock" size={14} className="frail__lock" /> : null;
  return (
    <div className="card frail">
      <div className="row gap-8">
        <h2 className="h3 flex1">{t('fam.discover.fTitle')}</h2>
        {!locked && <button type="button" className="textlink" onClick={() => setFilters({ idOnly: false, liveInOnly: false, maxRate: null, lang: null, minYears: 0 })}>{t('fam.discover.fClear')}</button>}
      </div>
      <div className="frail__group">
        <div className="label">{t('fam.discover.fRole')}</div>
        <div className="chips">
          {roleChips.map(r => <Chip key={r} small on={f.roleFilter === r} onClick={() => setRoleFilter(r)} testId={`rf-${r}`}>{r === 'all' ? t('fam.discover.all') : t(`roles.${r}`)}</Chip>)}
        </div>
      </div>
      <div className="frail__head">
        <span className="eyebrow">{t('desk.discover.adv')}</span>
        {locked && <Tag tone="navy" icon="lock">{t('fam.plans.passTitle')}</Tag>}
      </div>
      <div className={`frail__adv${locked ? ' is-locked' : ''}`}>
        <div className="frail__row"><span className="label">{lock}{t('fam.discover.fIdOnly')}</span><Toggle on={fl.idOnly} onChange={v => set({ idOnly: v })} label={t('fam.discover.fIdOnly')} /></div>
        <div className="frail__row"><span className="label">{lock}{t('fam.discover.fLiveIn')}</span><Toggle on={fl.liveInOnly} onChange={v => set({ liveInOnly: v })} label={t('fam.discover.fLiveIn')} /></div>
        <div className="frail__group">
          <div className="label">{lock}{t('fam.discover.fMaxRate')}</div>
          <div className="chips">
            <Chip small on={fl.maxRate == null} onClick={() => set({ maxRate: null })}>{t('fam.discover.fAny')}</Chip>
            {rates.map(r => <Chip key={r} small on={fl.maxRate === r} onClick={() => set({ maxRate: r })}>{peso(r)}</Chip>)}
          </div>
        </div>
        <div className="frail__group">
          <div className="label">{lock}{t('fam.discover.fLang')}</div>
          <div className="chips">
            <Chip small on={!fl.lang} onClick={() => set({ lang: null })}>{t('fam.discover.fAny')}</Chip>
            {(['tagalog', 'english', 'bisaya', 'ilocano'] as const).map(l => <Chip key={l} small on={fl.lang === l} onClick={() => set({ lang: l })}>{t(`langs.${l}`)}</Chip>)}
          </div>
        </div>
        <div className="frail__group">
          <div className="label">{lock}{t('fam.discover.fMinYears')}</div>
          <div className="chips">{[0, 3, 5, 10].map(y => <Chip key={y} small on={fl.minYears === y} onClick={() => set({ minYears: y })}>{y === 0 ? t('fam.discover.fAny') : t('fam.discover.fYears', { n: y })}</Chip>)}</div>
        </div>
      </div>
      {locked && <div className="mt-16"><Button size="md" icon="lock" onClick={() => openPlans('filters', 'f-discover')}>{t('fam.discover.fUnlock')}</Button></div>}
    </div>
  );
}

// Desktop profile card (pattern C): photo on the left, facts on the right, Pass and Like under it.
function HelperDeskCard({ h, onLike }: { h: Helper; onLike: () => void }) {
  const t = useT();
  const f = useStore(s => s.family);
  const c = h.checks;
  return (
    <div className="deck">
      <article className="pcard pcard--desk">
        <button type="button" className="pcard__photo" onClick={() => nav('f-helper', h.id)} aria-label={`${helperName(h)}, ${h.age}. ${t('desk.discover.profile')}`} data-testid="helper-card">
          <HelperPhoto h={h} />
          <span className="pcard__tl">{startTag(t, h)}{h.likedYou && <Tag tone="solid" icon="heart">{t('fam.discover.likedYou')}</Tag>}<SampleTag on={h.sample} /></span>
          <span className="pcard__more">{t('desk.discover.profile')}<Icon name="next" size={16} /></span>
        </button>
        <div className="pcard__body">
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <span className="pcard__name">{helperName(h)}, {h.age}</span>
            {h.rate > f.budgetMax && <Tag tone="warn">{t('fam.discover.overBudget')}</Tag>}
          </div>
          <div className="muted pcard__roles">{helperRoles(t, h)}</div>
          <HelperFacts h={h} />
          <div className="dchecks">
            <div className="eyebrow">{t('desk.discover.checks')}</div>
            <ul>
              {c.phone && <li><Icon name="check" size={15} sw={2.6} />{t('fam.profile.phone')} · {monthLabel(t, c.phone)}</li>}
              {c.id && <li><Icon name="check" size={15} sw={2.6} />{t('fam.profile.idPlain')} · {monthLabel(t, c.id.month)}</li>}
              {c.nbi && <li><Icon name="check" size={15} sw={2.6} />{t('fam.profile.nbi')} · {t('fam.profile.nbiDone', { month: monthLabel(t, c.nbi) })}</li>}
              {c.refs && <li><Icon name="check" size={15} sw={2.6} />{t('fam.profile.refsDone', { n: c.refs.n, month: monthLabel(t, c.refs.month) })}</li>}
            </ul>
          </div>
          {h.voice.sec > 0 && <div className="dvoice"><VoicePlayer sec={h.voice.sec} script={h.voice.script} src={h.voice.url} label={hearLabel(t, h)} /></div>}
          {h.favorite && <div className="prompt"><small>{t('fam.discover.favorite')}</small><span>{h.favorite}</span></div>}
          <div className="deck__actions">
            <Button kind="ghost" icon="x" block={false} onClick={() => passHelper(h.id)} testId="pass">{t('fam.discover.pass')}</Button>
            <Button icon="heart" onClick={onLike} testId="like">{t('fam.discover.like', { name: h.firstName })}</Button>
          </div>
        </div>
      </article>
    </div>
  );
}

// ---------- Helper profile ----------
export function HelperProfile({ id }: { id: string }) {
  const t = useT();
  const f = useStore(s => s.family);
  const h = helperById(id);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [full, setFull] = useState(false);
  const [limit, setLimit] = useState(false);
  const desk = useIsDesktop();
  if (!h || f.blocked.includes(id)) return <NotFound />;
  const matched = f.matches.includes(id);
  const liked = f.likes.includes(id) && !matched;
  const hired = f.hires.some(x => x.helperId === id);
  const name = helperName(h);
  if (desk) {
    const c = h.checks;
    const dated: string[] = [
      ...(c.phone ? [`${t('fam.profile.phone')} · ${monthLabel(t, c.phone)}`] : []),
      ...(c.id ? [`${t('fam.profile.idPlain')} · ${monthLabel(t, c.id.month)}`] : []),
      ...(c.nbi ? [`${t('fam.profile.nbi')} · ${t('fam.profile.nbiDone', { month: monthLabel(t, c.nbi) })}`] : []),
      ...(c.refs ? [t('fam.profile.refsDone', { n: c.refs.n, month: monthLabel(t, c.refs.month) })] : []),
      ...(c.tesda ? [`${t('fam.profile.tesda')} · ${t('fam.profile.tesdaDone')}`] : []),
    ];
    return (
      <Screen tone="cream" side="family" label={name} nav={<FamilyNav active="discover" />} desk="detail"
        header={<div className="crumbrow"><BackLink to="f-discover" label={t('tabs.discover')} /><IconButton name="more" label={t('common.more')} onClick={() => setMenu(true)} testId="profile-more" /></div>}
        overlay={<>
          {menu && (
            <Sheet onClose={() => setMenu(false)} title={name}>
              <button type="button" className="menu-item" onClick={() => { setMenu(false); setReport(true); }}><Icon name="flag" size={20} />{t('chat.mReport')}</button>
              <button type="button" className="menu-item menu-item--danger" onClick={() => {
                setMenu(false); blockParty('family', id); nav('f-discover', undefined, { replace: true });
                toast(t('chat.blocked', { name: h.firstName }), { action: { label: t('common.undo'), run: () => unblockParty('family', id) } });
              }}><Icon name="ban" size={20} />{t('chat.mBlock', { name: h.firstName })}</button>
            </Sheet>
          )}
          {report && <ReportSheet side="family" id={id} name={h.firstName} onClose={() => setReport(false)} />}
          {full && <FullReportSheet h={h} onClose={() => setFull(false)} />}
          {limit && (
            <Sheet title={t('fam.discover.limitTitle')} onClose={() => setLimit(false)}
              actions={<><Button onClick={() => { setLimit(false); openPlans('limit', 'f-helper-' + id); }}>{t('fam.discover.seePlans')}</Button><Button kind="ghost" onClick={() => setLimit(false)}>{t('fam.discover.maybeLater')}</Button></>}>
              <p className="lead" style={{ marginTop: 0 }}>{t('fam.discover.limitBody', { n: FREE_LIKES_PER_DAY })}</p>
            </Sheet>
          )}
        </>}>
        <div className="dgrid dgrid--detail">
          <div className="dmain">
            <div className="dhero">
              <div className="dhero__photo"><HelperPhoto h={h} alt={name} /></div>
              <div className="dhero__info">
                <div className="row gap-10" style={{ flexWrap: 'wrap' }}>
                  <h1 className="h1">{name}, {h.age}</h1>
                  {hired && <Tag tone="ok" icon="check">{t('fam.profile.hiredBadge')}</Tag>}
                  <SampleTag on={h.sample} tone="muted" />
                </div>
                <div className="dhero__sub">{helperRoles(t, h)} · {t(`cities.${h.city}`)} · {t('fam.profile.speaks', { langs: h.languages.map(l => t(`langs.${l}`)).join(', ') })}</div>
                <div className="tags mt-14">
                  <Tag icon="calendar">{t(`startIn.${h.startIn}`)}</Tag>
                  <Tag icon="clock">{t('fam.profile.offTag', { days: h.daysOff.map(d => t(`days.${d}`)).join('–') })}</Tag>
                  <Tag icon="home">{t(`arr.${h.arrangement}`)}</Tag>
                  {h.likedYou && <Tag tone="solid" icon="heart">{t('fam.discover.likedYou')}</Tag>}
                </div>
                {h.voice.sec > 0 && <Card className="mt-18"><VoicePlayer sec={h.voice.sec} script={h.voice.script} src={h.voice.url} label={hearLabel(t, h)} /></Card>}
                {h.favorite && <div className="prompt"><small>{t('fam.discover.favorite')}</small><span>{h.favorite}</span></div>}
              </div>
            </div>
            <Section title={t('fam.profile.about')}>
              <Card>
                <p className="dbody">{h.bio}</p>
                <div className="mt-10"><Tag tone="muted">{t('fam.profile.selfReported')}</Tag></div>
              </Card>
            </Section>
            <Section title={t('fam.profile.checksTitle')}>
              <Card style={{ padding: '6px 20px 18px' }}>
                {helperChecks(t, h)}
                <div className="row gap-8 mt-12" style={{ justifyContent: 'space-between' }}>
                  <span className="small muted">{t('fam.profile.checksNote')}</span>
                  <button type="button" className="topbar__link" style={{ fontSize: 14, padding: 0, whiteSpace: 'nowrap' }} onClick={() => setFull(true)} data-testid="full-report">
                    {reportUnlocked(f, id) ? t('fam.profile.seeReport') : t('fam.profile.fullReport', { price: peso(PRICES.report) })}
                  </button>
                </div>
              </Card>
              <Note className="mt-10" tone="warn">{t('fam.profile.disclaimer')}</Note>
            </Section>
            <div className="dcols">
              <Section title={t('fam.profile.schedule')}><Card><p className="dbody">{availabilityLine(t, h)}</p></Card></Section>
              {h.experience.length > 0 && <Section title={t('fam.profile.experience')}>
                <Card>{h.experience.map((e, i) => <div key={i} className="timeline-item"><i /><div><small>{e.years}</small><span>{e.text}</span></div></div>)}</Card>
              </Section>}
            </div>
            {h.quotes.length > 0 && <Section title={t('fam.profile.quotes')}>
              <div className="qgrid">{h.quotes.map((q, i) => <QuoteCard key={i} text={q.text} who={q.who} suffix={t('fam.profile.fromRef')} />)}</div>
            </Section>}
          </div>
          <aside className="dside">
            <div className="card dside__card">
              <div className="dside__price">{peso(h.rate)}<small>{t('common.perMonth')}</small></div>
              <div className="stack gap-8 mt-14">
                <Fact icon="home">{t('fam.discover.arrDays', { arr: t(`arr.${h.arrangement}`), days: h.daysOff.map(d => t(`days.${d}`)).join('–') })}</Fact>
                <Fact icon="calendar">{t(`startIn.${h.startIn}`)}</Fact>
                <Fact icon="briefcase">{t('fam.discover.expFact', { n: h.years })}</Fact>
              </div>
              {h.rate > f.budgetMax && <div className="mt-12"><Tag tone="warn">{t('fam.discover.overBudget')}</Tag></div>}
              <div className="dside__actions">
                {matched ? <Button icon="chat" onClick={() => nav('f-chat', id)} testId="open-chat">{t('fam.profile.openChat')}</Button>
                  : liked ? <Note tone="info" icon="heart">{t('fam.profile.youLiked', { name: h.firstName })}</Note>
                    : <>
                      <Button icon="heart" onClick={() => afterLike(t, h, likeHelper(id), () => setLimit(true))} testId="profile-like">{t('fam.discover.like', { name: h.firstName })}</Button>
                      <Button kind="ghost" icon="x" onClick={() => { passHelper(id); back('f-discover'); }}>{t('fam.discover.pass')}</Button>
                    </>}
              </div>
              <div className="dside__checks">
                <div className="eyebrow">{t('desk.discover.checks')}</div>
                <ul>{dated.map(d => <li key={d}><Icon name="check" size={15} sw={2.6} />{d}</li>)}</ul>
              </div>
            </div>
          </aside>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="cream" side="family" label={name}
      header={<TopBar back="f-discover" title={name} sub={helperRoles(t, h)} right={<IconButton name="more" label={t('common.more')} onClick={() => setMenu(true)} testId="profile-more" />} />}
      footer={
        <Footer bar row>
          {matched ? <Button icon="chat" onClick={() => nav('f-chat', id)} testId="open-chat">{t('fam.profile.openChat')}</Button>
            : liked ? <div className="note note--info" style={{ flex: 1 }}><Icon name="heart" size={16} /><span>{t('fam.profile.youLiked', { name: h.firstName })}</span></div>
              : <>
                <button type="button" className="iconbtn" style={{ width: 56, height: 56 }} aria-label={t('fam.discover.pass')} onClick={() => { passHelper(id); back('f-discover'); }}><Icon name="x" size={24} /></button>
                <div className="flex1"><Button icon="heart" onClick={() => afterLike(t, h, likeHelper(id), () => setLimit(true))} testId="profile-like">{t('fam.discover.like', { name: h.firstName })}</Button></div>
              </>}
        </Footer>
      }
      overlay={<>
        {menu && (
          <Sheet onClose={() => setMenu(false)} title={name}>
            <button type="button" className="menu-item" onClick={() => { setMenu(false); setReport(true); }}><Icon name="flag" size={20} />{t('chat.mReport')}</button>
            <button type="button" className="menu-item menu-item--danger" onClick={() => {
              setMenu(false); blockParty('family', id); nav('f-discover', undefined, { replace: true });
              toast(t('chat.blocked', { name: h.firstName }), { action: { label: t('common.undo'), run: () => unblockParty('family', id) } });
            }}><Icon name="ban" size={20} />{t('chat.mBlock', { name: h.firstName })}</button>
          </Sheet>
        )}
        {report && <ReportSheet side="family" id={id} name={h.firstName} onClose={() => setReport(false)} />}
        {full && <FullReportSheet h={h} onClose={() => setFull(false)} />}
        {limit && (
          <Sheet title={t('fam.discover.limitTitle')} onClose={() => setLimit(false)}
            actions={<><Button onClick={() => { setLimit(false); openPlans('limit', 'f-helper-' + id); }}>{t('fam.discover.seePlans')}</Button><Button kind="ghost" onClick={() => setLimit(false)}>{t('fam.discover.maybeLater')}</Button></>}>
            <p className="lead" style={{ marginTop: 0 }}>{t('fam.discover.limitBody', { n: FREE_LIKES_PER_DAY })}</p>
          </Sheet>
        )}
      </>}>
      <div className="pad">
        <div className="photo-hero"><HelperPhoto h={h} alt={name} /></div>
        <div className="row gap-8 mt-14" style={{ flexWrap: 'wrap' }}>
          <h1 className="h1 h1--sm">{name}, {h.age}</h1>
          {hired && <Tag tone="ok" icon="check">{t('fam.profile.hiredBadge')}</Tag>}
          <SampleTag on={h.sample} tone="muted" />
        </div>
        <div className="muted mt-4" style={{ fontSize: 14 }}>{helperRoles(t, h)} · {t(`cities.${h.city}`)} · {t('fam.profile.speaks', { langs: h.languages.map(l => t(`langs.${l}`)).join(', ') })}</div>
        <div className="tags mt-12">
          <Tag icon="calendar">{t(`startIn.${h.startIn}`)}</Tag>
          <Tag icon="clock">{t('fam.profile.offTag', { days: h.daysOff.map(d => t(`days.${d}`)).join('–') })}</Tag>
          <Tag icon="home">{t(`arr.${h.arrangement}`)}</Tag>
          <Tag icon="peso">{t('fam.discover.rateFact', { amount: peso(h.rate) })}</Tag>
          {h.likedYou && <Tag tone="solid" icon="heart">{t('fam.discover.likedYou')}</Tag>}
        </div>
        {h.voice.sec > 0 && <Card className="mt-16"><VoicePlayer sec={h.voice.sec} script={h.voice.script} src={h.voice.url} label={hearLabel(t, h)} /></Card>}
        <Section title={t('fam.profile.about')}>
          <p style={{ fontSize: 15, lineHeight: 1.55 }}>{h.bio}</p>
          <div className="mt-8"><Tag tone="muted">{t('fam.profile.selfReported')}</Tag></div>
          {h.favorite && <div className="prompt"><small>{t('fam.discover.favorite')}</small><span>{h.favorite}</span></div>}
        </Section>
        <Section title={t('fam.profile.checksTitle')}>
          <Card style={{ padding: '6px 14px 14px' }}>
            {helperChecks(t, h)}
            <div className="row gap-8 mt-12" style={{ justifyContent: 'space-between' }}>
              <span className="small muted">{t('fam.profile.checksNote')}</span>
              <button type="button" className="topbar__link" style={{ fontSize: 13, padding: 0, whiteSpace: 'nowrap' }} onClick={() => setFull(true)} data-testid="full-report">
                {reportUnlocked(f, id) ? t('fam.profile.seeReport') : t('fam.profile.fullReport', { price: peso(PRICES.report) })}
              </button>
            </div>
          </Card>
          <Note className="mt-10" tone="warn">{t('fam.profile.disclaimer')}</Note>
        </Section>
        <Section title={t('fam.profile.schedule')}><p style={{ fontSize: 15 }}>{availabilityLine(t, h)}</p></Section>
        {h.experience.length > 0 && <Section title={t('fam.profile.experience')}>
          {h.experience.map((e, i) => <div key={i} className="timeline-item"><i /><div><small>{e.years}</small><span>{e.text}</span></div></div>)}
        </Section>}
        {h.quotes.length > 0 && <Section title={t('fam.profile.quotes')}>
          {h.quotes.map((q, i) => <QuoteCard key={i} text={q.text} who={q.who} suffix={t('fam.profile.fromRef')} />)}
        </Section>}
        <div className="spacer" />
      </div>
    </Screen>
  );
}

function FullReportSheet({ h, onClose }: { h: Helper; onClose: () => void }) {
  const t = useT();
  const f = useStore(s => s.family);
  const open = reportUnlocked(f, h.id);
  if (!open) {
    return (
      <Sheet title={t('fam.profile.rBuyTitle')} onClose={onClose} testId="report-buy"
        actions={<><Button onClick={() => { onClose(); startCheckout('report', 'f-helper-' + h.id, h.id); }} testId="buy-report">{t('fam.profile.rBuy', { price: peso(PRICES.report) })}</Button>
          <Button kind="ghost" onClick={() => { onClose(); startCheckout('premium', 'f-helper-' + h.id); }}>{t('fam.profile.rPremium')}</Button></>}>
        <p className="lead" style={{ marginTop: 0 }}>{t('fam.profile.rBuyBody')}</p>
      </Sheet>
    );
  }
  const c = h.checks;
  const last = String(1000 + (parseInt(h.id.slice(2)) * 731) % 9000).slice(-4);
  return (
    <Sheet title={t('fam.profile.rTitle', { name: helperName(h) })} onClose={onClose} testId="report-view" actions={<Button kind="ghost" onClick={onClose}>{t('common.close')}</Button>}>
      <p className="lead" style={{ marginTop: 0 }}>{t('fam.profile.rIntro')}</p>
      <Card tone="flat" className="mt-12">
        {c.id ? <>
          <b style={{ fontSize: 14.5 }}>{t('fam.profile.rId', { type: t(`idTypes.${c.id.type}`), month: monthLabel(t, c.id.month) })}</b>
          {!LIVE && <div className="small muted mt-4">{c.id.type === 'philid' ? t('fam.profile.rHowPsa') : t('fam.profile.rHowManual')}</div>}
          <div className="small mt-8 row gap-6"><Icon name="check" size={15} />{t('fam.profile.rSelfie')}</div>
        </> : <span className="small muted">{t('fam.profile.idPlain')} · {t('fam.profile.notYet')}</span>}
        {c.nbi && <div className="mt-12"><b style={{ fontSize: 14.5 }}>{t('fam.profile.nbi')}</b><div className="small muted">{LIVE ? t('fam.profile.nbiDone', { month: monthLabel(t, c.nbi) }) : t('fam.profile.rNbi', { last, month: monthLabel(t, c.nbi) })}</div></div>}
      </Card>
      {c.refs && <div className="mt-14"><div className="label">{t('fam.profile.rRefs')}</div>{h.quotes.map((q, i) => <QuoteCard key={i} text={q.text} who={q.who} />)}</div>}
      <p className="small muted mt-14">{LIVE ? t('live.rFooter') : t('fam.profile.rFooter')}</p>
    </Sheet>
  );
}

// ---------- Match ----------
export function FamilyMatch({ id }: { id: string }) {
  const t = useT();
  const f = useStore(s => s.family);
  const h = helperById(id);
  useEffect(() => { if (h) markMatchSeen('family', id); }, [id]);
  const desk = useIsDesktop();
  if (!h || !f.matches.includes(id)) return <NotFound />;
  if (desk) {
    return (
      <Screen tone="blush" side="family" nav={<FamilyNav active="messages" />} desk="center">
        <div className="dcenter">
          <div className="dcard center">
            <div className="kicker">{t('fam.match.kicker')}</div>
            <h1 className="h1 mt-8">{t('fam.match.title', { name: h.firstName })}</h1>
            <div className="pair">
              <svg className="arc" width="280" height="60" viewBox="0 0 280 60" aria-hidden="true"><path d="M60 52 C 110 0, 170 0, 220 52" fill="none" stroke="#F4516C" strokeWidth="6" strokeLinecap="round" /></svg>
              <span className="a"><Avatar size={130} initials={(f.name || 'S').slice(0, 1).toUpperCase()} ring="#fff" /></span>
              <span className="b"><Avatar size={130} src={h.photo} ring="#fff" /></span>
              <span className="heart"><Icon name="heart" size={26} fill="#F4516C" /></span>
            </div>
            <p className="small muted mt-10">{t('fam.match.familyOf', { name: f.name || 'Santos', city: t(`cities.${f.city}`) })}</p>
            <p className="dlead">{t('fam.match.body', { name: h.firstName })}</p>
            <div className="dsteps">
              <div className="eyebrow">{t('fam.match.stepsTitle')}</div>
              {[['chat', 's1'], ['pin', 's2'], ['alert', 's3']].map(([ic, k]) => <div key={k} className="dsteps__row"><Icon name={ic} size={18} /><span>{t(`fam.match.${k}`)}</span></div>)}
            </div>
            <div className="dactions">
              <Button kind="ghost" block={false} onClick={() => nav('f-discover')}>{t('fam.match.keepBrowsing')}</Button>
              <Button icon="chat" block={false} onClick={() => nav('f-chat', id, { replace: true })} testId="say-hello">{t('fam.match.sayHello')}</Button>
            </div>
          </div>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="family"
      header={<TopBar right={<IconButton name="x" label={t('common.close')} onClick={() => nav('f-discover')} />} />}
      footer={<Footer><Button icon="chat" onClick={() => nav('f-chat', id, { replace: true })} testId="say-hello">{t('fam.match.sayHello')}</Button><Button kind="ghost" onClick={() => nav('f-discover')}>{t('fam.match.keepBrowsing')}</Button></Footer>}>
      <div className="pad center">
        <div className="kicker">{t('fam.match.kicker')}</div>
        <h1 className="h1 mt-8">{t('fam.match.title', { name: h.firstName })}</h1>
        <div className="pair">
          <svg className="arc" width="280" height="60" viewBox="0 0 280 60" aria-hidden="true"><path d="M60 52 C 110 0, 170 0, 220 52" fill="none" stroke="#F4516C" strokeWidth="6" strokeLinecap="round" /></svg>
          <span className="a"><Avatar size={130} initials={(f.name || 'S').slice(0, 1).toUpperCase()} ring="#fff" /></span>
          <span className="b"><Avatar size={130} src={h.photo} ring="#fff" /></span>
          <span className="heart"><Icon name="heart" size={26} fill="#F4516C" /></span>
        </div>
        <p className="small muted mt-10">{t('fam.match.familyOf', { name: f.name || 'Santos', city: t(`cities.${f.city}`) })}</p>
        <p className="mt-14" style={{ fontSize: 15 }}>{t('fam.match.body', { name: h.firstName })}</p>
      </div>
      <div className="pad">
        <Card className="mt-20">
          <div className="eyebrow">{t('fam.match.stepsTitle')}</div>
          <div className="stack gap-10 mt-10">
            {[['chat', 's1'], ['pin', 's2'], ['alert', 's3']].map(([ic, k]) => <div key={k} className="row gap-10" style={{ alignItems: 'flex-start', fontSize: 14 }}><span style={{ color: 'var(--coral-deep)' }}><Icon name={ic} size={18} /></span><span>{t(`fam.match.${k}`)}</span></div>)}
          </div>
        </Card>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

// ---------- Chat ----------
export function FamilyChat({ id, hireOpen = false }: { id: string; hireOpen?: boolean }) {
  const t = useT();
  const f = useStore(s => s.family);
  const h = helperById(id);
  const c = f.chats[id];
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [call, setCall] = useState(false);
  const [report, setReport] = useState(false);
  const [hire, setHire] = useState(hireOpen);
  const idStatus = useStore(s => s.live?.idStatus ?? 'none');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const desk = useIsDesktop();
  useEffect(() => { setUi({ activeChat: 'f-' + id }); markMatchSeen('family', id); return () => setUi({ activeChat: null }); }, [id]);
  useEffect(() => watchChat(id), [id]);
  useEffect(() => { readChat('family', id); const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [c?.messages.length, c?.typing]);
  useEffect(() => { setHire(hireOpen); }, [hireOpen]);
  if (!h || !c || f.blocked.includes(id)) return <NotFound />;
  const can = familyCanSend(id);
  const unlocked = chatUnlocked(f, id);
  const hired = f.hires.some(x => x.helperId === id);
  // The household ID check comes before the first message (and the server says 'needs_id' too).
  const startGate = () => { setUi({ idReturn: 'f-chat-' + id }); nav('f-idcheck'); };
  const openPlan = () => (can === 'needs_id' ? startGate() : setCall(true));
  const send = (body = text) => {
    const r = sendFamilyMessage(id, body);
    if (r instanceof Promise) setText('');
    settle(r, v => {
      if (v === 'ok') { setText(''); return; }
      if (r instanceof Promise && v !== 'empty') setText(body);
      if (v === 'capped' || v === 'locked') openPlans(v === 'capped' ? 'chats' : 'chat', 'f-chat-' + id, id);
    });
  };
  const block = () => {
    blockParty('family', id); nav('f-inbox', undefined, { replace: true });
    toast(t('chat.blocked', { name: h.firstName }), { action: { label: t('common.undo'), run: () => unblockParty('family', id) } });
  };
  const starters = [t('chat.stStart'), t('chat.stKids'), t('chat.stRest')];
  const placeholder = can === 'ok' ? (c.messages.some(m => m.from === 'me') || unlocked ? t('chat.placeholder') : t('chat.placeholderOpener')) : t('chat.placeholderLocked');
  const head = (
    <header className="chat-head">
      {!desk && <IconButton name="back" label={t('common.back')} variant="iconbtn--plain" onClick={() => back('f-inbox')} />}
      <button type="button" className="chat-head__who row gap-10" onClick={() => nav('f-helper', id)}>
        <Avatar src={h.photo} initials={h.firstName[0]} size={40} />
        <span className="flex1 who"><b>{helperName(h)}</b><span><SampleTag on={h.sample} tone="muted" />{helperRoles(t, h)} · {t(`cities.${h.city}`)}</span></span>
      </button>
      <IconButton name="calendar" label={t('chat.plan')} onClick={openPlan} testId="chat-plan" />
      <IconButton name="more" label={t('common.more')} variant="iconbtn--plain" onClick={() => setMenu(true)} testId="chat-more" />
    </header>
  );
  const note = <Note tone="warn" icon="alert" bar>{t('chat.safetyFamily')}</Note>;
  const composer = can === 'needs_id' ? <IdGate side="family" status={idStatus} onStart={startGate} /> : (
    <>
      {can === 'ok' && <div className="starters">
        <Chip small icon="calendar" onClick={openPlan}>{t('chat.stCall')}</Chip>
        {starters.map(s => <Chip key={s} small onClick={() => setText(s)}>{s}</Chip>)}
      </div>}
      <form className="composer" onSubmit={e => { e.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="fmsg">{t('chat.placeholder')}</label>
        <input id="fmsg" className="composer__input" value={text} placeholder={placeholder} disabled={can !== 'ok'} onChange={e => setText((e.target as HTMLInputElement).value)} data-testid="composer" />
        <button type="submit" className="iconbtn send" aria-label={t('chat.send')} disabled={can !== 'ok' || !text.trim()} data-testid="send"><Icon name="send" size={20} /></button>
      </form>
    </>
  );
  const overlay = (
    <>
      {menu && (
        <Sheet title={helperName(h)} onClose={() => setMenu(false)} testId="chat-menu">
          <button type="button" className="menu-item" onClick={() => { setMenu(false); nav('f-helper', id); }}><Icon name="user" size={20} />{t('chat.mViewProfile')}</button>
          <button type="button" className="menu-item" onClick={() => { setMenu(false); openPlan(); }}><Icon name="calendar" size={20} />{t('chat.mCall')}</button>
          {hired ? <button type="button" className="menu-item" onClick={() => { setMenu(false); nav('f-checklist'); }}><Icon name="doc" size={20} />{t('chat.mChecklist')}</button>
            : <button type="button" className="menu-item" onClick={() => { setMenu(false); setHire(true); }} data-testid="menu-hired"><Icon name="check" size={20} />{t('chat.mHired')}</button>}
          <button type="button" className="menu-item" onClick={() => { setMenu(false); setReport(true); }}><Icon name="flag" size={20} />{t('chat.mReport')}</button>
          <button type="button" className="menu-item menu-item--danger" onClick={() => { setMenu(false); block(); }}><Icon name="ban" size={20} />{t('chat.mBlock', { name: h.firstName })}</button>
        </Sheet>
      )}
      {call && <PlanSheet name={h.firstName} onClose={() => setCall(false)} onSend={p => { setCall(false); settle(planFamilyCall(id, p), r => { if (r === 'needs_id') startGate(); }); }} />}
      {report && <ReportSheet side="family" id={id} name={h.firstName} onClose={() => setReport(false)} />}
      {hire && (
        <Sheet onClose={() => { setHire(false); if (hireOpen) nav('f-chat', id, { replace: true }); }} testId="hire-sheet"
          actions={<><Button onClick={() => { markFamilyHired(id); setHire(false); nav('f-checklist', undefined, { replace: hireOpen }); }} testId="confirm-hired">{t('fam.hired.yes')}</Button>
            <Button kind="ghost" onClick={() => { setHire(false); if (hireOpen) nav('f-chat', id, { replace: true }); }}>{t('fam.hired.notYet')}</Button></>}>
          <div className="center">
            <div className="row" style={{ justifyContent: 'center' }}><Avatar src={h.photo} size={72} ring="var(--blush)" /></div>
            <h2 className="sheet__title mt-14" style={{ fontSize: 22 }}>{t('fam.hired.title', { name: h.firstName })}</h2>
            <p className="lead">{t('fam.hired.body', { name: h.firstName })}</p>
          </div>
        </Sheet>
      )}
    </>
  );
  const msgs = (
    <div className="msgs">
      <div className="sys"><Tag tone="white" icon="heart">{t('chat.matched', { when: dayClock(t, c.matchedAt) })}</Tag></div>
      {!c.messages.some(m => m.from === 'me') && !unlocked && can === 'ok' && <Note tone="info" icon="info">{t('chat.openerHint', { name: h.firstName })}</Note>}
      {c.messages.map(m => <MessageView key={m.id} m={m} side="family" otherName={h.firstName} />)}
      {c.typing && <TypingDots name={h.firstName} />}
      {can === 'locked' && (
        <div className="sys-card sys-card--dashed" data-testid="locked-card">
          <div className="row" style={{ justifyContent: 'center', color: 'var(--coral-deep)' }}><Icon name="lock" size={22} /></div>
          <div className="strong mt-6" style={{ fontSize: 15 }}>{t('chat.openerUsedTitle')}</div>
          <div className="small muted mt-4" style={{ fontSize: 13 }}>{t('chat.openerUsedBody', { name: h.firstName })}</div>
          <div className="mt-12"><Button size="md" onClick={() => openPlans('chat', 'f-chat-' + id, id)} testId="keep-chatting">{t('chat.keepChatting', { price: peso(PRICES.chat_unlock) })}</Button></div>
        </div>
      )}
      {can === 'capped' && (
        <div className="sys-card sys-card--dashed">
          <div className="strong" style={{ fontSize: 15 }}>{t('chat.cappedTitle', { n: freeChatCap })}</div>
          <div className="small muted mt-4">{t('chat.cappedBody', { n: freeChatCap })}</div>
          <div className="mt-12"><Button size="md" onClick={() => openPlans('chats', 'f-chat-' + id, id)}>{t('chat.keepChatting', { price: peso(PRICES.chat_unlock) })}</Button></div>
        </div>
      )}
    </div>
  );
  if (desk) {
    // Pattern F: conversation list, thread, context panel.
    return (
      <Screen tone="cream" side="family" label={helperName(h)} nav={<FamilyNav active="messages" />} wide desk="chat" overlay={overlay}>
        <div className="panes">
          <FamilyConvList activeId={id} />
          <section className="thread" aria-label={helperName(h)}>
            {head}{note}
            <div className="thread__scroll" ref={scrollRef}>{msgs}</div>
            {composer}
          </section>
          <aside className="ctx">
            <div className="ctx__who">
              <Avatar src={h.photo} initials={h.firstName[0]} size={88} />
              <h2 className="h3 mt-12">{helperName(h)}, {h.age}</h2>
              <SampleTag on={h.sample} tone="muted" />
              <div className="small muted">{helperRoles(t, h)} · {t(`cities.${h.city}`)}</div>
              <div className="ctx__rate">{t('fam.discover.rateFact', { amount: peso(h.rate) })}</div>
              {hired && <Tag tone="ok" icon="check">{t('fam.profile.hiredBadge')}</Tag>}
              <Button kind="ghost" size="sm" block={false} icon="user" onClick={() => nav('f-helper', id)}>{t('chat.mViewProfile')}</Button>
            </div>
            <div className="ctx__sec">
              <div className="eyebrow">{t('fam.profile.checksTitle')}</div>
              {helperChecks(t, h)}
            </div>
            <div className="ctx__sec">
              <button type="button" className="menu-item" onClick={openPlan} data-testid="ctx-plan"><Icon name="calendar" size={20} />{t('chat.mCall')}</button>
              {hired ? <button type="button" className="menu-item" onClick={() => nav('f-checklist')}><Icon name="doc" size={20} />{t('chat.mChecklist')}</button>
                : <button type="button" className="menu-item" onClick={() => setHire(true)} data-testid="ctx-hired"><Icon name="check" size={20} />{t('chat.mHired')}</button>}
              <button type="button" className="menu-item" onClick={() => setReport(true)}><Icon name="flag" size={20} />{t('chat.mReport')}</button>
              <button type="button" className="menu-item menu-item--danger" onClick={block}><Icon name="ban" size={20} />{t('chat.mBlock', { name: h.firstName })}</button>
            </div>
          </aside>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="cream" side="family" scrollRef={scrollRef} label={helperName(h)}
      header={<>{head}{note}</>}
      footer={composer}
      overlay={overlay}>
      {msgs}
    </Screen>
  );
}

// Conversation list for the desktop messages panes (pattern F).
function FamilyConvList({ activeId }: { activeId?: string }) {
  const t = useT();
  const s = useStore(st => st);
  const f = s.family;
  const likedN = likedYouCount(s);
  const matches = f.matches.filter(id => !f.blocked.includes(id) && helperById(id));
  const fresh = matches.filter(id => !f.chats[id]?.messages.some(m => m.from === 'me'));
  const talking = matches.filter(id => f.chats[id]?.messages.length).sort((a, b) => lastAt(f.chats[b]) - lastAt(f.chats[a]));
  const plan = isPremium(f) ? ['premiumTitle', f.premiumUntil] as const : hasPass(f) ? ['passTitle', f.passUntil] as const : null;
  return (
    <div className="convs">
      <div className="convs__head">
        <h1 className="convs__title">{t('fam.inbox.title')}</h1>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected="true" className="is-on" onClick={() => nav('f-inbox')}>{t('fam.inbox.chats')}</button>
          <button type="button" role="tab" aria-selected="false" onClick={() => nav('f-likes')} data-testid="tab-likes">{t('fam.inbox.likesYou')}{likedN ? ` · ${likedN}` : ''}</button>
        </div>
        {plan ? (
          <button type="button" className="convs__plan" onClick={() => openPlans('generic', 'f-inbox')}>
            <Icon name="star" size={16} /><span className="flex1"><b>{t(`fam.plans.${plan[0]}`)}</b> · {t('fam.plans.active', { plan: '', n: planLeft(plan[1]).days }).replace(/^.*·\s*/, '')}</span><span className="convs__manage">{t('fam.inbox.manage')}</span>
          </button>
        ) : <Note className="mt-12" tone="info" icon="info">{t('fam.inbox.freeRule', { n: freeChatCap, used: openFreeChats(f) })}</Note>}
      </div>
      {fresh.length > 0 && (
        <div className="convs__strip">
          <div className="eyebrow">{t('fam.inbox.newMatches')}</div>
          <div className="convs__fresh">
            {fresh.map(id => { const h = helperById(id)!; return (
              <button key={id} type="button" className={id === activeId ? 'is-active' : ''} onClick={() => nav('f-chat', id)}>
                <Avatar src={h.photo} initials={h.firstName[0]} size={56} ring={f.seenMatches.includes(id) ? '#fff' : 'var(--coral)'} />{h.firstName}
              </button>
            ); })}
          </div>
        </div>
      )}
      <div className="convs__list">
        {matches.length === 0 && <Empty icon="chat" title={t('fam.inbox.empty')} body={t('fam.inbox.emptyBody')} />}
        {talking.map(id => {
          const h = helperById(id)!; const c = f.chats[id];
          const hired = f.hires.some(x => x.helperId === id);
          return (
            <button key={id} type="button" className={`list-row${id === activeId ? ' is-active' : ''}`} onClick={() => nav('f-chat', id)} data-testid={`chat-row-${id}`}>
              <Avatar src={h.photo} initials={h.firstName[0]} size={48} />
              <div className="flex1">
                <div className="row gap-8"><b>{helperName(h)}</b>{hired && <Tag tone="ok" icon="check">{t('fam.inbox.hiredTag')}</Tag>}</div>
                <small className="convs__preview" style={{ fontWeight: c.unread ? 600 : 400, color: c.unread ? 'var(--navy)' : undefined }}>{c.typing ? t('chat.typing', { name: h.firstName }) : lastPreview(t, c, h.firstName) || t('fam.inbox.sayHello')}</small>
              </div>
              <div className="stack gap-6" style={{ alignItems: 'flex-end' }}><span className="small muted">{ago(t, lastAt(c))}</span>{c.unread > 0 && <span className="tabbar__badge" style={{ position: 'static' }}>{c.unread}</span>}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Plans ----------
export function FamilyPlans() {
  const t = useT();
  const f = useStore(s => s.family);
  const ctx = useUi(s => s.plansCtx) ?? { kind: 'generic' as const, returnTo: 'f-discover' };
  const target = ctx.target ? helperById(ctx.target) : undefined;
  const showUnlock = (ctx.kind === 'chat' || ctx.kind === 'chats') && !!target;
  const [pick, setPick] = useState<Product>('pass');
  const busy = useUi(s => s.busy);
  const desk = useIsDesktop();
  const title = target && showUnlock ? t('fam.plans.title', { name: target.firstName }) : t('fam.plans.titleGeneric');
  const ctxLine = ctx.kind === 'limit' ? t('fam.plans.ctxLimit') : ctx.kind === 'filters' ? t('fam.plans.ctxFilters') : ctx.kind === 'likes' ? t('fam.plans.ctxLikes')
    : ctx.kind === 'chats' ? t('fam.plans.ctxChats', { n: freeChatCap }) : ctx.kind === 'report' ? t('fam.plans.ctxReport', { price: peso(PRICES.report) }) : null;
  const plan = (item: Product, name: string, per: string, lines: string[], ribbon?: string) => (
    <button type="button" className={`plan${pick === item ? ' is-on' : ''}`} aria-pressed={pick === item ? 'true' : 'false'} onClick={() => setPick(item)} data-testid={`plan-${item}`}>
      {ribbon && <span className="plan__ribbon"><Tag tone="solid">{ribbon}</Tag></span>}
      <span className="plan__top"><span className="radio" /><span className="plan__name">{name}</span>
        <span className="plan__price"><b>{peso(PRICES[item])}</b><small>{per}</small></span></span>
      <ul>{lines.map(l => <li key={l}><Icon name="check" size={15} sw={2.6} />{l}</li>)}</ul>
    </button>
  );
  const active = isPremium(f) ? t('fam.plans.active', { plan: t('fam.plans.premiumTitle'), n: planLeft(f.premiumUntil).days })
    : hasPass(f) ? t('fam.plans.active', { plan: t('fam.plans.passTitle'), n: planLeft(f.passUntil).days }) : null;
  if (desk) {
    // Pattern G: three plan cards in a row, the urgent strip, then a two-column FAQ.
    const current = isPremium(f) ? 'premium' : hasPass(f) ? 'pass' : 'free';
    const card = (item: Product, name: string, per: string, lines: string[], ribbon?: string) => (
      <button type="button" className={`plan dplan${pick === item ? ' is-on' : ''}${item === 'pass' ? ' dplan--hi' : ''}`} aria-pressed={pick === item ? 'true' : 'false'} onClick={() => setPick(item)} data-testid={`plan-${item}`}>
        {ribbon && <span className="plan__ribbon"><Tag tone="solid">{ribbon}</Tag></span>}
        <span className="dplan__head"><span className="radio" /><span className="plan__name">{name}</span>{current === item && <Tag tone="ok">{t('desk.plans.current')}</Tag>}</span>
        <span className="dplan__price"><b>{peso(PRICES[item])}</b><small>{per}</small></span>
        <ul>{lines.map(l => <li key={l}><Icon name="check" size={16} sw={2.6} />{l}</li>)}</ul>
      </button>
    );
    return (
      <Screen tone="cream" side="family" nav={<FamilyNav />} desk="plans"
        header={<><BackLink onClick={() => back(ctx.returnTo)} /><PageHead title={title} sub={<>{ctxLine ? ctxLine + ' ' : ''}{t('fam.plans.body')}</>} /></>}>
        {active && <Note className="dnote" icon="check">{active}</Note>}
        <div className="plans3">
          {showUnlock ? card('chat_unlock', t('fam.plans.unlockTitle'), t('fam.plans.unlockPer'), [t('fam.plans.unlockF1', { name: target!.firstName })]) : (
            <div className="plan dplan dplan--free">
              <span className="dplan__head"><span className="plan__name">{t('fam.me.free')}</span>{current === 'free' && <Tag tone="ok">{t('desk.plans.current')}</Tag>}</span>
              <span className="dplan__price"><b>{peso(0)}</b><small>{t('common.free')}</small></span>
              <ul>{[t('desk.plans.freeL1', { n: FREE_LIKES_PER_DAY }), t('desk.plans.freeL2'), t('desk.plans.freeL3', { n: freeChatCap })].map(l => <li key={l}><Icon name="check" size={16} sw={2.6} />{l}</li>)}</ul>
            </div>
          )}
          {card('pass', t('fam.plans.passTitle'), t('fam.plans.passPer'), [t('fam.plans.passF1'), t('fam.plans.passF2'), t('fam.plans.passF3')], t('fam.plans.passRibbon'))}
          {card('premium', t('fam.plans.premiumTitle'), t('fam.plans.premiumPer'), [t('fam.plans.premiumF1'), t('fam.plans.premiumF2')], t('fam.plans.premiumRibbon'))}
        </div>
        <div className="plans-cta">
          <span className="muted">{t('fam.plans.methods')}</span>
          <Button block={false} disabled={busy} onClick={() => startCheckout(pick, ctx.returnTo, pick === 'chat_unlock' ? ctx.target : undefined)} testId="plans-continue">{t('fam.plans.cta', { price: peso(PRICES[pick]) })}</Button>
        </div>
        <button type="button" className="banner urgent-strip" onClick={() => startCheckout('urgent', 'f-discover')} data-testid="urgent">
          <span className="urgent-strip__icon"><Icon name="zap" size={22} /></span>
          <span className="flex1"><strong>{t('fam.plans.urgentT')}</strong> {t('fam.plans.urgentBody', { price: peso(PRICES.urgent) })}</span>
          <span className="urgent-strip__price">{peso(PRICES.urgent)}<Icon name="next" size={18} /></span>
        </button>
        <section className="faq">
          <h2 className="h2">{t('desk.plans.faqT')}</h2>
          <div className="faq__grid">
            {['1', '2', '3', '4'].map(n => <div key={n} className="faq__item"><b>{t(`desk.plans.q${n}`)}</b><p>{t(`desk.plans.a${n}`)}</p></div>)}
          </div>
        </section>
      </Screen>
    );
  }
  return (
    <Screen tone="cream" side="family"
      header={<TopBar right={<IconButton name="x" label={t('common.close')} onClick={() => back(ctx.returnTo)} />} />}
      footer={<Footer><Button disabled={busy} onClick={() => startCheckout(pick, ctx.returnTo, pick === 'chat_unlock' ? ctx.target : undefined)} testId="plans-continue">{t('fam.plans.cta', { price: peso(PRICES[pick]) })}</Button><div className="footer__fine">{t('fam.plans.methods')}</div></Footer>}>
      <div className="pad">
        <h1 className="h1">{title}</h1>
        <p className="lead">{ctxLine ? ctxLine + ' ' : ''}{t('fam.plans.body')}</p>
        {active && <Note className="mt-12" icon="check">{active}</Note>}
        {showUnlock && plan('chat_unlock', t('fam.plans.unlockTitle'), t('fam.plans.unlockPer'), [t('fam.plans.unlockF1', { name: target!.firstName })])}
        {plan('pass', t('fam.plans.passTitle'), t('fam.plans.passPer'), [t('fam.plans.passF1'), t('fam.plans.passF2'), t('fam.plans.passF3')], t('fam.plans.passRibbon'))}
        {plan('premium', t('fam.plans.premiumTitle'), t('fam.plans.premiumPer'), [t('fam.plans.premiumF1'), t('fam.plans.premiumF2')], t('fam.plans.premiumRibbon'))}
        <button type="button" className="banner mt-14" style={{ background: '#fff', border: '1.5px solid var(--line)' }} onClick={() => startCheckout('urgent', 'f-discover')} data-testid="urgent">
          <span style={{ color: 'var(--coral-deep)' }}><Icon name="zap" size={20} /></span>
          <span className="flex1"><strong style={{ fontWeight: 600 }}>{t('fam.plans.urgentT')}</strong> {t('fam.plans.urgentBody', { price: peso(PRICES.urgent) })}</span>
          <Icon name="next" size={18} />
        </button>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

// ---------- Checkout ----------
type Method = 'qrph' | 'gcash' | 'maya' | 'card';
export function FamilyCheckout() {
  const t = useT();
  const ctx = useUi(s => s.checkout);
  const [method, setMethod] = useState<Method>('qrph');
  const [phase, setPhase] = useState<'select' | 'processing' | 'done' | 'confirming' | 'waiting'>(ctx?.returned === 'paid' ? 'confirming' : 'select');
  const [ref, setRef] = useState(() => (ctx?.purchaseId ? purchaseRef(ctx.purchaseId) : 'YM-' + String(Math.floor(10000 + Math.random() * 89999))));
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + QR_TTL_SEC * 1000);
  const [nowTs, setNow] = useState(Date.now());
  const [card, setCard] = useState({ num: '4242 4242 4242 4242', exp: '12/28', cvc: '123', name: '' });
  const [cardErr, setCardErr] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ method: string; at: number } | null>(null);
  const desk = useIsDesktop();
  useEffect(() => { if (!ctx) nav('f-plans', undefined, { replace: true }); }, [ctx]);
  useEffect(() => { // a PayMongo return that arrived after this screen mounted
    if (ctx?.returned === 'paid' && phase === 'select') { setPhase('confirming'); if (ctx.purchaseId) setRef(purchaseRef(ctx.purchaseId)); }
  }, [ctx?.returned, ctx?.purchaseId]);
  // live: back from PayMongo, wait for the webhook to mark the purchase paid
  useEffect(() => {
    if (phase !== 'confirming' || !ctx?.purchaseId) return;
    let alive = true;
    void waitForPaid(ctx.purchaseId).then(r => {
      if (!alive) return;
      if (r === 'paid') {
        const p = getState().family.purchases.find(x => x.id === ctx.purchaseId);
        setPaid({ method: p?.method ?? 'PayMongo', at: p?.at ?? Date.now() });
        setPhase('done');
      } else setPhase(r === 'failed' ? 'select' : 'waiting');
    });
    return () => { alive = false; };
  }, [phase]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  // QR Ph: the bank confirms on its own, like a webhook
  useEffect(() => {
    if (!ctx || method !== 'qrph' || phase !== 'select') return;
    const id = window.setTimeout(() => finish('QR Ph'), 5500);
    return () => window.clearTimeout(id);
  }, [method, phase, expiresAt]);
  if (!ctx) return null;
  const item = ctx.item;
  const amount = peso(PRICES[item]);
  const left = Math.max(0, Math.round((expiresAt - nowTs) / 1000));
  const finish = (label: string) => {
    setPhase('processing');
    const go = () => settle(completePurchase(item, label, ctx.target), r => {
      if (!r) { setPhase('select'); return; }
      setRef(r);
      setPaid({ method: label, at: Date.now() });
      setPhase('done');
    });
    if (LIVE) go(); else window.setTimeout(go, 1200);
  };
  const demoLine = LIVE ? t('live.testPay') : t('fam.checkout.demo');
  if (phase === 'confirming' || phase === 'waiting') {
    const body = (
      <div className="center">
        {phase === 'confirming' ? <span className="spinner" style={{ width: 44, height: 44, borderWidth: 5, margin: '0 auto' }} /> : <span className="success__icon success__icon--wait" style={{ margin: '0 auto' }}><Icon name="clock" size={34} /></span>}
        <h1 className={desk ? 'h1 mt-16' : 'h3 mt-16'} data-testid="pay-confirming">{phase === 'confirming' ? t('live.confirming') : t('live.notYet')}</h1>
        {phase === 'confirming' && <p className="dlead">{t('live.confirmingS')}</p>}
        {phase === 'waiting' && <div className="dactions"><Button block={false} onClick={() => setPhase('confirming')}>{t('live.retry')}</Button></div>}
      </div>
    );
    return desk
      ? <Screen tone="cream" side="family" nav={<FamilyNav />} desk="center"><div className="dcenter"><div className="dcard">{body}</div></div></Screen>
      : <Screen tone="cream" side="family" header={<TopBar back="f-plans" />}><div className="success">{body}</div></Screen>;
  }
  const methods: { v: Method; label: string }[] = [{ v: 'qrph', label: t('fam.checkout.qrph') }, { v: 'gcash', label: t('fam.checkout.gcash') }, { v: 'maya', label: t('fam.checkout.maya') }, { v: 'card', label: t('fam.checkout.card') }];
  if (phase === 'done') {
    const backLabel = ctx.returnTo.startsWith('f-chat') ? t('fam.checkout.backToChat') : t('fam.checkout.continue');
    const done = () => { setUi({ checkout: null }); nav(ctx.returnTo, undefined, { replace: true }); };
    if (desk) {
      // Pattern I with the receipt table.
      return (
        <Screen tone="cream" side="family" nav={<FamilyNav />} desk="center">
          <div className="dcenter">
            <div className="dcard center">
              <span className="success__icon" style={{ margin: '0 auto' }}><Icon name="check" size={36} sw={2.6} /></span>
              <h1 className="h1 mt-16">{t('fam.checkout.success')}</h1>
              <p className="dlead">{t(`fam.checkout.toast.${item}`)}</p>
              <table className="receipt">
                <tbody>
                  <tr><th scope="row">{t('desk.receipt.item')}</th><td>{t(`fam.checkout.items.${item}`)}<small>{t(`fam.checkout.notes.${item}`)}</small></td></tr>
                  <tr><th scope="row">{t('desk.receipt.paidWith')}</th><td>{paid?.method ?? ''}</td></tr>
                  <tr><th scope="row">{t('desk.receipt.ref')}</th><td>{ref}</td></tr>
                  <tr><th scope="row">{t('desk.receipt.date')}</th><td>{dayClock(t, paid?.at ?? Date.now())}</td></tr>
                  <tr className="receipt__total"><th scope="row">{t('desk.receipt.amount')}</th><td>{amount}</td></tr>
                </tbody>
              </table>
              <p className="small muted mt-14">{demoLine}</p>
              <div className="dactions"><Button block={false} onClick={done} testId="checkout-done">{backLabel}</Button></div>
            </div>
          </div>
        </Screen>
      );
    }
    return (
      <Screen tone="cream" side="family" footer={<Footer><Button onClick={done} testId="checkout-done">{backLabel}</Button></Footer>}>
        <div className="success">
          <span className="success__icon"><Icon name="check" size={36} sw={2.6} /></span>
          <h1 className="h1 mt-8">{t('fam.checkout.success')}</h1>
          <p className="lead">{t(`fam.checkout.toast.${item}`)}</p>
          <Card tone="flat" className="mt-12" style={{ width: '100%', textAlign: 'left' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span className="strong">{t(`fam.checkout.items.${item}`)}</span><span className="strong">{amount}</span></div>
            <div className="small muted mt-4">{t('fam.checkout.ref', { ref })}</div>
          </Card>
          <p className="small muted">{demoLine}</p>
        </div>
      </Screen>
    );
  }
  const methodLabel = methods.find(m => m.v === method)!.label;
  const pay = () => {
    if (method === 'card') {
      const digits = card.num.replace(/\D/g, '');
      if (digits.length < 15 || !/^\d{2}\/\d{2}$/.test(card.exp) || card.cvc.length < 3 || !card.name.trim()) { setCardErr(t('fam.checkout.nameOnCard')); return; }
    }
    finish(methodLabel);
  };
  const payBtn = <Button disabled={phase === 'processing'} testId="pay" onClick={pay}>{phase === 'processing' ? t('fam.checkout.processing', { method: methodLabel }) : t('fam.checkout.payWith', { amount, method: methodLabel })}</Button>;
  const itemIcon = item === 'urgent' ? 'zap' : item === 'report' ? 'file' : item === 'chat_unlock' ? 'chat' : 'heart';
  const methodBody = (
    <>
      {method === 'qrph' && (
        <div className="qrbox">
          <Card className="mt-12">
            {left > 0 ? <>
              <div className="row" style={{ justifyContent: 'center', marginBottom: 10 }}><Tag tone="ok">{t('fam.checkout.lowestFee')}</Tag></div>
              <div className="qr-wrap"><QrCode seed={ref.length * 7 + 3} label="QR Ph" /></div>
              <div className="center strong mt-10" style={{ fontSize: 13 }}>{t('fam.checkout.ref', { ref })} · {t('fam.checkout.expires', { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` })}</div>
              <p className="center small muted mt-6">{t('fam.checkout.qrHow')}</p>
            </> : <div className="center"><p className="strong">{t('fam.checkout.expired')}</p><div className="mt-12"><Button kind="ghost" size="md" onClick={() => setExpiresAt(Date.now() + QR_TTL_SEC * 1000)}>{t('fam.checkout.newQr')}</Button></div></div>}
          </Card>
          <div className="row gap-8 mt-12">
            <button type="button" className="tile-btn" onClick={() => toast(t('fam.checkout.savedQr'))}><Icon name="download" size={20} />{t('fam.checkout.saveQr')}</button>
            <button type="button" className="tile-btn" onClick={() => toast(t('fam.checkout.openApp', { app: 'GCash' }))}><Icon name="phone" size={20} />{t('fam.checkout.openGcash')}</button>
            <button type="button" className="tile-btn" onClick={() => toast(t('fam.checkout.openApp', { app: 'Maya' }))}><Icon name="phone" size={20} />{t('fam.checkout.openMaya')}</button>
          </div>
          <div className="row gap-10 mt-14 strong" style={{ fontSize: 13.5 }} aria-live="polite">
            {phase === 'processing' ? <><span className="spinner" />{t('fam.checkout.processing', { method: 'QR Ph' })}</> : <><span className="spinner" />{t('fam.checkout.waiting')}</>}
          </div>
          <Note className="mt-10">{t('fam.checkout.noScreens')}</Note>
          <p className="small muted center mt-10">{demoLine}</p>
        </div>
      )}
      {(method === 'gcash' || method === 'maya') && (
        <Card className="mt-12"><p style={{ fontSize: 15 }}>{t('fam.checkout.walletBody', { amount, app: methodLabel })}</p></Card>
      )}
      {method === 'card' && (
        <div className="stack gap-12 mt-12">
          <Field label={t('fam.checkout.cardNumber')} value={card.num} inputMode="numeric" icon="card" onChange={v => setCard({ ...card, num: v.replace(/[^\d ]/g, '').slice(0, 19) })} />
          <div className="row gap-12">
            <div className="flex1"><Field label={t('fam.checkout.expiry')} value={card.exp} inputMode="numeric" onChange={v => setCard({ ...card, exp: v.slice(0, 5) })} /></div>
            <div className="flex1"><Field label={t('fam.checkout.cvc')} value={card.cvc} inputMode="numeric" onChange={v => setCard({ ...card, cvc: v.replace(/\D/g, '').slice(0, 4) })} /></div>
          </div>
          <Field label={t('fam.checkout.nameOnCard')} value={card.name} onChange={v => { setCard({ ...card, name: v }); setCardErr(null); }} error={cardErr} testId="card-name" />
        </div>
      )}
    </>
  );
  const methodChips = (
    <div className="chips chips--scroll mt-14" role="radiogroup" aria-label={t('fam.checkout.title')}>
      {methods.map(m => <Chip key={m.v} small on={method === m.v} onClick={() => { setMethod(m.v); setPhase('select'); }} testId={`method-${m.v}`}>{m.label}</Chip>)}
    </div>
  );
  if (desk) {
    // Pattern G checkout: order summary on the left, payment method panel on the right.
    return (
      <Screen tone="cream" side="family" nav={<FamilyNav />} desk="checkout"
        header={<><BackLink to="f-plans" /><PageHead title={t('fam.checkout.title')} /></>}>
        <div className="dgrid dgrid--checkout">
          <aside className="card osum">
            <div className="eyebrow">{t('desk.checkout.summary')}</div>
            <div className="row gap-12 mt-14">
              <span className="list-row__icon"><Icon name={itemIcon} size={20} /></span>
              <div className="flex1"><div className="strong">{t(`fam.checkout.items.${item}`)}</div><div className="small muted">{t(`fam.checkout.notes.${item}`)}</div></div>
            </div>
            <div className="osum__rows">
              <div className="row"><span className="flex1">{t(`fam.checkout.items.${item}`)}</span><span>{amount}</span></div>
              <div className="row osum__total"><span className="flex1">{t('desk.checkout.total')}</span><span>{amount}</span></div>
            </div>
            {method !== 'qrph' && <Note className="mt-16" icon="info">{t('fam.checkout.noScreens')}</Note>}
            <p className="small muted mt-12">{t('fam.plans.methods')} {demoLine}</p>
          </aside>
          <section className={`card paypanel paypanel--${method}`}>
            <h2 className="h3">{t('desk.checkout.method')}</h2>
            {methodChips}
            {methodBody}
            {method !== 'qrph' && <div className="paypanel__go">{payBtn}<span className="small muted">{demoLine}</span></div>}
          </section>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="cream" side="family" header={<TopBar back="f-plans" title={t('fam.checkout.title')} />}
      footer={method === 'qrph' ? undefined : (
        <Footer>
          {payBtn}
          <div className="footer__fine">{demoLine}</div>
        </Footer>
      )}>
      <div className="pad-s">
        <Card>
          <div className="row gap-12">
            <span className="list-row__icon"><Icon name={itemIcon} size={20} /></span>
            <div className="flex1"><div className="strong">{t(`fam.checkout.items.${item}`)}</div><div className="small muted">{t(`fam.checkout.notes.${item}`)}</div></div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18 }}>{amount}</div>
          </div>
        </Card>
        {methodChips}
        {methodBody}
        <div className="spacer" />
      </div>
    </Screen>
  );
}

// ---------- Checklist ----------
export function FamilyChecklist() {
  const t = useT();
  const f = useStore(s => s.family);
  const hire = f.hires[0];
  const h = hire ? helperById(hire.helperId) : undefined;
  const desk = useIsDesktop();
  if (!hire || !h) {
    if (desk) {
      return (
        <Screen tone="cream" side="family" nav={<FamilyNav active="account" />} desk="checklist" header={<><BackLink to="f-me" /><PageHead title={t('fam.checklist.title')} /></>}>
          <Card><Empty icon="doc" title={t('fam.checklist.none')} body={t('fam.checklist.noneBody')} /></Card>
        </Screen>
      );
    }
    return (
      <Screen tone="cream" side="family" header={<TopBar back="f-me" title={t('fam.checklist.title')} />}>
        <Empty icon="doc" title={t('fam.checklist.none')} body={t('fam.checklist.noneBody')} />
      </Screen>
    );
  }
  const keys = ['contract', 'minWage', 'benefits', 'thirteenth', 'rest', 'payslip', 'noFees'];
  const done = keys.filter(k => hire.checklist[k]).length;
  const r = regionOf(f.city);
  if (desk) {
    return (
      <Screen tone="cream" side="family" nav={<FamilyNav active="messages" />} desk="checklist"
        header={<><BackLink to="f-inbox" /><PageHead title={t('fam.checklist.title')} sub={t('fam.checklist.intro')} /></>}>
        <div className="dgrid dgrid--checklist">
          <section className="card dlist">
            <div className="row gap-14">
              <Avatar src={h.photo} initials={h.firstName[0]} size={64} />
              <div className="flex1"><div className="h3">{t('fam.checklist.starts', { name: h.firstName })}</div><div className="small muted">{t('fam.checklist.hiredVia', { when: dayClock(t, hire.at) })}</div></div>
              <span className="small strong">{t('fam.checklist.progress', { done, total: keys.length })}</span>
            </div>
            <div className="bar mt-14" style={{ background: '#F1E1E5' }}><i style={{ width: `${(done / keys.length) * 100}%` }} /></div>
            <div className="mt-8">
              {keys.map(k => {
                const sub = k === 'minWage'
                  ? t('fam.checklist.minWageS', { region: t(`regions.${r}`), amount: peso(minWageFor(f.city).amount), name: h.firstName, rate: peso(h.rate) })
                  : t(`fam.checklist.${k}S`);
                return (
                  <div key={k} className="check-item">
                    <button type="button" role="checkbox" aria-checked={hire.checklist[k] ? 'true' : 'false'} aria-label={t(`fam.checklist.${k}`)} className="checkbox" onClick={() => toggleChecklist(h.id, k)} data-testid={`ck-${k}`}>
                      {hire.checklist[k] && <Icon name="check" size={15} sw={3} />}
                    </button>
                    <div className="flex1"><b>{t(`fam.checklist.${k}`)}</b><span>{sub}</span></div>
                  </div>
                );
              })}
            </div>
            <div className="row gap-12 mt-16">
              <p className="small muted flex1">{t('fam.checklist.footer')}</p>
              <Button block={false} onClick={() => nav('f-inbox')} testId="checklist-done">{t('common.done')}</Button>
            </div>
          </section>
          <aside className="stack gap-16">
            <div className="card">
              <h2 className="h3">{t('desk.checklist.wageT')}</h2>
              <WageTable />
            </div>
            <div className="card">
              <h2 className="h3">{t('desk.checklist.formsT')}</h2>
              <button type="button" className="list-row" onClick={() => toast(LIVE ? t('live.formHint') : t('fam.checklist.formDemo'))}><span className="list-row__icon"><Icon name="doc" size={19} /></span><div className="flex1"><b>{t('desk.checklist.bk1')}</b></div><span className="textlink">{t('desk.checklist.open')}</span></button>
              <button type="button" className="list-row" onClick={() => toast(LIVE ? t('live.formHint') : t('desk.checklist.formDemo2'))}><span className="list-row__icon"><Icon name="file" size={19} /></span><div className="flex1"><b>{t('desk.checklist.bk2')}</b></div><span className="textlink">{t('desk.checklist.open')}</span></button>
            </div>
            <div className="card card--navy row gap-14">
              <span className="path__icon"><Icon name="phone" size={22} /></span>
              <div className="flex1"><b className="h3" style={{ display: 'block', color: '#fff' }}>{t('desk.checklist.hotlineT')}</b><span className="small" style={{ color: 'rgba(255,255,255,.85)' }}>{t('desk.checklist.hotlineS')}</span></div>
            </div>
          </aside>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="cream" side="family" header={<TopBar back="f-inbox" title={t('fam.checklist.title')} />}
      footer={<Footer><Button onClick={() => nav('f-inbox')} testId="checklist-done">{t('common.done')}</Button></Footer>}>
      <div className="pad">
        <div className="row gap-12 mt-4">
          <Avatar src={h.photo} initials={h.firstName[0]} size={52} />
          <div className="flex1"><div className="h3">{t('fam.checklist.starts', { name: h.firstName })}</div><div className="small muted">{t('fam.checklist.hiredVia', { when: dayClock(t, hire.at) })}</div></div>
        </div>
        <p className="lead">{t('fam.checklist.intro')}</p>
        <div className="row gap-10 mt-12"><div className="bar flex1"><i style={{ width: `${(done / keys.length) * 100}%` }} /></div><span className="small strong">{t('fam.checklist.progress', { done, total: keys.length })}</span></div>
        <div className="mt-6">
          {keys.map(k => {
            const sub = k === 'minWage'
              ? t('fam.checklist.minWageS', { region: t(`regions.${r}`), amount: peso(minWageFor(f.city).amount), name: h.firstName, rate: peso(h.rate) })
              : t(`fam.checklist.${k}S`);
            return (
              <div key={k} className="check-item">
                <button type="button" role="checkbox" aria-checked={hire.checklist[k] ? 'true' : 'false'} aria-label={t(`fam.checklist.${k}`)} className="checkbox" onClick={() => toggleChecklist(h.id, k)} data-testid={`ck-${k}`}>
                  {hire.checklist[k] && <Icon name="check" size={15} sw={3} />}
                </button>
                <div className="flex1"><b>{t(`fam.checklist.${k}`)}</b><span>{sub}{k === 'contract' && <> <button type="button" style={{ border: 0, background: 'none', padding: 0, color: 'var(--coral-deep)', fontWeight: 600, fontSize: 12.5 }} onClick={() => toast(LIVE ? t('live.formHint') : t('fam.checklist.formDemo'))}>{t('fam.checklist.getForm')}</button></>}</span></div>
              </div>
            );
          })}
        </div>
        <p className="small muted mt-12">{t('fam.checklist.footer')}</p>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

// ---------- Inbox & likes ----------
export function FamilyInbox() {
  const t = useT();
  const route = useRoute();
  const s = useStore(st => st);
  const f = s.family;
  const tabs = useFamilyTabs();
  const tab = route.name === 'f-likes' ? 'likes' : 'chats';
  const liked = likedYouList(s);
  const likedN = likedYouCount(s);
  const matches = f.matches.filter(id => !f.blocked.includes(id) && helperById(id));
  const fresh = matches.filter(id => !f.chats[id]?.messages.some(m => m.from === 'me'));
  const talking = matches.filter(id => f.chats[id]?.messages.length).sort((a, b) => lastAt(f.chats[b]) - lastAt(f.chats[a]));
  const plan = isPremium(f) ? ['premiumTitle', f.premiumUntil] as const : hasPass(f) ? ['passTitle', f.passUntil] as const : null;
  const desk = useIsDesktop();
  if (desk) {
    if (tab === 'likes') return <FamilyLikesDesk />;
    // Pattern F with the list emphasized and an empty thread state.
    return (
      <Screen tone="cream" side="family" label={t('fam.inbox.title')} nav={<FamilyNav active="messages" />} wide desk="chat">
        <div className="panes panes--2">
          <FamilyConvList />
          <EmptyThread side="family">{matches.length === 0 && <Button block={false} to="f-discover">{t('fam.inbox.toDiscover')}</Button>}</EmptyThread>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="cream" side="family" label={t('fam.inbox.title')}
      header={<div className="row" style={{ justifyContent: 'space-between', padding: 'calc(16px + var(--safe-t)) 20px 0' }}><h1 className="h1 h1--sm">{t('fam.inbox.title')}</h1></div>}
      tabbar={tabs(tab === 'likes' ? t('tabs.likes') : t('tabs.messages'))}>
      <div className="pad-s mt-12">
        {plan ? (
          <Card tone="navy">
            <div className="row gap-12">
              <span className="path__icon" style={{ width: 40, height: 40, borderRadius: 12 }}><Icon name="heart" size={20} /></span>
              <div className="flex1"><div className="strong">{t(`fam.plans.${plan[0]}`)} · {t('fam.plans.active', { plan: '', n: planLeft(plan[1]).days }).replace(/^.*·\s*/, '')}</div><div className="small" style={{ color: 'rgba(255,255,255,.82)' }}>{t('fam.inbox.planSub')}</div></div>
              <button type="button" style={{ border: 0, background: 'none', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'underline' }} onClick={() => openPlans('generic', 'f-inbox')}>{t('fam.inbox.manage')}</button>
            </div>
          </Card>
        ) : <Note tone="info" icon="info">{t('fam.inbox.freeRule', { n: freeChatCap, used: openFreeChats(f) })}</Note>}
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'chats' ? 'true' : 'false'} className={tab === 'chats' ? 'is-on' : ''} onClick={() => nav('f-inbox', undefined, { replace: true })}>{t('fam.inbox.chats')}</button>
          <button type="button" role="tab" aria-selected={tab === 'likes' ? 'true' : 'false'} className={tab === 'likes' ? 'is-on' : ''} onClick={() => nav('f-likes', undefined, { replace: true })} data-testid="tab-likes">{t('fam.inbox.likesYou')}{likedN ? ` · ${likedN}` : ''}</button>
        </div>
        {tab === 'chats' ? (
          matches.length === 0 ? (
            <Empty icon="chat" title={t('fam.inbox.empty')} body={t('fam.inbox.emptyBody')}><Button block={false} to="f-discover">{t('fam.inbox.toDiscover')}</Button></Empty>
          ) : (
            <>
              {fresh.length > 0 && <>
                <div className="small strong muted mt-16">{t('fam.inbox.newMatches')}</div>
                <div className="row gap-16 mt-10" style={{ overflowX: 'auto', paddingBottom: 4 }}>
                  {fresh.map(id => { const h = helperById(id)!; return (
                    <button key={id} type="button" className="stack gap-6" style={{ alignItems: 'center', border: 0, background: 'none', color: 'var(--navy)', fontSize: 12.5, fontWeight: 600, padding: 0 }} onClick={() => nav('f-chat', id)} data-testid={`fresh-${id}`}>
                      <Avatar src={h.photo} initials={h.firstName[0]} size={62} ring={f.seenMatches.includes(id) ? '#fff' : 'var(--coral)'} />{h.firstName}
                    </button>
                  ); })}
                </div>
              </>}
              <div className="mt-10">
                {talking.map(id => {
                  const h = helperById(id)!; const c = f.chats[id];
                  const hired = f.hires.some(x => x.helperId === id);
                  return (
                    <button key={id} type="button" className="list-row" onClick={() => nav('f-chat', id)} data-testid={`chat-row-${id}`}>
                      <Avatar src={h.photo} initials={h.firstName[0]} size={52} />
                      <div className="flex1">
                        <div className="row gap-8"><b>{helperName(h)}</b>{hired && <Tag tone="ok" icon="check">{t('fam.inbox.hiredTag')}</Tag>}</div>
                        <small style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: c.unread ? 600 : 400, color: c.unread ? 'var(--navy)' : undefined }}>{c.typing ? t('chat.typing', { name: h.firstName }) : lastPreview(t, c, h.firstName) || t('fam.inbox.sayHello')}</small>
                      </div>
                      <div className="stack gap-6" style={{ alignItems: 'flex-end' }}><span className="small muted">{ago(t, lastAt(c))}</span>{c.unread > 0 && <span className="tabbar__badge" style={{ position: 'static' }}>{c.unread}</span>}</div>
                    </button>
                  );
                })}
              </div>
            </>
          )
        ) : (
          likedN === 0 ? <Empty icon="heart" title={t('fam.inbox.likesEmpty')} /> :
            hasPass(f) ? (
              <div className="mt-10">
                {liked.map(h => (
                  <div key={h.id} className="list-row">
                    <button type="button" className="row gap-12 flex1" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'var(--navy)' }} onClick={() => nav('f-helper', h.id)}>
                      <Avatar src={h.photo} initials={h.firstName[0]} size={52} />
                      <div className="flex1"><b>{helperName(h)}, {h.age}</b><small>{helperRoles(t, h)} · {t(`cities.${h.city}`)} · {peso(h.rate)}</small></div>
                    </button>
                    <IconButton name="heart" variant="iconbtn--like" label={t('fam.inbox.likeBack')} onClick={() => settle(likeHelper(h.id), r => { if (r === 'match') nav('f-match', h.id); })} testId={`like-back-${h.id}`} />
                  </div>
                ))}
              </div>
            ) : (
              <Card className="mt-16 center">
                <div className="row" style={{ justifyContent: 'center' }}>
                  {liked.length > 0 ? <span className="avatar-stack" style={{ filter: 'blur(5px)' }} aria-hidden="true">{liked.slice(0, 4).map(h => <Avatar key={h.id} src={h.photo} size={56} ring="#fff" />)}</span>
                    : <span className="empty__icon" style={{ background: 'var(--blush)' }}><Icon name="heart" size={26} /></span>}
                </div>
                <h2 className="h3 mt-14">{likedN === 1 ? t('fam.inbox.likesLockedOne') : t('fam.inbox.likesLockedTitle', { n: likedN })}</h2>
                <p className="small muted mt-6" style={{ fontSize: 14 }}>{t('fam.inbox.likesLockedBody')}</p>
                <div className="mt-14"><Button icon="lock" onClick={() => openPlans('likes', 'f-likes')} testId="unlock-likes">{t('fam.inbox.likesUnlock')}</Button></div>
              </Card>
            )
        )}
        <div className="spacer" />
      </div>
    </Screen>
  );
}
const lastAt = (c?: { messages: { at: number }[]; matchedAt: number }) => (c ? (c.messages.length ? c.messages[c.messages.length - 1].at : c.matchedAt) : 0);

function MoreCard() {
  const t = useT();
  return (
    <div className="lcard lcard--more">
      <span className="empty__icon"><Icon name="compass" size={26} /></span>
      <p>{t('desk.likes.more')}</p>
      <Button kind="ghost" size="sm" block={false} to="f-discover" iconRight="next">{t('fam.inbox.toDiscover')}</Button>
    </div>
  );
}

// Desktop "Likes you" page: blurred 4-column grid with a banner, or real cards with a pass.
function FamilyLikesDesk() {
  const t = useT();
  const s = useStore(st => st);
  const f = s.family;
  const liked = likedYouList(s);
  const likedN = likedYouCount(s);
  const open = hasPass(f);
  return (
    <Screen tone="cream" side="family" label={t('fam.inbox.likesYou')} nav={<FamilyNav active="likes" />} desk="likes"
      header={<PageHead title={t('fam.inbox.likesYou')} right={
        <div className="seg seg--inline" role="tablist">
          <button type="button" role="tab" aria-selected="false" onClick={() => nav('f-inbox')}>{t('fam.inbox.chats')}</button>
          <button type="button" role="tab" aria-selected="true" className="is-on" data-testid="tab-likes">{t('fam.inbox.likesYou')}{likedN ? ` · ${likedN}` : ''}</button>
        </div>} />}>
      {likedN === 0 ? <Card><Empty icon="heart" title={t('fam.inbox.likesEmpty')} /></Card> : open ? (
        <div className="lgrid">
          {liked.map(h => (
            <article key={h.id} className="lcard">
              <button type="button" className="lcard__photo" onClick={() => nav('f-helper', h.id)} aria-label={helperName(h)}>
                <HelperPhoto h={h} />
                <span className="lcard__tag"><Tag tone="solid" icon="heart">{t('fam.discover.likedYou')}</Tag></span>
              </button>
              <div className="lcard__body">
                <b>{helperName(h)}, {h.age}</b>
                <small>{helperRoles(t, h)}</small>
                <small>{t(`cities.${h.city}`)} · {peso(h.rate)}</small>
                <div className="row gap-8 mt-12">
                  <Button kind="ghost" size="sm" onClick={() => nav('f-helper', h.id)}>{t('fam.inbox.seeProfile')}</Button>
                  <IconButton name="heart" variant="iconbtn--like" label={t('fam.inbox.likeBack')} onClick={() => settle(likeHelper(h.id), r => { if (r === 'match') nav('f-match', h.id); })} testId={`like-back-${h.id}`} />
                </div>
              </div>
            </article>
          ))}
          {liked.length < 4 && <MoreCard />}
        </div>
      ) : (
        <>
          <div className="lbanner">
            {liked.length > 0 ? <span className="avatar-stack" style={{ filter: 'blur(5px)' }} aria-hidden="true">{liked.slice(0, 4).map(h => <Avatar key={h.id} src={h.photo} size={52} ring="#fff" />)}</span>
              : <span className="empty__icon"><Icon name="heart" size={26} /></span>}
            <div className="flex1">
              <h2 className="h3">{likedN === 1 ? t('fam.inbox.likesLockedOne') : t('fam.inbox.likesLockedTitle', { n: likedN })}</h2>
              <p className="muted mt-4">{t('fam.inbox.likesLockedBody')}</p>
            </div>
            <Button icon="lock" block={false} onClick={() => openPlans('likes', 'f-likes')} testId="unlock-likes">{t('desk.likes.cta', { price: peso(PRICES.pass) })}</Button>
          </div>
          <div className="lgrid" aria-hidden="true">
            {(liked.length ? liked.map(h => h.photo) : Array.from({ length: Math.min(likedN, 8) }, () => '')).map((photo, i) => (
              <div key={i} className="lcard lcard--locked">
                <div className="lcard__photo">{photo ? <img src={asset(photo)} alt="" /> : <span className="photo-none" />}<span className="lcard__lock"><Icon name="lock" size={22} /></span></div>
                <div className="lcard__body"><i className="lbar" /><i className="lbar lbar--s" /><span className="mt-10"><Tag tone="solid" icon="heart">{t('fam.discover.likedYou')}</Tag></span></div>
              </div>
            ))}
            {likedN < 4 && <MoreCard />}
          </div>
        </>
      )}
    </Screen>
  );
}

// ---------- Account ----------
export function FamilyMe() {
  const t = useT();
  const s = useStore(st => st);
  const f = s.family;
  const tabs = useFamilyTabs();
  const [reset, setReset] = useState(false);
  const left = likesLeft(f);
  const plan = isPremium(f) ? t('fam.plans.active', { plan: t('fam.plans.premiumTitle'), n: planLeft(f.premiumUntil).days })
    : hasPass(f) ? t('fam.plans.active', { plan: t('fam.plans.passTitle'), n: planLeft(f.passUntil).days }) : null;
  const edit = (to: string) => { setUi({ editing: true }); nav(to); };
  const desk = useIsDesktop();
  const contact = LIVE ? (s.live?.email ?? '') : `+63 ${formatPhone(f.phone)}`;
  const isAdmin = LIVE && s.live?.role === 'admin';
  const idRow = (
    <button type="button" className="list-row" onClick={() => nav('f-idcheck')} data-testid="me-idcheck">
      <span className="list-row__icon"><Icon name="id" size={19} /></span>
      <div className="flex1"><b>{t('fam.me.idT')}</b><small>{f.idCheck ? t('fam.me.idDone', { month: monthLabel(t, f.idCheck.month) }) : t('fam.me.idNot')}</small></div><Icon name="next" size={18} />
    </button>
  );
  const adminRow = isAdmin && (
    <button type="button" className="list-row" onClick={() => nav('admin')} data-testid="open-admin">
      <span className="list-row__icon"><Icon name="settings" size={19} /></span><div className="flex1"><b>{t('live.admin')}</b></div><Icon name="next" size={18} />
    </button>
  );
  if (desk) {
    // Pattern H: section nav on the left, content cards on the right.
    const sections = [
      { id: 'me-profile', label: t('desk.me.profile'), icon: 'user' }, { id: 'me-plan', label: t('fam.me.plan'), icon: 'star' }, { id: 'me-checks', label: t('fam.me.checks'), icon: 'id' },
      { id: 'me-answers', label: t('fam.me.answers'), icon: 'list' }, { id: 'me-hires', label: t('fam.me.hires'), icon: 'doc' },
      { id: 'me-payments', label: t('fam.me.purchases'), icon: 'card' }, { id: 'me-promise', label: t('fam.me.promise'), icon: 'hand' },
      { id: 'me-settings', label: t('desk.me.settings'), icon: 'settings' },
    ];
    return (
      <Screen tone="cream" side="family" label={t('fam.me.title')} nav={<FamilyNav active="account" />} desk="settings"
        header={<PageHead title={t('fam.me.title')} />}
        overlay={reset && (
          <Sheet title={t('fam.me.reset')} onClose={() => setReset(false)}
            actions={<><Button onClick={() => { setReset(false); resetDemo(); nav('welcome', undefined, { replace: true }); }} testId="reset-confirm">{t('fam.me.resetConfirm')}</Button><Button kind="ghost" onClick={() => setReset(false)}>{t('common.cancel')}</Button></>}>
            <p className="lead" style={{ marginTop: 0 }}>{t('fam.me.resetBody')}</p>
          </Sheet>
        )}>
        <div className="dgrid dgrid--settings">
          <aside><SideNav items={sections} label={t('fam.me.title')} /></aside>
          <div className="dsections">
            <section id="me-profile" className="card">
              <div className="row gap-16">
                <Avatar initials={(f.name || 'S').slice(0, 1).toUpperCase()} size={72} />
                <div className="flex1"><div className="h2 dsec__name">{f.name || 'Santos'} Family</div><div className="muted">{t(`cities.${f.city}`)} · {contact}</div></div>
              </div>
            </section>
            <section id="me-plan" className="card">
              <h2 className="h3">{t('fam.me.plan')}</h2>
              <div className="row gap-12 mt-12">
                <div className="flex1"><div className="strong">{plan ?? t('fam.me.free')}</div>{!plan && <div className="small muted">{t('fam.me.freeRule', { n: left === Infinity ? '∞' : left, chats: freeChatCap })}</div>}
                  {urgentOn(f) && <div className="small mt-4" style={{ color: 'var(--warn)' }}>{t('fam.plans.activeH', { plan: t('fam.me.urgent'), n: planLeft(f.urgentUntil).hours })}</div>}</div>
                <Button size="md" block={false} onClick={() => openPlans('generic', 'f-me')}>{t('fam.me.seePlans')}</Button>
              </div>
            </section>
            <section id="me-checks" className="card">
              <h2 className="h3">{t('fam.me.checks')}</h2>
              {idRow}
            </section>
            <section id="me-answers" className="card">
              <h2 className="h3">{t('fam.me.answers')}</h2>
              {[['f-needs', 'list', 'editNeeds', f.roles.map(r => t(`roles.${r}`)).join(', ')], ['f-home', 'home', 'editHome', `${t(`cities.${f.city}`)} · ${f.kids.length} ${t('fam.onb.kids').toLowerCase()}`],
                ['f-setup', 'peso', 'editSetup', `${t(`arr.${f.arrangement}`)} · ${peso(f.budgetMin)}–${peso(f.budgetMax)}`]].map(([to, ic, k, sub]) => (
                <button key={to} type="button" className="list-row" onClick={() => edit(to)}>
                  <span className="list-row__icon"><Icon name={ic} size={19} /></span>
                  <div className="flex1"><b>{t(`fam.me.${k}`)}</b><small>{sub}</small></div><Icon name="next" size={18} />
                </button>
              ))}
            </section>
            <section id="me-hires" className="card">
              <h2 className="h3">{t('fam.me.hires')}</h2>
              {f.hires.length === 0 ? <p className="small muted mt-8">{t('fam.checklist.noneBody')}</p> : f.hires.map(hh => {
                const h = helperById(hh.helperId)!; const done = Object.values(hh.checklist).filter(Boolean).length;
                return (
                  <button key={hh.helperId} type="button" className="list-row" onClick={() => nav('f-checklist')}>
                    <Avatar src={h.photo} initials={h.firstName[0]} size={44} /><div className="flex1"><b>{helperName(h)}</b><small>{t('fam.checklist.progress', { done, total: 7 })}</small></div><Icon name="next" size={18} />
                  </button>
                );
              })}
            </section>
            <section id="me-payments" className="card">
              <h2 className="h3">{t('fam.me.purchases')}</h2>
              {f.purchases.length === 0 ? <p className="small muted mt-8">{t('fam.me.noPurchases')}</p> : f.purchases.map(p => (
                <div key={p.id} className="list-row" style={{ cursor: 'default' }}>
                  <div className="flex1"><b>{t(`fam.checkout.items.${p.item}`)}</b><small>{p.method} · {t('fam.checkout.ref', { ref: p.ref })} · {ago(t, p.at)}</small></div><span className="strong">{peso(p.amount)}</span>
                </div>
              ))}
            </section>
            <section id="me-promise" className="card card--blush">
              <h2 className="h3">{t('fam.me.promise')}</h2>
              <div className="dpromise">{['pr1', 'pr2', 'pr3', 'pr4', 'pr5'].map(k => <div key={k} className="row gap-8"><Icon name="check" size={16} />{t(`fam.me.${k}`)}</div>)}</div>
            </section>
            <section id="me-settings" className="card">
              <h2 className="h3">{t('desk.me.settings')}</h2>
              {adminRow}{!LIVE && <><button type="button" className="list-row" onClick={() => { enterSide('yaya'); if (!s.langChosen) setLang('tl', false); const y = getState().yaya; nav(y.verified ? (y.onboarded ? 'y-families' : 'y-biodata') : 'y-welcome'); }}>
                <span className="list-row__icon"><Icon name="swap" size={19} /></span><div className="flex1"><b>{t('fam.me.switchSide')}</b></div><Icon name="next" size={18} />
              </button>
              <button type="button" className="list-row" onClick={() => setReset(true)} data-testid="reset">
                <span className="list-row__icon"><Icon name="refresh" size={19} /></span><div className="flex1"><b>{t('fam.me.reset')}</b></div><Icon name="next" size={18} />
              </button></>}
              <button type="button" className="list-row" onClick={() => { logout('family'); if (!LIVE) nav('welcome', undefined, { replace: true }); }} data-testid="logout">
                <span className="list-row__icon"><Icon name="logout" size={19} /></span><div className="flex1"><b>{t('fam.me.logout')}</b></div>
              </button>
            </section>
          </div>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="cream" side="family" label={t('fam.me.title')}
      header={<div className="row" style={{ justifyContent: 'space-between', padding: 'calc(16px + var(--safe-t)) 20px 0' }}><h1 className="h1 h1--sm">{t('fam.me.title')}</h1><LangToggle /></div>}
      tabbar={tabs(t('tabs.account'))}
      overlay={reset && (
        <Sheet title={t('fam.me.reset')} onClose={() => setReset(false)}
          actions={<><Button onClick={() => { setReset(false); resetDemo(); nav('welcome', undefined, { replace: true }); }} testId="reset-confirm">{t('fam.me.resetConfirm')}</Button><Button kind="ghost" onClick={() => setReset(false)}>{t('common.cancel')}</Button></>}>
          <p className="lead" style={{ marginTop: 0 }}>{t('fam.me.resetBody')}</p>
        </Sheet>
      )}>
      <div className="pad-s mt-12">
        <Card>
          <div className="row gap-14">
            <Avatar initials={(f.name || 'S').slice(0, 1).toUpperCase()} size={56} />
            <div className="flex1"><div className="h3">{f.name || 'Santos'} Family</div><div className="small muted">{t(`cities.${f.city}`)} · {contact}</div></div>
          </div>
        </Card>
        <Section title={t('fam.me.plan')}>
          <Card>
            <div className="row gap-12">
              <div className="flex1"><div className="strong">{plan ?? t('fam.me.free')}</div>{!plan && <div className="small muted">{t('fam.me.freeRule', { n: left === Infinity ? '∞' : left, chats: freeChatCap })}</div>}
                {urgentOn(f) && <div className="small mt-4" style={{ color: 'var(--warn)' }}>{t('fam.plans.activeH', { plan: t('fam.me.urgent'), n: planLeft(f.urgentUntil).hours })}</div>}</div>
              <Button size="sm" block={false} onClick={() => openPlans('generic', 'f-me')}>{t('fam.me.seePlans')}</Button>
            </div>
          </Card>
        </Section>
        <Section title={t('fam.me.checks')}>
          <Card style={{ padding: '4px 16px' }}>{idRow}</Card>
        </Section>
        <Section title={t('fam.me.answers')}>
          <Card style={{ padding: '4px 16px' }}>
            {[['f-needs', 'list', 'editNeeds', f.roles.map(r => t(`roles.${r}`)).join(', ')], ['f-home', 'home', 'editHome', `${t(`cities.${f.city}`)} · ${f.kids.length} ${t('fam.onb.kids').toLowerCase()}`],
              ['f-setup', 'peso', 'editSetup', `${t(`arr.${f.arrangement}`)} · ${peso(f.budgetMin)}–${peso(f.budgetMax)}`]].map(([to, ic, k, sub]) => (
              <button key={to} type="button" className="list-row" onClick={() => edit(to)}>
                <span className="list-row__icon"><Icon name={ic} size={19} /></span>
                <div className="flex1"><b>{t(`fam.me.${k}`)}</b><small>{sub}</small></div><Icon name="next" size={18} />
              </button>
            ))}
          </Card>
        </Section>
        <Section title={t('fam.me.hires')}>
          <Card style={{ padding: '4px 16px' }}>
            {f.hires.length === 0 ? <p className="small muted" style={{ padding: '12px 0' }}>{t('fam.checklist.noneBody')}</p> : f.hires.map(hh => {
              const h = helperById(hh.helperId)!; const done = Object.values(hh.checklist).filter(Boolean).length;
              return (
                <button key={hh.helperId} type="button" className="list-row" onClick={() => nav('f-checklist')}>
                  <Avatar src={h.photo} initials={h.firstName[0]} size={40} /><div className="flex1"><b>{helperName(h)}</b><small>{t('fam.checklist.progress', { done, total: 7 })}</small></div><Icon name="next" size={18} />
                </button>
              );
            })}
          </Card>
        </Section>
        <Section title={t('fam.me.purchases')}>
          <Card style={{ padding: '4px 16px' }}>
            {f.purchases.length === 0 ? <p className="small muted" style={{ padding: '12px 0' }}>{t('fam.me.noPurchases')}</p> : f.purchases.map(p => (
              <div key={p.id} className="list-row" style={{ cursor: 'default' }}>
                <div className="flex1"><b>{t(`fam.checkout.items.${p.item}`)}</b><small>{p.method} · {t('fam.checkout.ref', { ref: p.ref })} · {ago(t, p.at)}</small></div><span className="strong">{peso(p.amount)}</span>
              </div>
            ))}
          </Card>
        </Section>
        <Section title={t('fam.me.promise')}>
          <Card tone="blush">
            <div className="stack gap-8">{['pr1', 'pr2', 'pr3', 'pr4', 'pr5'].map(k => <div key={k} className="row gap-8" style={{ fontSize: 14 }}><Icon name="check" size={16} />{t(`fam.me.${k}`)}</div>)}</div>
          </Card>
        </Section>
        <Card className="mt-22" style={{ padding: '4px 16px' }}>
          {adminRow}{!LIVE && <><button type="button" className="list-row" onClick={() => { enterSide('yaya'); if (!s.langChosen) setLang('tl', false); const y = getState().yaya; nav(y.verified ? (y.onboarded ? 'y-families' : 'y-biodata') : 'y-welcome'); }}>
            <span className="list-row__icon"><Icon name="swap" size={19} /></span><div className="flex1"><b>{t('fam.me.switchSide')}</b></div><Icon name="next" size={18} />
          </button>
          <button type="button" className="list-row" onClick={() => setReset(true)} data-testid="reset">
            <span className="list-row__icon"><Icon name="refresh" size={19} /></span><div className="flex1"><b>{t('fam.me.reset')}</b></div><Icon name="next" size={18} />
          </button></>}
          <button type="button" className="list-row" onClick={() => { logout('family'); if (!LIVE) nav('welcome', undefined, { replace: true }); }} data-testid="logout">
            <span className="list-row__icon"><Icon name="logout" size={19} /></span><div className="flex1"><b>{t('fam.me.logout')}</b></div>
          </button>
        </Card>
        <div className="spacer" />
      </div>
    </Screen>
  );
}
