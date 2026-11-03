// Pieces that know about helpers, households and chats.
import { useEffect, useRef, useState } from 'react';
import type { Helper, Household, Chat, Message, PlanHow, PlanInput } from '../lib/types';
import { useT, monthLabel, peso, pesoRange, daysLabel, clock, dayClock, quoteWho, workDaysLabel, hoursLabel, type T } from '../lib/i18n';
import { Icon, Tag, Fact, CheckRow, Avatar, Sheet, Button, Waveform, Chip, Note, asset } from './ui';
import { helperName } from '../lib/match';
import { reportParty } from '../lib/actions';
import { toast } from '../lib/store';
import { LIVE } from '../lib/config';
import { PLAN_HOW } from '../data/constants';

export function startTag(t: T, h: Helper) {
  return <Tag tone="white" icon="calendar">{t(`startIn.${h.startIn}`)}</Tag>;
}

export function helperChecks(t: T, h: Helper) {
  const c = h.checks;
  return (
    <>
      {c.phone && <CheckRow ok title={t('fam.profile.phone')} detail={t('fam.profile.phoneDone', { month: monthLabel(t, c.phone) })} />}
      <CheckRow ok={!!c.id} title={c.id ? t('fam.profile.id', { type: t(`idTypes.${c.id.type}`) }) : t('fam.profile.idPlain')}
        detail={c.id ? t('fam.profile.idDone', { month: monthLabel(t, c.id.month) }) : t('fam.profile.notYet')} />
      <CheckRow ok={!!c.nbi} title={t('fam.profile.nbi')} detail={c.nbi ? t('fam.profile.nbiDone', { month: monthLabel(t, c.nbi) }) : t('fam.profile.notProvided')} />
      <CheckRow ok={!!c.refs} title={t('fam.profile.refs')} detail={c.refs ? t('fam.profile.refsDone', { n: c.refs.n, month: monthLabel(t, c.refs.month) }) : t('fam.profile.notYet')} />
      <CheckRow ok={!!c.tesda} title={t('fam.profile.tesda')} detail={c.tesda ? t('fam.profile.tesdaDone') : t('fam.profile.notProvided')} />
      {c.medical && <CheckRow ok title={t('fam.profile.medical')} detail={t('fam.profile.medicalDone', { month: monthLabel(t, c.medical) })} />}
    </>
  );
}

export function helperRoles(t: T, h: Helper) {
  return h.roles.map(r => t(`roles.${r}`)).join(' · ');
}

/** "Hear Kristine introduce herself" (or just "Hear Kristine" when the card has no gender). */
export function hearLabel(t: T, h: Helper) {
  const pron = h.gender === 'f' ? t('fam.profile.pronF') : h.gender === 'm' ? t('fam.profile.pronM') : '';
  const s = t('fam.profile.hear', { name: h.firstName, pron }).trim();
  return pron ? s : s.replace(/\s+introduce$/, '');
}

/** Small tag on the sample profiles (live). */
export function SampleTag({ on, tone = 'white' }: { on?: boolean; tone?: 'white' | 'muted' }) {
  const t = useT();
  if (!on) return null;
  return <span data-testid="sample-tag"><Tag tone={tone}>{t('common.sample')}</Tag></span>;
}

/** Helper photo, or a soft initials block for live cards without one. */
export function HelperPhoto({ h, alt = '' }: { h: Helper; alt?: string }) {
  if (h.photo) return <img src={asset(h.photo)} alt={alt} />;
  return <span className="photo-none" aria-hidden="true">{h.firstName.slice(0, 1)}</span>;
}

/** Availability line for live cards that have no free-text schedule. */
export function availabilityLine(t: T, h: Helper) {
  return h.schedule || `${t(`startIn.${h.startIn}`)} · ${t('fam.profile.offTag', { days: h.daysOff.map(d => t(`days.${d}`)).join('–') })}`;
}

export function VoicePlayer({ sec, script, label, navy, src }: { sec: number; script?: string; label: string; navy?: boolean; src?: string }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const [p, setP] = useState(0);
  const timer = useRef<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); audio.current?.pause(); }, []);
  const toggle = () => {
    if (src) {
      // live: a real recording from storage
      if (!audio.current) {
        const a = new Audio(src);
        a.ontimeupdate = () => setP(a.duration ? a.currentTime / a.duration : 0);
        a.onended = () => { setPlaying(false); setP(0); };
        audio.current = a;
      }
      if (playing) { audio.current.pause(); setPlaying(false); return; }
      setPlaying(true);
      audio.current.play().catch(() => setPlaying(false));
      return;
    }
    if (playing) { setPlaying(false); if (timer.current) window.clearInterval(timer.current); return; }
    setPlaying(true);
    const start = Date.now() - p * sec * 1000;
    timer.current = window.setInterval(() => {
      const np = Math.min(1, (Date.now() - start) / (sec * 1000));
      setP(np);
      if (np >= 1) { if (timer.current) window.clearInterval(timer.current); setPlaying(false); setP(0); }
    }, 120);
  };
  const shown = Math.round(playing || p > 0 ? p * sec : sec);
  return (
    <div>
      <div className="voice">
        <button type="button" className={`voice__play${navy ? ' voice__play--navy' : ''}`} aria-label={playing ? t('ya.intro.pause') : label} onClick={toggle} data-testid="voice-play">
          <Icon name={playing ? 'pause' : 'play'} size={18} fill="#fff" sw={0} />
        </button>
        <div className="flex1 stack gap-6">
          <span className="strong" style={{ fontSize: 14 }}>{label}</span>
          <span className="row gap-8"><Waveform bars={30} progress={p} /><span className="small muted" style={{ whiteSpace: 'nowrap' }}>0:{String(shown).padStart(2, '0')}</span></span>
        </div>
      </div>
      {script && (playing || p > 0) && <div className="transcript"><span className="small muted strong">{t('fam.profile.transcript')} · {src ? t('live.playing') : t('fam.profile.playing')}</span><br />{script}</div>}
    </div>
  );
}

export function QuoteCard({ text, who, suffix }: { text: string; who: string; suffix?: string }) {
  const t = useT();
  return <div className="quote"><p>“{text}”</p><small>{quoteWho(t, who)}{suffix ? ` · ${suffix}` : ''}</small></div>;
}

export function HelperFacts({ h }: { h: Helper }) {
  const t = useT();
  return (
    <div className="facts mt-12">
      <Fact icon="briefcase">{t('fam.discover.expFact', { n: h.years })}</Fact>
      <Fact icon="pin">{t(`cities.${h.city}`)}</Fact>
      <Fact icon="peso">{t('fam.discover.rateFact', { amount: peso(h.rate) })}</Fact>
      <Fact icon="home">{t('fam.discover.arrDays', { arr: t(`arr.${h.arrangement}`), days: h.daysOff.map(d => t(`days.${d}`)).join('–') })}</Fact>
    </div>
  );
}

export function householdLine(t: T, k: Household): string {
  const parts = k.size ? [t('ya.family.household', { n: k.size })] : [];
  if (k.kidsAges.length === 1) parts.push(t('ya.family.kidsOne', { ages: kidAges(t, k.kidsAges) }));
  else if (k.kidsAges.length > 1) parts.push(t('ya.family.kidsMany', { ages: kidAges(t, k.kidsAges) }));
  else parts.push(t('ya.family.noKids'));
  parts.push(k.pets.length === 0 ? t('ya.family.noPets') : k.pets.length === 1 ? t('ya.family.petsOne') : t('ya.family.pets', { n: k.pets.length }));
  return parts.join(' · ');
}

export function kidAges(t: T, ages: number[]): string {
  return ages.map(a => (a === 0 ? t('fam.onb.kidBaby') : String(a))).join(', ') + (ages.some(a => a > 0) ? (t.lang === 'tl' ? ' taon' : ' yrs') : '');
}

export function needLine(t: T, k: Household): string {
  return k.needs.map(r => t(`roles.${r}`)).join(' + ');
}

export function scheduleLine(t: T, k: Household): string {
  const arr = t(`yarr.${k.arrangement}`);
  if (k.hours) return `${arr} · ${workDaysLabel(t, k.daysOff)}, ${hoursLabel(k.hours)}`;
  return `${arr} · ${t('ya.families.anyHours')}`;
}

export function HouseholdAvatar({ k, size = 46 }: { k: Household; size?: number }) {
  const palette = ['#1E2559', '#D6344F', '#2A3270', '#7A4E00', '#1E7A55'];
  const bg = palette[parseInt(k.id.replace(/\D/g, '')) % palette.length];
  return <Avatar initials={k.initials} size={size} square bg={bg} />;
}

// ---------- chat messages ----------
const HOW_ICON: Record<PlanHow, string> = { messenger: 'chat', viber: 'phone', phone: 'phone', in_person: 'pin' };

export function MessageView({ m, side, otherName, onShareNumber, onHired }: {
  m: Message; side: 'family' | 'yaya'; otherName: string; onShareNumber?: () => void; onHired?: () => void;
}) {
  const t = useT();
  if (m.kind === 'number') {
    if (m.meta?.mine) return <div className="sys"><Tag tone="white" icon="phone">{t('chat.youShared')}</Tag></div>;
    return (
      <div className="sys-card" style={{ alignSelf: 'flex-start' }}>
        <div className="row gap-8"><Icon name="phone" size={18} /><span className="strong" style={{ fontSize: 14 }}>{t('chat.sharedNumber', { name: String(m.meta?.who ?? otherName) })}</span></div>
        <div className="mt-6" style={{ fontFamily: 'var(--display)', fontSize: 18, fontWeight: 600 }}>{String(m.meta?.number ?? '')}</div>
        {!LIVE && <div className="small muted">{t('chat.demoNumber')}</div>}
      </div>
    );
  }
  if (m.kind === 'plan' || m.kind === 'call') {
    // "Plan a call or meeting": a dated card, nothing to join in the app
    const at = Number(m.meta?.at);
    const how = (PLAN_HOW as readonly string[]).includes(String(m.meta?.how)) ? String(m.meta?.how) as PlanHow : 'phone';
    const note = String(m.meta?.note ?? '');
    const mine = m.from === 'me' || !!m.meta?.mine;
    return (
      <div className="sys-card plan-card row gap-12" data-testid="plan-card">
        <span className="list-row__icon"><Icon name={HOW_ICON[how]} size={20} /></span>
        <div className="flex1">
          <b className="plan-card__when">{t('chat.planSet', { when: dayClock(t, at) })}</b>
          <span className="plan-card__how">{t(`chat.how.${how}`)}{note ? ` · ${note}` : ''}</span>
          <span className="plan-card__by">{mine ? t('chat.planMine') : t('chat.planBy', { name: otherName })}</span>
        </div>
      </div>
    );
  }
  if (m.kind === 'hired') {
    if (side === 'yaya') {
      return (
        <button type="button" className="sys-card sys-card--ok row gap-12" style={{ textAlign: 'left', width: '100%' }} onClick={onHired} data-testid="hired-card">
          <Icon name="check" size={20} sw={2.6} /><span className="flex1 strong" style={{ fontSize: 14 }}>{t('chat.hiredCard', { name: String(m.meta?.who ?? otherName) })}</span><Icon name="next" size={18} />
        </button>
      );
    }
    return <div className="sys"><Tag tone="ok" icon="check">{t('chat.hiredNote', { when: dayClock(t, m.at) })}</Tag></div>;
  }
  if (m.from === 'system') return <div className="sys"><Tag tone="white">{m.text}</Tag></div>;
  return (
    <div className={`bubble bubble--${m.from === 'me' ? 'me' : 'them'}${m.id.startsWith('tmp-') ? ' is-pending' : ''}`}>
      {m.text}<time>{clock(m.at)}</time>
      {onShareNumber && null}
    </div>
  );
}

export function TypingDots({ name }: { name: string }) {
  const t = useT();
  return <div className="typing" aria-label={t('chat.typing', { name })}><i /><i /><i /></div>;
}

export function lastPreview(t: T, c: Chat, them: string): string {
  const m = [...c.messages].reverse().find(x => x.kind === 'text' || !x.kind);
  if (!m) return '';
  return (m.from === 'me' ? t('fam.inbox.you') + ' ' : '') + m.text;
}

// ---------- report ----------
export function ReportSheet({ side, id, name, onClose }: { side: 'family' | 'yaya'; id: string; name: string; onClose: () => void }) {
  const t = useT();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const reasons = ['rInaccurate', 'rInappropriate', 'rUnsafe', 'rFees', 'rOther'];
  if (sent) {
    return (
      <Sheet title={t('chat.reportSent')} onClose={onClose} actions={<Button onClick={onClose}>{t('common.done')}</Button>}>
        <p className="lead">{t('chat.reportSentBody')}</p>
      </Sheet>
    );
  }
  return (
    <Sheet title={t('chat.reportTitle', { name })} onClose={onClose} testId="report-sheet"
      actions={<Button disabled={!reason} testId="report-send" onClick={() => { reportParty(side, id, (reason ?? 'rOther').slice(1).toLowerCase(), note); setSent(true); toast(t('chat.reportSent')); }}>{t('chat.reportSend')}</Button>}>
      <p className="lead" style={{ marginTop: 0 }}>{t('chat.reportBody')}</p>
      <div className="stack gap-8 mt-14" role="radiogroup">
        {reasons.map(r => (
          <button key={r} type="button" role="radio" aria-checked={reason === r ? 'true' : 'false'} className={`id-option${reason === r ? ' is-on' : ''}`} onClick={() => setReason(r)} data-testid={`reason-${r}`}>
            <span className={`radio${reason === r ? ' is-on' : ''}`} /><b className="flex1" style={{ fontWeight: 500 }}>{t(`chat.${r}`)}</b>
          </button>
        ))}
      </div>
      <div className="field mt-14">
        <label className="label" htmlFor="rnote">{t('chat.reportNote')}</label>
        <textarea id="rnote" className="textarea" rows={2} value={note} onChange={e => setNote((e.target as HTMLTextAreaElement).value.slice(0, 500))} data-testid="report-note" />
      </div>
    </Sheet>
  );
}

/** "Plan a call or meeting": day, time and how. Sent as a plan card; the call itself happens outside the app. */
export function PlanSheet({ name, onClose, onSend }: { name: string; onClose: () => void; onSend: (p: PlanInput) => void }) {
  const t = useT();
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(19);
  const [how, setHow] = useState<PlanHow>('phone');
  const [note, setNote] = useState('');
  const days = [0, 1, 2, 3];
  const hours = [10, 13, 17, 19, 20];
  const dayName = (d: number) => {
    if (d === 0) return t('time.today');
    if (d === 1) return t('time.tomorrow');
    const dt = new Date(); dt.setDate(dt.getDate() + d);
    return t.raw<Record<string, string>>('daysLong')[['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dt.getDay()]];
  };
  const at = () => { const d = new Date(); d.setDate(d.getDate() + day); d.setHours(hour, 0, 0, 0); return d.getTime(); };
  return (
    <Sheet title={t('chat.callTitle')} onClose={onClose} testId="plan-sheet"
      actions={<Button icon="calendar" onClick={() => onSend({ at: at(), how, note: note.trim() })} testId="plan-send">{t('chat.callSend')}</Button>}>
      <p className="lead" style={{ marginTop: 0 }}>{t('chat.callBody', { name })}</p>
      <div className="label mt-16">{t('chat.callDay')}</div>
      <div className="chips">{days.map(d => <Chip key={d} small on={day === d} onClick={() => setDay(d)}>{dayName(d)}</Chip>)}</div>
      <div className="label mt-16">{t('chat.callTime')}</div>
      <div className="chips">{hours.map(h => <Chip key={h} small on={hour === h} onClick={() => setHour(h)}>{clock(new Date(2026, 0, 1, h).getTime())}</Chip>)}</div>
      <div className="label mt-16">{t('chat.callHow')}</div>
      <div className="chips">{PLAN_HOW.map(h => <Chip key={h} small on={how === h} onClick={() => setHow(h)} testId={`plan-how-${h}`}>{t(`chat.how.${h}`)}</Chip>)}</div>
      <div className="field mt-16">
        <label className="label" htmlFor="pnote">{t('chat.callNote')}</label>
        <div className="input"><input id="pnote" value={note} placeholder={t('chat.callNotePh')} onChange={e => setNote((e.target as HTMLInputElement).value.slice(0, 120))} data-testid="plan-note" /></div>
      </div>
      <Note className="mt-16" tone="warn" icon="alert">{t('chat.callSafety')}</Note>
    </Sheet>
  );
}

/** Share-number pre-check: the yaya ticks all three before sharing. Live asks for the private number once. */
export function ShareSheet({ name, needPhone, phone, onClose, onShare }: { name: string; needPhone: boolean; phone: string; onClose: () => void; onShare: (phone: string) => void }) {
  const t = useT();
  const [ticks, setTicks] = useState([false, false, false]);
  const [num, setNum] = useState(phone.replace(/\D/g, '').slice(-10));
  const [err, setErr] = useState(false);
  const all = ticks.every(Boolean);
  const share = () => {
    if (needPhone && !/^9\d{9}$/.test(num)) { setErr(true); return; }
    onShare(num);
  };
  return (
    <Sheet title={t('chat.shareTitle', { name })} onClose={onClose} testId="share-sheet"
      actions={<><Button onClick={share} disabled={!all} testId="share-confirm">{t('chat.shareConfirm')}</Button><Button kind="ghost" onClick={onClose}>{t('chat.notNow')}</Button></>}>
      <p className="lead" style={{ marginTop: 0 }}>{t('chat.shareBody')}</p>
      <div className="label mt-16">{t('chat.preTitle')}</div>
      <div className="mt-6">
        {(['pre1', 'pre2', 'pre3'] as const).map((k, i) => (
          <button key={k} type="button" role="checkbox" aria-checked={ticks[i] ? 'true' : 'false'} className="pre-item" data-testid={`pre-${i + 1}`}
            onClick={() => setTicks(ticks.map((v, j) => (j === i ? !v : v)))}>
            <span className="checkbox" aria-checked={ticks[i] ? 'true' : 'false'}>{ticks[i] && <Icon name="check" size={15} sw={3} />}</span>
            <span className="flex1">{t(`chat.${k}`)}</span>
          </button>
        ))}
      </div>
      {needPhone && (
        <div className="field mt-14">
          <label className="label" htmlFor="sphone">{t('chat.sharePhone')}</label>
          <div className={`input${err ? ' is-error' : ''}`}>
            <span className="input__prefix">+63</span>
            <input id="sphone" inputMode="numeric" value={num} maxLength={10} onChange={e => { setNum((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 10)); setErr(false); }} data-testid="share-phone" />
          </div>
          {err ? <div className="error" role="alert">{t('chat.sharePhoneBad')}</div> : <div className="hint">{t('chat.sharePhoneHint')}</div>}
        </div>
      )}
      <Note className="mt-14" tone="info" icon="lock">{t('chat.shareL1')}</Note>
    </Sheet>
  );
}

/** Shown instead of the composer until your own ID (or household ID) check has passed. */
export function IdGate({ side, status, onStart }: { side: 'family' | 'yaya'; status: string; onStart: () => void }) {
  const t = useT();
  const waiting = status === 'review' || status === 'pending';
  const failed = status === 'failed';
  const title = waiting ? t('chat.gateWaitT') : failed ? t('chat.gateFailT') : side === 'family' ? t('chat.gateFamT') : t('chat.gateYayaT');
  const sub = waiting ? t('chat.gateWaitS') : side === 'family' ? t('chat.gateFamS') : t('chat.gateYayaS');
  return (
    <div className="idgate" data-testid="id-gate">
      <span className="list-row__icon"><Icon name={waiting ? 'clock' : 'id'} size={20} /></span>
      <div className="flex1"><b>{title}</b><small>{sub}</small></div>
      {!waiting && <Button size="md" block={false} onClick={onStart} testId="id-gate-start">{failed ? t('chat.gateRetry') : side === 'family' ? t('chat.gateFamCta') : t('chat.gateYayaCta')}</Button>}
    </div>
  );
}

export function PhotoOf({ h, className = '' }: { h: Helper; className?: string }) {
  return <img className={className} src={asset(h.photo)} alt={`${helperName(h)}`} />;
}

export { daysLabel, pesoRange };
