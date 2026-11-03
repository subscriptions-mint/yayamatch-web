import { useEffect, useRef, useState } from 'react';
import { useT, peso, pesoRange, monthLabel, daysLabel, dateLabel, dayClock, ago, workDaysLabel, hoursLabel, listJoin } from '../../lib/i18n';
import { useStore, setUi, toast, getState } from '../../lib/store';
import { nav, back } from '../../lib/router';
import { Screen, TopBar, Footer, Button, IconButton, Icon, Chip, Tag, Card, Note, Avatar, Sheet, TabBar, Toggle, Empty, Section, LangToggle, Fact } from '../../components/ui';
import { HouseholdAvatar, householdLine, needLine, scheduleLine, QuoteCard, MessageView, TypingDots, lastPreview, ReportSheet, PlanSheet, ShareSheet, IdGate, SampleTag } from '../../components/domain';
import {
  interestHousehold, hideHousehold, unhideHousehold, resetHidden, toggleAvailable, sendYayaMessage, shareYayaNumber, planYayaCall, confirmYayaHired,
  setYayaVisible, readChat, blockParty, unblockParty, markMatchSeen, resetDemo, logout, enterSide, setLang, settle, watchChat, yayaCanSend,
} from '../../lib/actions';
import { LIVE } from '../../lib/config';
import { familiesList, familiesLikingYou, householdById, yayaStrength, planLeft } from '../../lib/match';
import { minWageFor, regionOf, ROLE_ICON } from '../../data/constants';
import type { Household } from '../../lib/types';
import { NotFound } from '../shared/Shared';
import { formatPhone } from '../family/FamilyOnboarding';
import { useIsDesktop } from '../../lib/useIsDesktop';
import { YayaNav, PageHead, BackLink, SideNav, EmptyThread, WageTable, useYayaNavItems } from '../../components/desktop';

// Same items as the desktop top nav (useYayaNavItems), shown as the bottom tab bar on phones.
function useYayaTabs() {
  const items = useYayaNavItems();
  return (active: string) => <TabBar active={active} items={items} />;
}

function interested(t: ReturnType<typeof useT>, k: Household) {
  settle(interestHousehold(k.id), r => {
    if (r === 'match') nav('y-match', k.id);
    else if (r === 'sent') toast(t('ya.families.sent', { name: k.name }));
  });
}

// ---------- Families feed ----------
export function YayaFamilies() {
  const t = useT();
  const s = useStore(st => st);
  const y = s.yaya;
  const tabs = useYayaTabs();
  const [chip, setChip] = useState<'all' | 'role' | 'arr' | 'near'>('all');
  const list = familiesList(s, chip);
  const avail = (y.availableUntil ?? 0) > Date.now();
  const firstRole = y.roles[0];
  const desk = useIsDesktop();
  if (desk) {
    // Pattern D: availability and filters on the left, family cards in two columns, strength and likes on the right.
    const liking = familiesLikingYou(s);
    const strength = yayaStrength(y);
    const chips: ['all' | 'role' | 'arr' | 'near', string][] = [['all', t('ya.families.all')], ...(firstRole ? [['role', y.roles.map(r => t(`roles.${r}`)).join(' / ')] as ['role', string]] : []),
      ['arr', t(`yarr.${y.arrangement}`)], ['near', t('ya.families.near')]];
    return (
      <Screen tone="blush" side="yaya" label={t('tabs.families')} nav={<YayaNav active="families" />} wide desk="families"
        header={<PageHead title={t('ya.families.hi', { name: y.name || '' })}
          sub={<>{y.homeCity ? t(`cities.${y.homeCity}`) : ''}{y.roles.length ? ' · ' + y.roles.map(r => t(`roles.${r}`)).join(', ') : ''}</>}
          right={list.length > 0 ? <span className="phead__count">{list.length === 1 ? t('ya.families.countOne') : t('ya.families.count', { n: list.length })}</span> : undefined} />}>
        <div className="dgrid dgrid--families">
          <aside className="rail">
            {!y.visible && (
              <Note tone="info" icon="eyeoff">{t('ya.families.hiddenProfile')} <button type="button" style={{ border: 0, background: 'none', padding: 0, color: 'var(--coral-deep)', fontWeight: 700 }} onClick={() => setYayaVisible(true)}>{t('ya.families.showAgain')}</button></Note>
            )}
            <div className="card availcard">
              <div className="row gap-12">
                <div className="flex1 strong">{t('ya.families.availT')}</div>
                <Toggle on={avail} onChange={v => toggleAvailable(v)} label={t('ya.families.availT')} testId="available" />
              </div>
              <div className="small muted mt-10">{avail ? t('ya.families.availOn', { h: planLeft(y.availableUntil).hours }) : t('ya.families.availS')}</div>
            </div>
            <div className="card chipcol" role="group" aria-label={t('tabs.families')}>
              {chips.map(([k, label]) => <Chip key={k} on={chip === k} onClick={() => setChip(k)}>{label}</Chip>)}
            </div>
          </aside>
          <section>
            {list.length === 0 && (
              <div className="card">
                <Empty icon="house2" title={t('ya.families.emptyT')} body={t('ya.families.emptyB')}>
                  {y.hidden.length > 0 && <Button kind="ghost" block={false} onClick={resetHidden}>{t('ya.families.resetHidden')}</Button>}
                </Empty>
              </div>
            )}
            <div className="fgrid">{list.map(k => <FamilyCard key={k.id} k={k} />)}</div>
          </section>
          <aside className="rail rail--right">
            <div className="card">
              <div className="row"><span className="strong flex1">{t('ya.ready.strength')}</span><span className="strong" style={{ color: 'var(--ok)' }}>{strength}%</span></div>
              <div className="bar mt-8" style={{ background: '#F1E1E5' }}><i style={{ width: `${strength}%` }} /></div>
              <div className="mt-8">
                {!y.idCheck && <button type="button" className="list-row" onClick={() => nav('y-idcheck')}><span className="list-row__icon"><Icon name="id" size={19} /></span><div className="flex1"><b>{t('ya.ready.addId')}</b><small>{t('ya.ready.addIdS')}</small></div><Icon name="next" size={18} /></button>}
                {!y.nbi && !LIVE && <button type="button" className="list-row" onClick={() => nav('y-ready')}><span className="list-row__icon"><Icon name="file" size={19} /></span><div className="flex1"><b>{t('ya.ready.addNbi')}</b><small>{t('ya.ready.addNbiS')}</small></div><Icon name="next" size={18} /></button>}
                {!y.voiceSec && <button type="button" className="list-row" onClick={() => { setUi({ editing: true }); nav('y-intro'); }}><span className="list-row__icon"><Icon name="mic" size={19} /></span><div className="flex1"><b>{t('ya.me.editIntro')}</b><small>{t('ya.me.noVoice')}</small></div><Icon name="next" size={18} /></button>}
              </div>
              <div className="mt-12"><Button kind="ghost" size="sm" to="y-me">{t('ya.me.edit')}</Button></div>
            </div>
            <div className="card">
              <div className="row gap-8"><span style={{ color: 'var(--coral-deep)' }}><Icon name="heart" size={18} /></span><span className="strong flex1">{t('ya.families.likedTag')}</span>{liking.length > 0 && <span className="tabbar__badge" style={{ position: 'static' }}>{liking.length}</span>}</div>
              {liking.length === 0 ? <p className="small muted mt-8">{t('desk.matches.none')}</p> : (
                <div className="mt-6">
                  {liking.slice(0, 5).map(k => (
                    <button key={k.id} type="button" className="list-row" onClick={() => nav('y-family', k.id)}>
                      <HouseholdAvatar k={k} size={42} />
                      <div className="flex1"><b>{k.name}</b><small>{t(`cities.${k.city}`)} · {pesoRange(k.rateMin, k.rateMax)}</small></div>
                      <Icon name="next" size={18} />
                    </button>
                  ))}
                </div>
              )}
              <p className="small muted mt-8">{t('ya.matches.likedFree')}</p>
            </div>
          </aside>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya" label={t('tabs.families')}
      header={
        <div className="row gap-12" style={{ padding: 'calc(16px + var(--safe-t)) 20px 0' }}>
          <Avatar src={y.photo} initials={(y.name || '?').slice(0, 1)} size={44} bg="var(--coral-deep)" />
          <div className="flex1"><div className="h3" style={{ fontSize: 20, fontWeight: 700 }}>{t('ya.families.hi', { name: y.name || '' })}</div>
            <div className="small muted">{y.homeCity ? t(`cities.${y.homeCity}`) : ''}{y.roles.length ? ' · ' + y.roles.map(r => t(`roles.${r}`)).join(', ') : ''}</div></div>
          <IconButton name="bell" label={t('tabs.matches')} to="y-matches" dot={familiesLikingYou(s).length > 0} />
        </div>
      }
      tabbar={tabs(t('tabs.families'))}>
      <div className="pad-s">
        {!y.visible && (
          <Note className="mt-14" tone="info" icon="eyeoff">{t('ya.families.hiddenProfile')} <button type="button" style={{ border: 0, background: 'none', padding: 0, color: 'var(--coral-deep)', fontWeight: 700 }} onClick={() => setYayaVisible(true)}>{t('ya.families.showAgain')}</button></Note>
        )}
        <div className="card row gap-12 mt-14" style={{ padding: '12px 14px' }}>
          <span className="list-row__icon" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}><Icon name="zap" size={20} /></span>
          <div className="flex1"><div className="strong" style={{ fontSize: 15 }}>{t('ya.families.availT')}</div>
            <div className="small muted" style={{ lineHeight: 1.35 }}>{avail ? t('ya.families.availOn', { h: planLeft(y.availableUntil).hours }) : t('ya.families.availS')}</div></div>
          <Toggle on={avail} onChange={v => toggleAvailable(v)} label={t('ya.families.availT')} testId="available" />
        </div>
        <div className="chips chips--scroll" style={{ marginTop: 14 }}>
          <Chip on={chip === 'all'} onClick={() => setChip('all')}>{t('ya.families.all')}</Chip>
          {firstRole && <Chip on={chip === 'role'} onClick={() => setChip('role')}>{y.roles.map(r => t(`roles.${r}`)).join(' / ')}</Chip>}
          <Chip on={chip === 'arr'} onClick={() => setChip('arr')}>{t(`yarr.${y.arrangement}`)}</Chip>
          <Chip on={chip === 'near'} onClick={() => setChip('near')}>{t('ya.families.near')}</Chip>
        </div>
        {list.length > 0 && <div className="small strong muted mt-14" style={{ fontSize: 14 }}>{list.length === 1 ? t('ya.families.countOne') : t('ya.families.count', { n: list.length })}</div>}
        {list.length === 0 && (
          <Empty icon="house2" title={t('ya.families.emptyT')} body={t('ya.families.emptyB')}>
            {y.hidden.length > 0 && <Button kind="ghost" onClick={resetHidden}>{t('ya.families.resetHidden')}</Button>}
          </Empty>
        )}
        <div className="stack gap-12 mt-12">
          {list.map(k => <FamilyCard key={k.id} k={k} />)}
        </div>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

function FamilyCard({ k }: { k: Household }) {
  const t = useT();
  const y = useStore(s => s.yaya);
  const sent = y.interested.includes(k.id);
  return (
    <article className="fcard" data-testid={`fam-${k.id}`}>
      <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
        <button type="button" className="fcard__head flex1" onClick={() => nav('y-family', k.id)}>
          <HouseholdAvatar k={k} />
          <div className="flex1"><div className="fcard__name">{k.name}</div><div className="small muted" style={{ fontSize: 13.5 }}>{t(`cities.${k.city}`)} · {needLine(t, k)}</div></div>
        </button>
        <IconButton name="x" label={t('ya.families.notNow')} variant="iconbtn--plain" size={18} onClick={() => {
          hideHousehold(k.id); toast(t('ya.families.hidden'), { action: { label: t('common.undo'), run: () => unhideHousehold(k.id) } });
        }} />
      </div>
      <div className="fcard__pay"><b>{pesoRange(k.rateMin, k.rateMax)}</b><span className="small muted" style={{ fontSize: 13 }}>{t('ya.families.perMonth')}</span></div>
      <div className="stack gap-6 mt-8">
        <Fact icon="home" size={14}>{scheduleLine(t, k)}</Fact>
        <Fact icon="calendar" size={14}>{t('ya.families.dayOff', { days: daysLabel(t, k.daysOff) })}</Fact>
        <Fact icon="users" size={14}>{householdLine(t, k)}</Fact>
      </div>
      <div className="tags mt-10">
        {k.likedYou && <Tag icon="heart">{t('ya.families.likedTag')}</Tag>}
        {k.checks.id && <Tag tone="ok" icon="check">{t('ya.family.hid')} · {monthLabel(t, k.checks.id)}</Tag>}
        {k.origin && <Tag tone="navy">{t(`origin.${k.origin}`)}</Tag>}
        <SampleTag on={k.sample} tone="muted" />
      </div>
      <div className="row gap-10 mt-14">
        <Button kind="ghost" size="md" block={false} onClick={() => nav('y-family', k.id)}>{t('ya.families.view')}</Button>
        {sent ? <Button kind="soft" size="md" icon="check" disabled>{t('common.sent')}</Button>
          : <Button size="md" icon="heart" onClick={() => interested(t, k)} testId={`interest-${k.id}`}>{t('ya.families.interestedShort')}</Button>}
      </div>
    </article>
  );
}

// ---------- Family detail ----------
export function YayaFamilyDetail({ id }: { id: string }) {
  const t = useT();
  const y = useStore(s => s.yaya);
  const k = householdById(id);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const desk = useIsDesktop();
  if (!k || y.blocked.includes(id)) return <NotFound />;
  const matched = y.matches.includes(id);
  const sent = y.interested.includes(id) && !matched;
  const extras = [...k.extras.map(e => t(`perks.${e}`)), ...(k.transport ? [t('ya.family.transport')] : [])];
  if (desk) {
    // Pattern E: sections on the left, sticky offer card on the right.
    return (
      <Screen tone="blush" side="yaya" label={k.name} nav={<YayaNav active="families" />} desk="detail"
        header={<div className="crumbrow"><BackLink to="y-families" label={t('tabs.families')} /><IconButton name="more" label={t('common.more')} onClick={() => setMenu(true)} /></div>}
        overlay={<>
          {menu && (
            <Sheet title={k.name} onClose={() => setMenu(false)}>
              <button type="button" className="menu-item" onClick={() => { setMenu(false); setReport(true); }}><Icon name="flag" size={20} />{t('chat.mReport')}</button>
              <button type="button" className="menu-item menu-item--danger" onClick={() => {
                setMenu(false); blockParty('yaya', id); nav('y-families', undefined, { replace: true });
                toast(t('chat.blocked', { name: k.name }), { action: { label: t('common.undo'), run: () => unblockParty('yaya', id) } });
              }}><Icon name="ban" size={20} />{t('chat.mBlock', { name: k.name })}</button>
            </Sheet>
          )}
          {report && <ReportSheet side="yaya" id={id} name={k.name} onClose={() => setReport(false)} />}
        </>}>
        <div className="dgrid dgrid--detail">
          <div className="dmain">
            <div className="card dfam">
              <div className="row gap-18">
                <HouseholdAvatar k={k} size={96} />
                <div className="flex1">
                  <h1 className="h1">{k.name}</h1>
                  <div className="dhero__sub">{t(`cities.${k.city}`)} · {householdLine(t, k)}</div>
                  <div className="tags mt-12">
                    {k.likedYou && <Tag icon="heart">{t('ya.families.likedTag')}</Tag>}
                    {k.checks.id && <Tag tone="ok" icon="check">{t('ya.family.hid')} · {monthLabel(t, k.checks.id)}</Tag>}
                    {k.origin && <Tag tone="navy">{t(`origin.${k.origin}`)}</Tag>}
                    <SampleTag on={k.sample} tone="muted" />
                  </div>
                </div>
              </div>
            </div>
            <div className="dcols">
              <Section title={t('ya.family.needs')}>
                <Card><div className="chips" style={{ marginTop: 0 }}>{k.needs.map(r => <Chip key={r} on icon={ROLE_ICON[r]}>{t(`roles.${r}`)}</Chip>)}</div></Card>
              </Section>
              {k.houseRule && <Section title={t('ya.family.houseRule')}>
                <Card><p className="dbody">{k.houseRule}</p></Card>
              </Section>}
            </div>
            {k.bio && <Section title={t('ya.family.fromFamily')}>
              <Card><p className="dbody">“{k.bio}”</p><div className="mt-10"><Tag tone="muted">{t('ya.family.writtenBy')}</Tag></div></Card>
            </Section>}
            <Section title={t('ya.family.law')}>
              <Card>
                <div className="dlaw">{['l1', 'l2', 'l3', 'l4', 'l5'].map(l => <div key={l} className="row gap-10"><span style={{ color: 'var(--ok)' }}><Icon name="check" size={18} sw={2.6} /></span>{t(`ya.family.${l}`)}</div>)}</div>
                {extras.length > 0 && <div className="small muted mt-12" style={{ paddingTop: 12, borderTop: '1px solid #F3E6EA', fontSize: 14 }}>{t('ya.family.extras', { list: listJoin(t, extras) })}</div>}
              </Card>
            </Section>
            {k.notes.length > 0 && <Section title={t('ya.family.notes')}><div className="qgrid">{k.notes.map((n, i) => <QuoteCard key={i} text={n.text} who={n.who} />)}</div></Section>}
          </div>
          <aside className="dside">
            <div className="card dside__card">
              <div className="eyebrow">{t('ya.family.offer')}</div>
              <div className="dside__price">{pesoRange(k.rateMin, k.rateMax)}<small>{t('ya.family.perMonth')}</small></div>
              <div className="stack gap-8 mt-14">
                <Fact icon="home" size={15}>{t(`yarr.${k.arrangement}`)}</Fact>
                {k.hours && <Fact icon="clock" size={15}>{t('ya.family.hoursT', { days: workDaysLabel(t, k.daysOff), hours: hoursLabel(k.hours) })}</Fact>}
                <Fact icon="calendar" size={15}>{t('ya.family.dayOff', { days: daysLabel(t, k.daysOff) })}</Fact>
                {k.startDate && <Fact icon="zap" size={15}>{t('ya.family.start', { date: dateLabel(t, k.startDate) })}</Fact>}
              </div>
              <div className="dside__actions">
                {matched ? <Button icon="chat" onClick={() => nav('y-chat', id)}>{t('ya.family.openChat')}</Button>
                  : sent ? <Note tone="info" icon="check">{t('ya.family.youInterested')}</Note>
                    : <>
                      <Button icon="heart" onClick={() => interested(t, k)} testId="detail-interest">{t('ya.family.interested')}</Button>
                      <Button kind="ghost" icon="x" onClick={() => { hideHousehold(id); back('y-families'); }}>{t('ya.family.notNow')}</Button>
                    </>}
              </div>
              <div className="dside__checks">
                <div className="eyebrow">{t('ya.family.checks')}</div>
                {k.checks.phone && <div className="check-row"><span className="check-row__icon"><Icon name="check" size={16} sw={2.6} /></span><div className="flex1"><b>{t('ya.family.phone')}</b><span>{t('ya.family.phoneDone', { month: monthLabel(t, k.checks.phone) })}</span></div></div>}
                <div className="check-row"><span className={`check-row__icon${k.checks.id ? '' : ' no'}`}><Icon name={k.checks.id ? 'check' : 'minus'} size={16} /></span><div className="flex1"><b>{t('ya.family.hid')}</b><span>{k.checks.id ? t('ya.family.hidDone', { month: monthLabel(t, k.checks.id) }) : t('fam.profile.notYet')}</span></div></div>
                <div className="check-row"><span className="check-row__icon no"><Icon name="lock" size={15} /></span><div className="flex1"><b>{t('ya.family.address')}</b><span>{t('ya.family.addressNote')}</span></div></div>
              </div>
            </div>
          </aside>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya" label={k.name}
      header={<TopBar back="y-families" title={k.name} sub={t(`cities.${k.city}`)} right={<IconButton name="more" label={t('common.more')} onClick={() => setMenu(true)} />} />}
      footer={
        <Footer bar row>
          {matched ? <Button icon="chat" onClick={() => nav('y-chat', id)}>{t('ya.family.openChat')}</Button>
            : sent ? <div className="note note--info" style={{ flex: 1 }}><Icon name="check" size={16} /><span>{t('ya.family.youInterested')}</span></div>
              : <>
                <button type="button" className="iconbtn" style={{ width: 58, height: 58 }} aria-label={t('ya.family.notNow')} onClick={() => { hideHousehold(id); back('y-families'); }}><Icon name="x" size={24} /></button>
                <div className="flex1"><Button icon="heart" onClick={() => interested(t, k)} testId="detail-interest">{t('ya.family.interested')}</Button></div>
              </>}
        </Footer>
      }
      overlay={<>
        {menu && (
          <Sheet title={k.name} onClose={() => setMenu(false)}>
            <button type="button" className="menu-item" onClick={() => { setMenu(false); setReport(true); }}><Icon name="flag" size={20} />{t('chat.mReport')}</button>
            <button type="button" className="menu-item menu-item--danger" onClick={() => {
              setMenu(false); blockParty('yaya', id); nav('y-families', undefined, { replace: true });
              toast(t('chat.blocked', { name: k.name }), { action: { label: t('common.undo'), run: () => unblockParty('yaya', id) } });
            }}><Icon name="ban" size={20} />{t('chat.mBlock', { name: k.name })}</button>
          </Sheet>
        )}
        {report && <ReportSheet side="yaya" id={id} name={k.name} onClose={() => setReport(false)} />}
      </>}>
      <div className="pad">
        <div className="row gap-14">
          <HouseholdAvatar k={k} size={72} />
          <div className="flex1"><h1 className="h1 h1--sm">{k.name}</h1><div className="small muted" style={{ fontSize: 14 }}>{householdLine(t, k)}</div></div>
        </div>
        <div className="tags mt-12">
          {k.likedYou && <Tag tone="white" icon="heart">{t('ya.families.likedTag')}</Tag>}
          {k.checks.id && <Tag tone="ok" icon="check">{t('ya.family.hid')} · {monthLabel(t, k.checks.id)}</Tag>}
          {k.origin && <Tag tone="navy">{t(`origin.${k.origin}`)}</Tag>}
          <SampleTag on={k.sample} />
        </div>
        <Card className="mt-16">
          <div className="eyebrow">{t('ya.family.offer')}</div>
          <div className="mt-6" style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 700 }}>{pesoRange(k.rateMin, k.rateMax)}</div>
          <div className="small muted" style={{ fontSize: 13.5 }}>{t('ya.family.perMonth')}</div>
          <div className="stack gap-8 mt-12">
            <Fact icon="home" size={14.5}>{t(`yarr.${k.arrangement}`)}</Fact>
            {k.hours && <Fact icon="clock" size={14.5}>{t('ya.family.hoursT', { days: workDaysLabel(t, k.daysOff), hours: hoursLabel(k.hours) })}</Fact>}
            <Fact icon="calendar" size={14.5}>{t('ya.family.dayOff', { days: daysLabel(t, k.daysOff) })}</Fact>
            {k.startDate && <Fact icon="zap" size={14.5}>{t('ya.family.start', { date: dateLabel(t, k.startDate) })}</Fact>}
          </div>
        </Card>
        <Section title={t('ya.family.needs')}>
          <div className="chips" style={{ marginTop: 0 }}>{k.needs.map(r => <Chip key={r} on icon={ROLE_ICON[r]}>{t(`roles.${r}`)}</Chip>)}</div>
        </Section>
        <Section title={t('ya.family.fromFamily')}>
          {k.bio && <Card><p style={{ fontSize: 15, lineHeight: 1.55 }}>“{k.bio}”</p><div className="mt-8"><Tag tone="muted">{t('ya.family.writtenBy')}</Tag></div></Card>}
          {k.houseRule && <div className="prompt" style={{ background: '#fff' }}><small>{t('ya.family.houseRule')}</small><span>{k.houseRule}</span></div>}
        </Section>
        <Section title={t('ya.family.law')}>
          <Card style={{ padding: '8px 14px 12px' }}>
            {['l1', 'l2', 'l3', 'l4', 'l5'].map(l => <div key={l} className="row gap-10" style={{ padding: '7px 0', fontSize: 14.5 }}><span style={{ color: 'var(--ok)' }}><Icon name="check" size={18} sw={2.6} /></span>{t(`ya.family.${l}`)}</div>)}
            {extras.length > 0 && <div className="small muted mt-8" style={{ paddingTop: 10, borderTop: '1px solid #F3E6EA', fontSize: 13 }}>{t('ya.family.extras', { list: listJoin(t, extras) })}</div>}
          </Card>
        </Section>
        <Section title={t('ya.family.checks')}>
          <Card style={{ padding: '4px 14px' }}>
            {k.checks.phone && <div className="check-row"><span className="check-row__icon"><Icon name="check" size={16} sw={2.6} /></span><div className="flex1"><b>{t('ya.family.phone')}</b><span>{t('ya.family.phoneDone', { month: monthLabel(t, k.checks.phone) })}</span></div></div>}
            <div className="check-row"><span className={`check-row__icon${k.checks.id ? '' : ' no'}`}><Icon name={k.checks.id ? 'check' : 'minus'} size={16} /></span><div className="flex1"><b>{t('ya.family.hid')}</b><span>{k.checks.id ? t('ya.family.hidDone', { month: monthLabel(t, k.checks.id) }) : t('fam.profile.notYet')}</span></div></div>
            <div className="check-row"><span className="check-row__icon no"><Icon name="lock" size={15} /></span><div className="flex1"><b>{t('ya.family.address')}</b><span>{t('ya.family.addressNote')}</span></div></div>
          </Card>
        </Section>
        {k.notes.length > 0 && <Section title={t('ya.family.notes')}>{k.notes.map((n, i) => <QuoteCard key={i} text={n.text} who={n.who} />)}</Section>}
        <div className="spacer" />
      </div>
    </Screen>
  );
}

// ---------- Match ----------
export function YayaMatch({ id }: { id: string }) {
  const t = useT();
  const y = useStore(s => s.yaya);
  const k = householdById(id);
  useEffect(() => { if (k) markMatchSeen('yaya', id); }, [id]);
  const desk = useIsDesktop();
  if (!k || !y.matches.includes(id)) return <NotFound />;
  if (desk) {
    return (
      <Screen tone="blush" side="yaya" nav={<YayaNav active="matches" />} desk="center">
        <div className="dcenter">
          <div className="dcard center">
            <div className="kicker">{t('ya.match.kicker')}</div>
            <h1 className="h1 mt-8">{t('ya.match.title', { name: k.name })}</h1>
            <div className="pair">
              <svg className="arc" width="280" height="60" viewBox="0 0 280 60" aria-hidden="true"><path d="M60 52 C 110 0, 170 0, 220 52" fill="none" stroke="#F4516C" strokeWidth="6" strokeLinecap="round" /></svg>
              <span className="a"><Avatar src={y.photo} initials={(y.name || '?').slice(0, 1)} size={130} ring="#fff" bg="var(--coral-deep)" /></span>
              <span className="b"><span style={{ display: 'inline-block', borderRadius: 999, overflow: 'hidden', boxShadow: '0 0 0 3px #fff' }}><Avatar initials={k.initials} size={130} /></span></span>
              <span className="heart"><Icon name="heart" size={26} fill="#F4516C" /></span>
            </div>
            <p className="dlead">{t('ya.match.body')}</p>
            <div className="dsteps">
              <div className="eyebrow">{t('ya.match.tipsT')}</div>
              {[['clock', 't1'], ['pin', 't2'], ['alert', 't3']].map(([ic, kk]) => <div key={kk} className="dsteps__row"><Icon name={ic} size={18} /><span>{t(`ya.match.${kk}`)}</span></div>)}
            </div>
            <div className="dactions">
              <Button kind="ghost" block={false} onClick={() => nav('y-families')}>{t('ya.match.later')}</Button>
              <Button icon="chat" block={false} onClick={() => nav('y-chat', id, { replace: true })} testId="say-hello">{t('ya.match.sayHello')}</Button>
            </div>
          </div>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya"
      header={<TopBar right={<IconButton name="x" label={t('common.close')} onClick={() => nav('y-families')} />} />}
      footer={<Footer><Button icon="chat" onClick={() => nav('y-chat', id, { replace: true })} testId="say-hello">{t('ya.match.sayHello')}</Button><Button kind="ghost" onClick={() => nav('y-families')}>{t('ya.match.later')}</Button></Footer>}>
      <div className="pad center">
        <div className="kicker">{t('ya.match.kicker')}</div>
        <h1 className="h1 mt-8">{t('ya.match.title', { name: k.name })}</h1>
        <div className="pair">
          <svg className="arc" width="280" height="60" viewBox="0 0 280 60" aria-hidden="true"><path d="M60 52 C 110 0, 170 0, 220 52" fill="none" stroke="#F4516C" strokeWidth="6" strokeLinecap="round" /></svg>
          <span className="a"><Avatar src={y.photo} initials={(y.name || '?').slice(0, 1)} size={130} ring="#fff" bg="var(--coral-deep)" /></span>
          <span className="b"><span style={{ display: 'inline-block', borderRadius: 999, overflow: 'hidden', boxShadow: '0 0 0 3px #fff' }}><Avatar initials={k.initials} size={130} /></span></span>
          <span className="heart"><Icon name="heart" size={26} fill="#F4516C" /></span>
        </div>
        <p className="mt-16" style={{ fontSize: 15.5 }}>{t('ya.match.body')}</p>
      </div>
      <div className="pad">
        <Card className="mt-20">
          <div className="eyebrow">{t('ya.match.tipsT')}</div>
          <div className="stack gap-10 mt-10">
            {[['clock', 't1'], ['pin', 't2'], ['alert', 't3']].map(([ic, kk]) => <div key={kk} className="row gap-10" style={{ alignItems: 'flex-start', fontSize: 14.5 }}><span style={{ color: 'var(--coral-deep)' }}><Icon name={ic} size={18} /></span><span>{t(`ya.match.${kk}`)}</span></div>)}
          </div>
        </Card>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

// ---------- Chat ----------
export function YayaChat({ id }: { id: string }) {
  const t = useT();
  const y = useStore(s => s.yaya);
  const k = householdById(id);
  const c = y.chats[id];
  const [text, setText] = useState('');
  const [share, setShare] = useState(false);
  const [call, setCall] = useState(false);
  const [report, setReport] = useState(false);
  const idStatus = useStore(s => s.live?.idStatus ?? 'none');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const desk = useIsDesktop();
  useEffect(() => { setUi({ activeChat: 'y-' + id }); markMatchSeen('yaya', id); return () => setUi({ activeChat: null }); }, [id]);
  useEffect(() => watchChat(id), [id]);
  useEffect(() => { readChat('yaya', id); const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [c?.messages.length, c?.typing]);
  if (!k || !c || y.blocked.includes(id)) return <NotFound />;
  // Her own ID check comes before the first message (the server answers 'needs_id' too).
  const can = yayaCanSend(id);
  const startGate = () => { setUi({ idReturn: 'y-chat-' + id }); nav('y-idcheck'); };
  const gated = (r: string) => { if (r === 'needs_id') startGate(); };
  const send = (body = text) => {
    const r = sendYayaMessage(id, body);
    if (r instanceof Promise) setText('');
    settle(r, v => { if (v === 'ok') setText(''); else { if (r instanceof Promise && v !== 'empty') setText(body); gated(v); } });
  };
  const openPlan = () => (can === 'needs_id' ? startGate() : setCall(true));
  const openShare = () => (can === 'needs_id' ? startGate() : setShare(true));
  const quick = [t('chat.stHours'), t('chat.stCallFirst'), k.arrangement === 'livein' ? t('chat.stRoom') : t('chat.stFare')];
  const showShare = !c.iShared && c.messages.some(m => m.from === 'them') && can === 'ok';
  const head = (
    <header className="chat-head">
      {!desk && <IconButton name="back" label={t('common.back')} variant="iconbtn--plain" onClick={() => back('y-chats')} />}
      <button type="button" className="chat-head__who row gap-10" onClick={() => nav('y-family', id)}>
        <HouseholdAvatar k={k} size={40} />
        <span className="flex1 who"><b>{k.name}</b><span><SampleTag on={k.sample} tone="muted" />{t(`cities.${k.city}`)}</span></span>
      </button>
      <IconButton name="calendar" label={t('chat.plan')} onClick={openPlan} testId="chat-plan" />
      <IconButton name="flag" label={t('chat.mReport')} variant="iconbtn--plain" onClick={() => setReport(true)} />
    </header>
  );
  const note = <Note tone="warn" icon="alert" bar>{t('chat.safetyYaya')}</Note>;
  const composer = can === 'needs_id' ? <IdGate side="yaya" status={idStatus} onStart={startGate} /> : (
    <>
      <div className="starters"><Chip small icon="calendar" onClick={openPlan}>{t('chat.stCall')}</Chip>{quick.map(q => <Chip key={q} small onClick={() => setText(q)}>{q}</Chip>)}</div>
      <form className="composer" onSubmit={e => { e.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="ymsg">{t('chat.placeholder')}</label>
        <input id="ymsg" className="composer__input" value={text} placeholder={t('chat.placeholder')} onChange={e => setText((e.target as HTMLInputElement).value)} data-testid="composer" style={{ fontSize: 15.5 }} />
        {!LIVE && <button type="button" className="iconbtn" style={{ background: 'var(--blush)', color: 'var(--coral-deep)', border: 0 }} aria-label={t('chat.voiceNote')} onClick={() => toast(t('chat.voiceDemo'))}><Icon name="mic" size={20} /></button>}
        <button type="submit" className="iconbtn send" aria-label={t('chat.send')} disabled={!text.trim()} data-testid="send"><Icon name="send" size={20} /></button>
      </form>
    </>
  );
  const overlay = (
    <>
      {share && (
        <ShareSheet name={k.name} needPhone={LIVE} phone={y.phoneShare} onClose={() => setShare(false)}
          onShare={num => { setShare(false); settle(shareYayaNumber(id, num), r => { if (r === 'ok') toast(t('chat.shareDone')); else gated(r); }); }} />
      )}
      {call && <PlanSheet name={k.name} onClose={() => setCall(false)} onSend={p => { setCall(false); settle(planYayaCall(id, p), gated); }} />}
      {report && <ReportSheet side="yaya" id={id} name={k.name} onClose={() => setReport(false)} />}
    </>
  );
  const msgs = (
    <div className="msgs">
      <div className="sys"><Tag tone="white" icon="heart">{t('chat.matched', { when: dayClock(t, c.matchedAt) })}</Tag></div>
      {c.messages.map(m => <MessageView key={m.id} m={m} side="yaya" otherName={k.name} onHired={() => nav('y-hired', id)} />)}
      {c.typing && <TypingDots name={k.name} />}
      {showShare && (
        <div className="sys-card">
          <div className="row gap-10" style={{ alignItems: 'flex-start' }}><span style={{ color: 'var(--coral-deep)' }}><Icon name="phone" size={20} /></span>
            <div style={{ fontSize: 14, lineHeight: 1.45 }}><strong style={{ fontWeight: 600 }}>{t('chat.shareCardT')}</strong> {t('chat.shareCardS')}</div></div>
          <div className="row gap-8 mt-12">
            <Button kind="navy" size="sm" onClick={openShare} testId="share-number">{t('chat.shareConfirm')}</Button>
          </div>
        </div>
      )}
    </div>
  );
  if (desk) {
    // Pattern F: conversation list, thread, context panel.
    return (
      <Screen tone="blush" side="yaya" label={k.name} nav={<YayaNav active="chat" />} wide desk="chat" overlay={overlay}>
        <div className="panes">
          <YayaConvList activeId={id} />
          <section className="thread" aria-label={k.name}>
            {head}{note}
            <div className="thread__scroll" ref={scrollRef}>{msgs}</div>
            {composer}
          </section>
          <aside className="ctx">
            <div className="ctx__who">
              <HouseholdAvatar k={k} size={88} />
              <h2 className="h3 mt-12">{k.name}</h2>
              <SampleTag on={k.sample} tone="muted" />
              <div className="small muted">{t(`cities.${k.city}`)} · {needLine(t, k)}</div>
              <div className="ctx__rate">{pesoRange(k.rateMin, k.rateMax)} <span className="small muted">{t('ya.family.perMonth')}</span></div>
              {c.hired && <Tag tone="ok" icon="check">{t('fam.profile.hiredBadge')}</Tag>}
              <Button kind="ghost" size="sm" block={false} icon="house2" onClick={() => nav('y-family', id)}>{t('desk.ctx.viewFamily')}</Button>
            </div>
            <div className="ctx__sec">
              <Fact icon="home" size={14.5}>{scheduleLine(t, k)}</Fact>
              <div className="mt-8"><Fact icon="calendar" size={14.5}>{t('ya.family.dayOff', { days: daysLabel(t, k.daysOff) })}</Fact></div>
            </div>
            <div className="ctx__sec">
              <div className="eyebrow">{t('ya.family.checks')}</div>
              {k.checks.phone && <div className="check-row"><span className="check-row__icon"><Icon name="check" size={16} sw={2.6} /></span><div className="flex1"><b>{t('ya.family.phone')}</b><span>{t('ya.family.phoneDone', { month: monthLabel(t, k.checks.phone) })}</span></div></div>}
              <div className="check-row"><span className={`check-row__icon${k.checks.id ? '' : ' no'}`}><Icon name={k.checks.id ? 'check' : 'minus'} size={16} /></span><div className="flex1"><b>{t('ya.family.hid')}</b><span>{k.checks.id ? t('ya.family.hidDone', { month: monthLabel(t, k.checks.id) }) : t('fam.profile.notYet')}</span></div></div>
            </div>
            <div className="ctx__sec">
              <button type="button" className="menu-item" onClick={openPlan} data-testid="ctx-plan"><Icon name="calendar" size={20} />{t('chat.mCall')}</button>
              {c.iShared ? <div className="menu-item" style={{ cursor: 'default', color: 'var(--ok)' }}><Icon name="check" size={20} />{t('chat.youShared')}</div>
                : <button type="button" className="menu-item" onClick={openShare} data-testid="ctx-share"><Icon name="phone" size={20} />{t('chat.shareConfirm')}</button>}
              {c.hired && <button type="button" className="menu-item" onClick={() => nav('y-hired', id)}><Icon name="check" size={20} />{t('chat.hiredCard', { name: k.name })}</button>}
              <button type="button" className="menu-item menu-item--danger" onClick={() => setReport(true)}><Icon name="flag" size={20} />{t('chat.mReport')}</button>
            </div>
          </aside>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya" scrollRef={scrollRef} label={k.name}
      header={<>{head}{note}</>}
      footer={composer}
      overlay={overlay}>
      {msgs}
    </Screen>
  );
}

// Conversation list for the desktop chat panes (pattern F).
function YayaConvList({ activeId }: { activeId?: string }) {
  const t = useT();
  const y = useStore(s => s.yaya);
  const ids = Object.keys(y.chats).filter(id => !y.blocked.includes(id) && householdById(id)).sort((a, b) => lastAt(y.chats[b]) - lastAt(y.chats[a]));
  return (
    <div className="convs">
      <div className="convs__head">
        <h1 className="convs__title">{t('ya.chats.title')}</h1>
      </div>
      <div className="convs__list">
        {ids.length === 0 && <Empty icon="chat" title={t('ya.chats.empty')} body={t('ya.chats.emptyB')} />}
        {ids.map(id => {
          const k = householdById(id)!; const c = y.chats[id];
          return (
            <button key={id} type="button" className={`list-row${id === activeId ? ' is-active' : ''}`} onClick={() => nav('y-chat', id)} data-testid={`ychat-row-${id}`}>
              <HouseholdAvatar k={k} size={48} />
              <div className="flex1"><div className="row gap-8"><b>{k.name}</b>{c.hired && <Tag tone="ok" icon="check">{t('fam.inbox.hiredTag')}</Tag>}</div>
                <small className="convs__preview" style={{ fontWeight: c.unread ? 600 : 400, color: c.unread ? 'var(--navy)' : undefined }}>{c.typing ? t('chat.typing', { name: k.name }) : lastPreview(t, c, k.name) || t('ya.chats.sayHello')}</small></div>
              <div className="stack gap-6" style={{ alignItems: 'flex-end' }}><span className="small muted">{ago(t, lastAt(c))}</span>{c.unread > 0 && <span className="tabbar__badge" style={{ position: 'static' }}>{c.unread}</span>}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Matches ----------
export function YayaMatches() {
  const t = useT();
  const s = useStore(st => st);
  const y = s.yaya;
  const tabs = useYayaTabs();
  const liking = familiesLikingYou(s);
  const matched = y.matches.filter(id => !y.blocked.includes(id) && householdById(id));
  const pending = y.interested.filter(id => !y.matches.includes(id) && !y.blocked.includes(id) && householdById(id));
  const desk = useIsDesktop();
  const row = (k: Household, right: React.ReactNode, onClick: () => void) => (
    <div key={k.id} className="list-row">
      <button type="button" className="row gap-12 flex1" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'var(--navy)' }} onClick={onClick}>
        <HouseholdAvatar k={k} size={48} />
        <div className="flex1"><b>{k.name}</b><small>{t(`cities.${k.city}`)} · {pesoRange(k.rateMin, k.rateMax)}</small></div>
      </button>
      {right}
    </div>
  );
  if (desk) {
    // Three columns: families who like you, matched, waiting for their answer.
    const col = (title: string, n: number, body: React.ReactNode, note?: React.ReactNode) => (
      <section className="card mcol">
        <div className="row gap-8"><h2 className="h3 flex1">{title}</h2><span className="mcol__n">{n}</span></div>
        {note}
        {n === 0 ? <p className="small muted mt-12">{t('desk.matches.none')}</p> : <div className="mt-6">{body}</div>}
      </section>
    );
    return (
      <Screen tone="blush" side="yaya" label={t('ya.matches.title')} nav={<YayaNav active="matches" />} desk="matches" header={<PageHead title={t('ya.matches.title')} />}>
        {liking.length + matched.length + pending.length === 0 ? <div className="card"><Empty icon="heart" title={t('ya.matches.empty')} body={t('ya.matches.emptyB')} /></div> : (
          <div className="mgrid">
            {col(t('ya.matches.likedYou'), liking.length,
              liking.map(k => row(k, <IconButton name="heart" variant="iconbtn--like" label={t('ya.families.interested')} onClick={() => interested(t, k)} testId={`liked-${k.id}`} />, () => nav('y-family', k.id))),
              <Note className="mt-10" tone="info" icon="heart">{t('ya.matches.likedFree')}</Note>)}
            {col(t('ya.matches.matched'), matched.length,
              matched.map(id => { const k = householdById(id)!; return row(k, <IconButton name="chat" label={t('ya.family.openChat')} onClick={() => nav('y-chat', id)} />, () => nav('y-chat', id)); }))}
            {col(t('ya.matches.pending'), pending.length,
              pending.map(id => { const k = householdById(id)!; return row(k, <Tag tone="muted" icon="clock">{t('common.sent')}</Tag>, () => nav('y-family', id)); }))}
          </div>
        )}
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya" label={t('ya.matches.title')}
      header={<div style={{ padding: 'calc(16px + var(--safe-t)) 20px 0' }}><h1 className="h1 h1--sm">{t('ya.matches.title')}</h1></div>}
      tabbar={tabs(t('tabs.matches'))}>
      <div className="pad-s">
        {liking.length > 0 && (
          <Section title={t('ya.matches.likedYou')}>
            <Note tone="white" icon="heart">{t('ya.matches.likedFree')}</Note>
            <Card className="mt-10" style={{ padding: '4px 14px' }}>
              {liking.map(k => row(k, <IconButton name="heart" variant="iconbtn--like" label={t('ya.families.interested')} onClick={() => interested(t, k)} testId={`liked-${k.id}`} />, () => nav('y-family', k.id)))}
            </Card>
          </Section>
        )}
        {matched.length > 0 && (
          <Section title={t('ya.matches.matched')}>
            <Card style={{ padding: '4px 14px' }}>
              {matched.map(id => { const k = householdById(id)!; return row(k, <IconButton name="chat" label={t('ya.family.openChat')} onClick={() => nav('y-chat', id)} />, () => nav('y-chat', id)); })}
            </Card>
          </Section>
        )}
        {pending.length > 0 && (
          <Section title={t('ya.matches.pending')}>
            <Card style={{ padding: '4px 14px' }}>
              {pending.map(id => { const k = householdById(id)!; return row(k, <Tag tone="muted" icon="clock">{t('common.sent')}</Tag>, () => nav('y-family', id)); })}
            </Card>
          </Section>
        )}
        {liking.length + matched.length + pending.length === 0 && <Empty icon="heart" title={t('ya.matches.empty')} body={t('ya.matches.emptyB')} />}
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function YayaChats() {
  const t = useT();
  const y = useStore(s => s.yaya);
  const tabs = useYayaTabs();
  const ids = Object.keys(y.chats).filter(id => !y.blocked.includes(id) && householdById(id)).sort((a, b) => lastAt(y.chats[b]) - lastAt(y.chats[a]));
  const desk = useIsDesktop();
  if (desk) {
    return (
      <Screen tone="blush" side="yaya" label={t('ya.chats.title')} nav={<YayaNav active="chat" />} wide desk="chat">
        <div className="panes panes--2">
          <YayaConvList />
          <EmptyThread side="yaya">{ids.length === 0 && <Button block={false} to="y-families">{t('ya.ready.seeFamilies')}</Button>}</EmptyThread>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya" label={t('ya.chats.title')}
      header={<div style={{ padding: 'calc(16px + var(--safe-t)) 20px 0' }}><h1 className="h1 h1--sm">{t('ya.chats.title')}</h1></div>}
      tabbar={tabs(t('tabs.chat'))}>
      <div className="pad-s mt-12">
        {ids.length === 0 ? <Empty icon="chat" title={t('ya.chats.empty')} body={t('ya.chats.emptyB')}><Button block={false} to="y-families">{t('ya.ready.seeFamilies')}</Button></Empty> : (
          <Card style={{ padding: '4px 14px' }}>
            {ids.map(id => {
              const k = householdById(id)!; const c = y.chats[id];
              return (
                <button key={id} type="button" className="list-row" onClick={() => nav('y-chat', id)} data-testid={`ychat-row-${id}`}>
                  <HouseholdAvatar k={k} size={50} />
                  <div className="flex1"><div className="row gap-8"><b>{k.name}</b>{c.hired && <Tag tone="ok" icon="check">{t('ya.chats.hired')}</Tag>}</div>
                    <small style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: c.unread ? 600 : 400, color: c.unread ? 'var(--navy)' : undefined }}>{c.typing ? t('chat.typing', { name: k.name }) : lastPreview(t, c, k.name) || t('ya.chats.sayHello')}</small></div>
                  <div className="stack gap-6" style={{ alignItems: 'flex-end' }}><span className="small muted">{ago(t, lastAt(c))}</span>{c.unread > 0 && <span className="tabbar__badge" style={{ position: 'static' }}>{c.unread}</span>}</div>
                </button>
              );
            })}
          </Card>
        )}
        <div className="spacer" />
      </div>
    </Screen>
  );
}
const lastAt = (c: { messages: { at: number }[]; matchedAt: number }) => (c.messages.length ? c.messages[c.messages.length - 1].at : c.matchedAt);

// ---------- Hired ----------
export function YayaHired({ id }: { id: string }) {
  const t = useT();
  const y = useStore(s => s.yaya);
  const k = householdById(id);
  const desk = useIsDesktop();
  if (!k || !y.chats[id]?.hired) return <NotFound />;
  const city = y.homeCity ?? k.city;
  const w = minWageFor(city);
  const confirmed = y.hired?.householdId === id && y.hired.confirmed;
  if (desk) {
    return (
      <Screen tone="blush" side="yaya" nav={<YayaNav active="chat" />} desk="center">
        <div className="dcenter">
          <div className="dcard dcard--hired">
            <div className="center">
              <div style={{ position: 'relative', width: 96, margin: '0 auto' }}>
                <Avatar src={y.photo} initials={(y.name || '?').slice(0, 1)} size={96} ring="#fff" bg="var(--coral-deep)" />
                <span className="hired-badge"><Icon name="check" size={18} sw={3} /></span>
              </div>
              <h1 className="h1 mt-14">{t('ya.hired.title', { name: y.name })}</h1>
              <p className="dlead">{t('ya.hired.body', { family: k.name })}</p>
            </div>
            <div className="drights">
              <div className="row gap-8"><span className="h3 flex1">{t('ya.hired.rightsT')}</span><span className="small muted">{t('ya.hired.law')}</span></div>
              <div className="drights__list">
                {['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'].map(r => (
                  <div key={r} className="row gap-10"><span style={{ color: 'var(--ok)' }}><Icon name="check" size={18} sw={2.6} /></span><span>{t(`ya.hired.${r}`, { amount: peso(w.amount), region: t(`regions.${regionOf(city)}`) })}</span></div>
                ))}
              </div>
              <div className="drights__hot"><Icon name="phone" size={17} />{t('ya.hired.hotline')}</div>
            </div>
            <div className="dactions">
              {confirmed ? <Button block={false} onClick={() => nav('y-me')}>{t('common.continue')}</Button> : <>
                <Button kind="ghost" block={false} onClick={() => back('y-chat', id)}>{t('ya.hired.notYet')}</Button>
                <Button block={false} onClick={() => settle(confirmYayaHired(id), ok => { if (!ok) return; toast(t('ya.hired.confirmed'), { tone: 'ok' }); nav('y-me', undefined, { replace: true }); })} testId="confirm-hired">{t('ya.hired.confirm')}</Button>
              </>}
            </div>
          </div>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya"
      header={<TopBar right={<IconButton name="x" label={t('common.close')} onClick={() => back('y-chat', id)} />} />}
      footer={<Footer>{confirmed ? <Button onClick={() => nav('y-me')}>{t('common.continue')}</Button>
        : <><Button onClick={() => settle(confirmYayaHired(id), ok => { if (!ok) return; toast(t('ya.hired.confirmed'), { tone: 'ok' }); nav('y-me', undefined, { replace: true }); })} testId="confirm-hired">{t('ya.hired.confirm')}</Button>
          <Button kind="text" onClick={() => back('y-chat', id)}>{t('ya.hired.notYet')}</Button></>}</Footer>}>
      <div className="pad center">
        <div style={{ position: 'relative', width: 84, margin: '0 auto' }}>
          <Avatar src={y.photo} initials={(y.name || '?').slice(0, 1)} size={84} ring="#fff" bg="var(--coral-deep)" />
          <span style={{ position: 'absolute', right: -4, bottom: -2, width: 34, height: 34, borderRadius: 999, background: 'var(--ok)', color: '#fff', border: '3px solid var(--blush)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={18} sw={3} /></span>
        </div>
        <h1 className="h1 mt-12" style={{ fontSize: 24 }}>{t('ya.hired.title', { name: y.name })}</h1>
        <p className="lead">{t('ya.hired.body', { family: k.name })}</p>
      </div>
      <div className="pad">
        <Card className="mt-16">
          <div className="h3" style={{ fontSize: 16 }}>{t('ya.hired.rightsT')}</div>
          <div className="small muted">{t('ya.hired.law')}</div>
          <div className="stack mt-8">
            {['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'].map(r => (
              <div key={r} className="row gap-10" style={{ padding: '4px 0', fontSize: 14.5, alignItems: 'flex-start', lineHeight: 1.4 }}>
                <span style={{ color: 'var(--ok)' }}><Icon name="check" size={18} sw={2.6} /></span>
                <span>{t(`ya.hired.${r}`, { amount: peso(w.amount), region: t(`regions.${regionOf(city)}`) })}</span>
              </div>
            ))}
          </div>
        </Card>
        <Note className="mt-10" tone="white" icon="phone">{t('ya.hired.hotline')}</Note>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

// ---------- Me ----------
export function YayaMe() {
  const t = useT();
  const s = useStore(st => st);
  const y = s.yaya;
  const tabs = useYayaTabs();
  const [reset, setReset] = useState(false);
  const hiredK = y.hired ? householdById(y.hired.householdId) : undefined;
  const edit = (to: string) => { setUi({ editing: true }); nav(to); };
  const strength = yayaStrength(y);
  const hiredMonth = y.hired ? (() => { const d = new Date(y.hired.at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })() : '';
  const desk = useIsDesktop();
  const isAdmin = LIVE && s.live?.role === 'admin';
  // Live: no phone sign-in. Show the email, and the private number used only for share-number.
  const contactRows = LIVE ? <>
    <div className="list-row" style={{ cursor: 'default' }}><span className="list-row__icon"><Icon name="mail" size={19} /></span><div className="flex1"><b>{t('live.emailRow')}</b><small>{s.live?.email ?? ''}</small></div></div>
    <div className="list-row" style={{ cursor: 'default' }}><span className="list-row__icon"><Icon name="phone" size={19} /></span><div className="flex1"><b>{t('live.phonePrivate')}</b><small>{y.phoneShare ? `+63 ${formatPhone(y.phoneShare.replace(/\D/g, '').slice(-10))}` : t('live.phoneNone')}</small></div></div>
    {isAdmin && <button type="button" className="list-row" onClick={() => nav('admin')} data-testid="open-admin"><span className="list-row__icon"><Icon name="settings" size={19} /></span><div className="flex1"><b>{t('live.admin')}</b></div><Icon name="next" size={18} /></button>}
  </> : <div className="list-row" style={{ cursor: 'default' }}><span className="list-row__icon"><Icon name="phone" size={19} /></span><div className="flex1"><b>{t('fam.me.phone')}</b><small>+63 {formatPhone(y.phone)}</small></div></div>;
  if (desk) {
    // Pattern H: section nav on the left, content cards on the right.
    const sections = [
      { id: 'ako-profile', label: t('desk.me.profile'), icon: 'user' }, { id: 'ako-edit', label: t('ya.me.edit'), icon: 'pencil' },
      { id: 'ako-checks', label: t('ya.me.checks'), icon: 'id' }, { id: 'ako-settings', label: t('desk.me.settings'), icon: 'settings' },
    ];
    return (
      <Screen tone="blush" side="yaya" label={t('ya.me.title')} nav={<YayaNav active="me" />} desk="settings"
        header={<PageHead title={t('ya.me.title')} />}
        overlay={reset && (
          <Sheet title={t('fam.me.reset')} onClose={() => setReset(false)}
            actions={<><Button onClick={() => { setReset(false); resetDemo(); nav('welcome', undefined, { replace: true }); }}>{t('fam.me.resetConfirm')}</Button><Button kind="ghost" onClick={() => setReset(false)}>{t('common.cancel')}</Button></>}>
            <p className="lead" style={{ marginTop: 0 }}>{t('fam.me.resetBody')}</p>
          </Sheet>
        )}>
        <div className="dgrid dgrid--settings">
          <aside><SideNav items={sections} label={t('ya.me.title')} /></aside>
          <div className="dsections">
            <section id="ako-profile" className="stack gap-16">
              <div className="card">
                <div className="row gap-16">
                  <Avatar src={y.photo} initials={(y.name || '?').slice(0, 1)} size={84} bg="var(--coral-deep)" />
                  <div className="flex1">
                    <div className="h2 dsec__name">{y.name}</div>
                    <div className="muted">{y.roles.map(r => t(`roles.${r}`)).join(' · ')}{y.homeCity ? ` · ${t(`cities.${y.homeCity}`)}` : ''}</div>
                    {hiredK && <div className="mt-8"><Tag tone="ok" icon="check">{t('ya.me.hiredTag', { month: monthLabel(t, hiredMonth) })}</Tag></div>}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="row gap-12">
                  <span className="list-row__icon" style={{ background: 'var(--info-bg)', color: 'var(--navy)' }}><Icon name={y.visible ? 'user' : 'eyeoff'} size={20} /></span>
                  <div className="flex1"><div className="strong">{y.visible ? t('ya.me.visibleT') : t('ya.me.hiddenT')}</div><div className="small muted">{y.visible ? t('ya.me.visibleS') : t('ya.me.hiddenS')}</div></div>
                  <Toggle on={y.visible} onChange={v => setYayaVisible(v)} label={t('ya.me.visibleT')} testId="visible" />
                </div>
              </div>
            </section>
            <section id="ako-edit" className="card">
              <div className="row gap-12"><h2 className="h3 flex1">{t('ya.me.edit')}</h2><span className="small strong" style={{ color: 'var(--ok)' }}>{t('ya.me.strength', { n: strength })}</span></div>
              <div className="bar mt-10" style={{ background: '#F1E1E5' }}><i style={{ width: `${strength}%` }} /></div>
              <div className="dedit mt-8">
                {[['y-about', 'user', 'editAbout'], ['y-work', 'briefcase', 'editWork'], ['y-skills', 'list', 'editSkills'], ['y-looking', 'peso', 'editLooking'], ['y-intro', 'mic', 'editIntro']].map(([to, ic, k]) => (
                  <button key={to} type="button" className="list-row" onClick={() => edit(to)}>
                    <span className="list-row__icon"><Icon name={ic} size={19} /></span>
                    <div className="flex1"><b>{t(`ya.me.${k}`)}</b>{k === 'editIntro' && <small>{y.voiceSec ? `${t('ya.me.voice')} · 0:${String(y.voiceSec).padStart(2, '0')}` : t('ya.me.noVoice')}</small>}</div><Icon name="next" size={18} />
                  </button>
                ))}
              </div>
            </section>
            <section id="ako-checks" className="card">
              <h2 className="h3">{t('ya.me.checks')}</h2>
              <button type="button" className="list-row" onClick={() => nav('y-idcheck')}>
                <span className="list-row__icon"><Icon name="id" size={19} /></span>
                <div className="flex1"><b>{t('ya.me.checks')}</b><small>{y.idCheck ? t('ya.me.idDone', { month: monthLabel(t, y.idCheck.month) }) : t('ya.me.idNot')}</small></div><Icon name="next" size={18} />
              </button>
              <button type="button" className="list-row" onClick={() => nav('y-rights')}>
                <span className="list-row__icon"><Icon name="doc" size={19} /></span><div className="flex1"><b>{t('ya.me.rights')}</b><small>{t('ya.me.rightsS')}</small></div><Icon name="next" size={18} />
              </button>
              <button type="button" className="list-row" onClick={() => nav('y-safety')}>
                <span className="list-row__icon"><Icon name="alert" size={19} /></span><div className="flex1"><b>{t('ya.me.safety')}</b></div><Icon name="next" size={18} />
              </button>
            </section>
            <section id="ako-settings" className="card">
              <h2 className="h3">{t('desk.me.settings')}</h2>
              {contactRows}
              {!LIVE && <><button type="button" className="list-row" onClick={() => { enterSide('family'); if (!s.langChosen) setLang('en', false); const f = getState().family; nav(f.verified ? (f.onboarded ? 'f-discover' : 'f-needs') : 'f-account'); }}>
                <span className="list-row__icon"><Icon name="swap" size={19} /></span><div className="flex1"><b>{t('ya.me.switchSide')}</b></div><Icon name="next" size={18} />
              </button>
              <button type="button" className="list-row" onClick={() => setReset(true)}>
                <span className="list-row__icon"><Icon name="refresh" size={19} /></span><div className="flex1"><b>{t('fam.me.reset')}</b></div><Icon name="next" size={18} />
              </button></>}
              <button type="button" className="list-row" onClick={() => { logout('yaya'); if (!LIVE) nav('welcome', undefined, { replace: true }); }} data-testid="logout">
                <span className="list-row__icon"><Icon name="logout" size={19} /></span><div className="flex1"><b>{t('fam.me.logout')}</b></div>
              </button>
            </section>
          </div>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya" label={t('ya.me.title')}
      header={<div className="row" style={{ justifyContent: 'space-between', padding: 'calc(16px + var(--safe-t)) 20px 0' }}><h1 className="h1 h1--sm">{t('ya.me.title')}</h1><LangToggle /></div>}
      tabbar={tabs(t('tabs.me'))}
      overlay={reset && (
        <Sheet title={t('fam.me.reset')} onClose={() => setReset(false)}
          actions={<><Button onClick={() => { setReset(false); resetDemo(); nav('welcome', undefined, { replace: true }); }}>{t('fam.me.resetConfirm')}</Button><Button kind="ghost" onClick={() => setReset(false)}>{t('common.cancel')}</Button></>}>
          <p className="lead" style={{ marginTop: 0 }}>{t('fam.me.resetBody')}</p>
        </Sheet>
      )}>
      <div className="pad-s mt-12">
        <Card>
          <div className="row gap-14">
            <Avatar src={y.photo} initials={(y.name || '?').slice(0, 1)} size={72} bg="var(--coral-deep)" />
            <div className="flex1">
              <div className="h3" style={{ fontSize: 19, fontWeight: 700 }}>{y.name}</div>
              <div className="small muted" style={{ fontSize: 13.5 }}>{y.roles.map(r => t(`roles.${r}`)).join(' · ')}{y.homeCity ? ` · ${t(`cities.${y.homeCity}`)}` : ''}</div>
              {hiredK && <div className="mt-6"><Tag tone="ok" icon="check">{t('ya.me.hiredTag', { month: monthLabel(t, hiredMonth) })}</Tag></div>}
            </div>
          </div>
        </Card>
        <Card className="mt-12">
          <div className="row gap-12">
            <span className="list-row__icon" style={{ background: 'var(--info-bg)', color: 'var(--navy)' }}><Icon name={y.visible ? 'user' : 'eyeoff'} size={20} /></span>
            <div className="flex1"><div className="strong" style={{ fontSize: 15 }}>{y.visible ? t('ya.me.visibleT') : t('ya.me.hiddenT')}</div><div className="small muted" style={{ lineHeight: 1.4 }}>{y.visible ? t('ya.me.visibleS') : t('ya.me.hiddenS')}</div></div>
            <Toggle on={y.visible} onChange={v => setYayaVisible(v)} label={t('ya.me.visibleT')} testId="visible" />
          </div>
        </Card>
        <Card className="mt-12" style={{ padding: '4px 16px' }}>
          <div className="row mt-10" style={{ justifyContent: 'space-between' }}><span className="small strong">{t('ya.me.strength', { n: strength })}</span></div>
          <div className="bar mt-6" style={{ background: '#F1E1E5' }}><i style={{ width: `${strength}%` }} /></div>
          {[['y-about', 'user', 'editAbout'], ['y-work', 'briefcase', 'editWork'], ['y-skills', 'list', 'editSkills'], ['y-looking', 'peso', 'editLooking'], ['y-intro', 'mic', 'editIntro']].map(([to, ic, k]) => (
            <button key={to} type="button" className="list-row" onClick={() => edit(to)}>
              <span className="list-row__icon"><Icon name={ic} size={19} /></span>
              <div className="flex1"><b>{t(`ya.me.${k}`)}</b>{k === 'editIntro' && <small>{y.voiceSec ? `${t('ya.me.voice')} · 0:${String(y.voiceSec).padStart(2, '0')}` : t('ya.me.noVoice')}</small>}</div><Icon name="next" size={18} />
            </button>
          ))}
        </Card>
        <Card className="mt-12" style={{ padding: '4px 16px' }}>
          <button type="button" className="list-row" onClick={() => nav('y-idcheck')}>
            <span className="list-row__icon"><Icon name="id" size={19} /></span>
            <div className="flex1"><b>{t('ya.me.checks')}</b><small>{y.idCheck ? t('ya.me.idDone', { month: monthLabel(t, y.idCheck.month) }) : t('ya.me.idNot')}</small></div><Icon name="next" size={18} />
          </button>
          <button type="button" className="list-row" onClick={() => nav('y-rights')}>
            <span className="list-row__icon"><Icon name="doc" size={19} /></span><div className="flex1"><b>{t('ya.me.rights')}</b><small>{t('ya.me.rightsS')}</small></div><Icon name="next" size={18} />
          </button>
          <button type="button" className="list-row" onClick={() => nav('y-safety')}>
            <span className="list-row__icon"><Icon name="alert" size={19} /></span><div className="flex1"><b>{t('ya.me.safety')}</b></div><Icon name="next" size={18} />
          </button>
        </Card>
        <Card className="mt-12" style={{ padding: '4px 16px' }}>
          {contactRows}
          {!LIVE && <><button type="button" className="list-row" onClick={() => { enterSide('family'); if (!s.langChosen) setLang('en', false); const f = getState().family; nav(f.verified ? (f.onboarded ? 'f-discover' : 'f-needs') : 'f-account'); }}>
            <span className="list-row__icon"><Icon name="swap" size={19} /></span><div className="flex1"><b>{t('ya.me.switchSide')}</b></div><Icon name="next" size={18} />
          </button>
          <button type="button" className="list-row" onClick={() => setReset(true)}>
            <span className="list-row__icon"><Icon name="refresh" size={19} /></span><div className="flex1"><b>{t('fam.me.reset')}</b></div><Icon name="next" size={18} />
          </button></>}
          <button type="button" className="list-row" onClick={() => { logout('yaya'); if (!LIVE) nav('welcome', undefined, { replace: true }); }} data-testid="logout">
            <span className="list-row__icon"><Icon name="logout" size={19} /></span><div className="flex1"><b>{t('fam.me.logout')}</b></div>
          </button>
        </Card>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function YayaRights() {
  const t = useT();
  const items: [string, string][] = [['doc', 'contract'], ['peso', 'wage'], ['aid', 'benefits'], ['calendar', 'thirteenth'], ['clock', 'rest'], ['home', 'leave'], ['file', 'payslip'], ['ban', 'noFees'], ['hand', 'respect']];
  const desk = useIsDesktop();
  if (desk) {
    return (
      <Screen tone="blush" side="yaya" nav={<YayaNav active="me" />} desk="rights"
        header={<><BackLink to="y-me" label={t('ya.me.title')} /><PageHead title={t('ya.rights.title')} sub={t('ya.rights.intro')} /></>}>
        <div className="dgrid dgrid--rights">
          <div className="rgrid">
            {items.map(([ic, k]) => (
              <div key={k} className="card rcard">
                <span className="list-row__icon"><Icon name={ic} size={20} /></span>
                <div><b>{t(`ya.rights.${k}`)}</b><p>{t(`ya.rights.${k}S`)}</p></div>
              </div>
            ))}
          </div>
          <aside className="stack gap-16 dside">
            <div className="card"><h2 className="h3">{t('desk.checklist.wageT')}</h2><WageTable /></div>
            <div className="card card--navy row gap-14" style={{ alignItems: 'flex-start' }}>
              <span className="path__icon"><Icon name="phone" size={22} /></span>
              <span style={{ fontSize: 15, lineHeight: 1.5 }}>{t('ya.rights.hotline')}</span>
            </div>
            <p className="small muted">{t('ya.rights.footer')}</p>
          </aside>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya" header={<TopBar back="y-me" title={t('ya.rights.title')} />}>
      <div className="pad">
        <p className="lead" style={{ marginTop: 0 }}>{t('ya.rights.intro')}</p>
        <Card className="mt-14" style={{ padding: '4px 16px' }}>
          {items.map(([ic, k]) => (
            <div key={k} className="list-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <span className="list-row__icon"><Icon name={ic} size={19} /></span>
              <div className="flex1"><b>{t(`ya.rights.${k}`)}</b><small style={{ fontSize: 13.5, lineHeight: 1.45 }}>{t(`ya.rights.${k}S`)}</small></div>
            </div>
          ))}
        </Card>
        <Note className="mt-12" tone="white" icon="phone">{t('ya.rights.hotline')}</Note>
        <p className="small muted mt-12">{t('ya.rights.footer')}</p>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function YayaSafety() {
  const t = useT();
  const desk = useIsDesktop();
  if (desk) {
    return (
      <Screen tone="blush" side="yaya" nav={<YayaNav active="me" />} desk="safety"
        header={<><BackLink to="y-me" label={t('ya.me.title')} /><PageHead title={t('ya.safety.title')} /></>}>
        <div className="dgrid dgrid--rights">
          <div className="rgrid">
            {[['ban', '1'], ['chat', '2'], ['phone', '3'], ['pin', '4'], ['id', '5']].map(([ic, n]) => (
              <div key={n} className={`card rcard${n === '1' ? ' rcard--wide' : ''}`}>
                <span className="list-row__icon"><Icon name={ic} size={20} /></span>
                <div><b>{t(`ya.safety.t${n}`)}</b><p>{t(`ya.safety.s${n}`)}</p></div>
              </div>
            ))}
          </div>
          <aside className="dside">
            <div className="card card--navy scard">
              <div className="row gap-10"><Icon name="flag" size={20} /><b className="h3" style={{ color: '#fff' }}>{t('ya.safety.report')}</b></div>
              <p>{t('ya.safety.reportS')}</p>
              <p className="scard__hot"><Icon name="phone" size={18} />{t('ya.rights.hotline')}</p>
            </div>
          </aside>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya" header={<TopBar back="y-me" title={t('ya.safety.title')} />}>
      <div className="pad">
        <Card style={{ padding: '4px 16px' }}>
          {[['ban', '1'], ['chat', '2'], ['phone', '3'], ['pin', '4'], ['id', '5']].map(([ic, n]) => (
            <div key={n} className="list-row" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <span className="list-row__icon"><Icon name={ic} size={19} /></span>
              <div className="flex1"><b>{t(`ya.safety.t${n}`)}</b><small style={{ fontSize: 13.5, lineHeight: 1.45 }}>{t(`ya.safety.s${n}`)}</small></div>
            </div>
          ))}
        </Card>
        <Section title={t('ya.safety.report')}><Card><p style={{ fontSize: 15 }}>{t('ya.safety.reportS')}</p></Card></Section>
        <Note className="mt-12" tone="white" icon="phone">{t('ya.rights.hotline')}</Note>
        <div className="spacer" />
      </div>
    </Screen>
  );
}
