// Desktop-only building blocks (>= 1024px). Phones never render these.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, Avatar, LangToggle, IconButton, Tag, asset } from './ui';
import { useT, peso, sinceLabel } from '../lib/i18n';
import { MIN_WAGE, type Region } from '../data/constants';
import { useStore } from '../lib/store';
import { back as goBack } from '../lib/router';
import { likedYouCount, familiesLikingYou, hasPass, isPremium, likesLeft, planLeft, helperName } from '../lib/match';
import { HELPERS } from '../data/helpers';
import { openPlans } from '../lib/actions';

export interface NavItem { key: string; icon: string; label: string; to: string; badge?: number }

// The same items, badges and order as the phone tab bars.
export function useFamilyNavItems(): NavItem[] {
  const t = useT();
  const s = useStore(st => st);
  const likes = likedYouCount(s);
  const unread = Object.values(s.family.chats).reduce((n, c) => n + c.unread, 0) + s.family.matches.filter(id => !s.family.seenMatches.includes(id)).length;
  return [
    { key: 'discover', icon: 'compass', label: t('tabs.discover'), to: 'f-discover' },
    { key: 'likes', icon: 'heart', label: t('tabs.likes'), to: 'f-likes', badge: likes || undefined },
    { key: 'messages', icon: 'chat', label: t('tabs.messages'), to: 'f-inbox', badge: unread || undefined },
    { key: 'account', icon: 'user', label: t('tabs.account'), to: 'f-me' },
  ];
}

export function useYayaNavItems(): NavItem[] {
  const t = useT();
  const s = useStore(st => st);
  const y = s.yaya;
  const matchesBadge = familiesLikingYou(s).length + y.matches.filter(id => !y.seenMatches.includes(id)).length;
  const unread = Object.values(y.chats).reduce((n, c) => n + c.unread, 0);
  return [
    { key: 'families', icon: 'house2', label: t('tabs.families'), to: 'y-families' },
    { key: 'matches', icon: 'heart', label: t('tabs.matches'), to: 'y-matches', badge: matchesBadge || undefined },
    { key: 'chat', icon: 'chat', label: t('tabs.chat'), to: 'y-chats', badge: unread || undefined },
    { key: 'me', icon: 'user', label: t('tabs.me'), to: 'y-me' },
  ];
}

function Logo({ to }: { to: string }) {
  return <a className="dnav__logo" href={'#' + to}><img src={asset('logo.png')} alt="YayaMatch" /></a>;
}

export function DesktopNav({ items, active, right, home }: { items: NavItem[]; active?: string; right?: ReactNode; home: string }) {
  const t = useT();
  return (
    <header className="dnav">
      <div className="dnav__in">
        <Logo to={home} />
        <nav className="dnav__links" aria-label={t('tabs.nav')}>
          {items.map(it => (
            <a key={it.key} href={'#' + it.to} aria-current={it.key === active ? 'page' : undefined}>
              <Icon name={it.icon} size={20} sw={it.key === active ? 2.2 : 1.9} /><span>{it.label}</span>
              {it.badge ? <span className="dnav__badge">{it.badge}</span> : null}
            </a>
          ))}
        </nav>
        <div className="dnav__right">{right}</div>
      </div>
    </header>
  );
}

const here = () => (location.hash || '#welcome').slice(1);

export function FamilyNav({ active }: { active?: 'discover' | 'likes' | 'messages' | 'account' }) {
  const t = useT();
  const items = useFamilyNavItems();
  const f = useStore(s => s.family);
  const paid = hasPass(f);
  const left = likesLeft(f);
  const label = isPremium(f) ? t('desk.nav.plan', { plan: t('fam.plans.premiumTitle'), n: planLeft(f.premiumUntil).days })
    : paid ? t('desk.nav.plan', { plan: t('fam.plans.passTitle'), n: planLeft(f.passUntil).days })
      : t('desk.nav.free', { n: left === Infinity ? '∞' : left });
  return (
    <DesktopNav items={items} active={active} home="f-discover" right={<>
      <button type="button" className={`plan-pill${paid ? ' is-paid' : ''}`} onClick={() => openPlans('generic', here())} data-testid="nav-plan">
        <Icon name={paid ? 'star' : 'heart'} size={15} sw={2.2} />{label}
      </button>
      <LangToggle />
      <a className="dnav__avatar" href="#f-me" aria-label={t('tabs.account')} title={t('tabs.account')}>
        <Avatar initials={(f.name || 'S').slice(0, 1).toUpperCase()} size={38} />
      </a>
    </>} />
  );
}

export function YayaNav({ active }: { active?: 'families' | 'matches' | 'chat' | 'me' }) {
  const t = useT();
  const items = useYayaNavItems();
  const s = useStore(st => st);
  const y = s.yaya;
  return (
    <DesktopNav items={items} active={active} home="y-families" right={<>
      <LangToggle />
      <IconButton name="bell" label={t('desk.nav.bell')} to="y-matches" dot={familiesLikingYou(s).length > 0} />
      <a className="dnav__avatar" href="#y-me" aria-label={t('desk.nav.profile')} title={t('desk.nav.profile')}>
        <Avatar src={y.photo} initials={(y.name || '?').slice(0, 1)} size={38} bg="var(--coral-deep)" />
      </a>
    </>} />
  );
}

// Slim header for logged-out and set-up screens (pattern A): logo, a Back link, the language toggle.
export function SlimHeader({ back, onBack, home = 'welcome' }: { back?: string; onBack?: () => void; home?: string }) {
  const t = useT();
  const doBack = onBack ?? (back ? () => goBack(back) : undefined);
  return (
    <header className="dnav dnav--slim">
      <div className="dnav__in">
        <Logo to={home} />
        {doBack && <button type="button" className="dnav__back" onClick={doBack}><Icon name="back" size={18} />{t('common.back')}</button>}
        <div className="dnav__right"><LangToggle /></div>
      </div>
    </header>
  );
}

// Left brand panel of the split onboarding layout. Photos are the existing sample helper photos.
export function BrandPanel({ side, kind }: { side: 'family' | 'yaya'; kind: 'auth' | 'onb' | 'id' }) {
  const t = useT();
  // an illustration: always one of the bundled sample profiles (tagged "Sample profile")
  const h = HELPERS.find(x => x.id === (side === 'family' ? 'h-01' : 'h-02'));
  let kicker = side === 'family' ? t('fam.account.kicker') : t('ya.welcome.kicker');
  let title = t('welcome.title');
  let lines: [string, string, string?][] = [];
  if (side === 'family' && kind === 'id') {
    kicker = t('fam.id.title');
    title = t('fam.id.brandT');
    lines = [['lock', t('ya.id.privacy')], ['calendar', t('fam.account.v1t')], ['chat', t('fam.id.free')]];
  } else if (side === 'family') {
    lines = kind === 'auth'
      ? [['calendar', t('fam.account.v1t'), t('fam.account.v1s')], ['chat', t('fam.account.v2t'), t('fam.account.v2s')], ['peso', t('fam.account.v3t'), t('fam.account.v3s')]]
      : [['lock', t('fam.onb.cityPrivacy')], ['calendar', t('fam.account.v1t')], ['peso', t('fam.account.v3t')]];
    if (kind !== 'auth') title = t('desk.brand.famOnbT');
  } else if (kind === 'id') {
    kicker = t('ya.id.title');
    title = t('ya.ready.addIdS');
    lines = [['lock', t('ya.id.privacy')], ['peso', t('ya.id.free')], ['lock', t('ya.welcome.p3t')]];
  } else {
    lines = kind === 'auth'
      ? [['peso', t('ya.welcome.p1t'), t('ya.welcome.p1s')], ['hand', t('ya.welcome.p2t'), t('ya.welcome.p2s')], ['lock', t('ya.welcome.p3t'), t('ya.welcome.p3s')]]
      : [['peso', t('ya.welcome.p1t')], ['hand', t('ya.welcome.p2t')], ['lock', t('ya.welcome.p3t')]];
    if (kind !== 'auth') title = t('desk.brand.yayaOnbT');
  }
  return (
    <div className={`brand brand--${side}`}>
      <div className="brand__kicker">{kicker}</div>
      <h2 className="brand__title">{title}</h2>
      <ul className="brand__lines">
        {lines.map(([ic, a, b]) => (
          <li key={a}><span className="brand__icon"><Icon name={ic} size={20} /></span><span><b>{a}</b>{b && <small>{b}</small>}</span></li>
        ))}
      </ul>
      {h && (
        <figure className="brand__photo">
          <img src={asset(h.photo)} alt="" />
          <figcaption className="brand__cap">
            <span className="row gap-8"><Tag tone="muted">{t('common.sample')}</Tag></span>
            <small>{t('fam.discover.favorite')}</small>
            <q>{h.favorite}</q>
            <span className="brand__who">{helperName(h)} · {h.roles.map(r => t(`roles.${r}`)).join(' · ')} · {t(`cities.${h.city}`)}</span>
          </figcaption>
        </figure>
      )}
    </div>
  );
}

// Page heading inside the desktop container.
export function PageHead({ title, sub, right, kicker, children }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; kicker?: ReactNode; children?: ReactNode }) {
  return (
    <div className="phead">
      <div className="flex1">
        {kicker}
        <h1 className="h1">{title}</h1>
        {sub && <div className="phead__sub">{sub}</div>}
        {children}
      </div>
      {right && <div className="phead__right">{right}</div>}
    </div>
  );
}

// "‹ Discover" style back link at the top of detail pages.
export function BackLink({ to = 'welcome', param, label, onClick }: { to?: string; param?: string; label?: string; onClick?: () => void }) {
  const t = useT();
  return (
    <button type="button" className="backlink" onClick={onClick ?? (() => goBack(to, param))}>
      <Icon name="back" size={18} />{label ?? t('common.back')}
    </button>
  );
}

// Left section nav for settings pages (pattern H). Sections need matching ids.
export function SideNav({ items, label }: { items: { id: string; label: string; icon: string }[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = items.map(i => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => seen.set(e.target.id, e.isIntersecting));
      const first = items.find(i => seen.get(i.id));
      if (first) setActive(first.id);
    }, { rootMargin: '-110px 0px -55% 0px' });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, [items.map(i => i.id).join()]);
  return (
    <nav className="sidenav" aria-label={label}>
      {items.map(i => (
        <button key={i.id} type="button" className={active === i.id ? 'is-on' : ''} aria-current={active === i.id ? 'true' : undefined}
          onClick={() => { document.getElementById(i.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActive(i.id); }}>
          <Icon name={i.icon} size={19} />{i.label}
        </button>
      ))}
    </nav>
  );
}

// Empty thread state for the messages panes.
export function EmptyThread({ children, side = 'family' }: { children?: ReactNode; side?: 'family' | 'yaya' }) {
  const t = useT();
  const tips: [string, string][] = side === 'family'
    ? [['chat', t('fam.match.s1')], ['pin', t('fam.match.s2')], ['alert', t('fam.match.s3')]]
    : [['clock', t('ya.match.t1')], ['pin', t('ya.match.t2')], ['alert', t('ya.match.t3')]];
  return (
    <div className="thread thread--empty">
      <div className="empty">
        <span className="empty__icon"><Icon name="chat" size={28} /></span>
        <h2 className="h3">{t('desk.inbox.pickT')}</h2>
        <p className="muted" style={{ fontSize: 15, maxWidth: 340 }}>{t('desk.inbox.pickB')}</p>
        {children}
        <div className="dsteps thread__tips">
          <div className="eyebrow">{side === 'family' ? t('fam.match.stepsTitle') : t('ya.match.tipsT')}</div>
          {tips.map(([ic, txt]) => <div key={txt} className="dsteps__row"><Icon name={ic} size={18} /><span>{txt}</span></div>)}
        </div>
      </div>
    </div>
  );
}

// Minimum wage table (used by the checklist and the rights page).
export function WageTable() {
  const t = useT();
  return (
    <table className="wtable">
      <tbody>
        {(Object.keys(MIN_WAGE) as Region[]).map(r => (
          <tr key={r}><th scope="row">{t(`regions.${r}`)}<small>{t('desk.checklist.since', { date: sinceLabel(t, MIN_WAGE[r].since) })}</small></th><td>{peso(MIN_WAGE[r].amount)}<small>{t('common.perMonth')}</small></td></tr>
        ))}
      </tbody>
    </table>
  );
}
