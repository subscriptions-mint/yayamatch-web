import { useEffect, useRef, useState } from 'react';
import { useT, minWageLine, peso, monthLabel } from '../../lib/i18n';
import { useStore, useUi, setUi, toast } from '../../lib/store';
import { nav } from '../../lib/router';
import {
  Screen, TopBar, Progress, Footer, Button, Tile, Chip, Field, CitySearch, Note, Segmented, DayPicker, Sheet, ValueRow, Tag, Icon, Stepper, Card, Avatar, Fact, LangToggle, Waveform, readImage, asset,
} from '../../components/ui';

import { patchYaya, setPhone, applyBiodata, startManualYaya, finishYayaOnboarding, readBiodataPhoto, setYayaPhoto, setYayaVoice } from '../../lib/actions';
import { ROLES, ROLE_ICON, SKILLS, SKILL_ICON, CARED_FOR, COUNTRIES, START, MIN_HELPER_AGE, WORK_START_AGE, RATE_MAX, RATE_STEP, type Role, type City } from '../../data/constants';
import { LIVE, SEEDS_ON } from '../../lib/config';
import { isValidPhone } from '../shared/Shared';
import { formatPhone } from '../family/FamilyOnboarding';
import { rateFloor, yayaStrength } from '../../lib/match';
import { useIsDesktop } from '../../lib/useIsDesktop';
import { SlimHeader, BrandPanel } from '../../components/desktop';

const TOTAL = 6;

function useYayaStep(next: string) {
  const editing = useUi(s => s.editing);
  const t = useT();
  return { editing, go: () => { if (editing) { setUi({ editing: false }); nav('y-me'); toast(t('fam.onb.saved')); } else nav(next); } };
}

// Desktop split layout (pattern A): slim header and brand panel for every set-up step.
function useStepDesk(back: string) {
  const editing = useUi(s => s.editing);
  const to = editing ? 'y-me' : back;
  return { to, nav: <SlimHeader back={to || undefined} />, brand: <BrandPanel side="yaya" kind="onb" /> };
}

function StepHeader({ n, back }: { n: number; back: string }) {
  const t = useT();
  const editing = useUi(s => s.editing);
  return <><TopBar back={editing ? 'y-me' : back || undefined} />{!editing && <Progress n={n} total={TOTAL} label={t('ya.stepOf', { n, total: TOTAL })} />}</>;
}

export function YayaWelcome() {
  const t = useT();
  const saved = useStore(s => s.yaya.phone);
  const [phone, setP] = useState(saved || '9177654321');
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    const p = phone.replace(/\D/g, '');
    if (!isValidPhone(p)) { setErr(t('auth.phoneInvalid')); return; }
    setPhone('yaya', p);
    nav('y-otp');
  };
  return (
    <Screen tone="blush" side="yaya" header={<TopBar back="welcome" right={<LangToggle />} />} nav={<SlimHeader back="welcome" />} brand={<BrandPanel side="yaya" kind="auth" />}
      footer={<Footer back="welcome"><Button onClick={submit} testId="send-code">{t('auth.sendCode')}</Button></Footer>}>
      <div className="pad">
        <Tag tone="white" icon="briefcase">{t('ya.welcome.kicker')}</Tag>
        <h1 className="h1 h1--xl mt-12" style={{ fontSize: 30 }}>{t('ya.welcome.title')}</h1>
        <div className="stack gap-16 mt-22 auth-values">
          <ValueRow icon="peso" title={t('ya.welcome.p1t')} sub={t('ya.welcome.p1s')} />
          <ValueRow icon="hand" title={t('ya.welcome.p2t')} sub={t('ya.welcome.p2s')} />
          <ValueRow icon="lock" title={t('ya.welcome.p3t')} sub={t('ya.welcome.p3s')} />
        </div>
        <div className="mt-24">
          <Field label={t('auth.mobile')} value={formatPhone(phone)} prefix="+63" inputMode="numeric" maxLength={12} testId="phone"
            onChange={v => { setP(v.replace(/\D/g, '').slice(0, 10)); setErr(null); }} onEnter={submit} error={err} hint={t('ya.welcome.hint')} />
        </div>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function YayaBiodata() {
  const t = useT();
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [scanning, setScanning] = useState(false);
  const d = useStepDesk(LIVE ? '' : 'welcome');
  // The demo simulates the scan. Live sends the photo to biodata-read; the yaya checks every answer next.
  const scan = (file?: File) => {
    setScanning(true);
    if (LIVE && file) {
      void readBiodataPhoto(file).then(ok => {
        setScanning(false);
        if (ok) { toast(t('ya.biodata.readDone'), { tone: 'ok' }); nav('y-about'); } else toast(t('live.readFail'), { ms: 5000 });
      });
      return;
    }
    window.setTimeout(() => { applyBiodata(); setScanning(false); toast(t('ya.biodata.readDone'), { tone: 'ok' }); nav('y-about'); }, LIVE ? 300 : 2400);
  };
  const showSample = !LIVE || SEEDS_ON;
  const paper = (
    <div className="scan" aria-hidden="true">
      <div className="scan__paper">
        <div className="row gap-8"><div style={{ width: 30, height: 36, borderRadius: 4, background: 'var(--blush-deep)' }} /><div className="flex1 stack gap-4" style={{ paddingTop: 2 }}>
          <div className="l" style={{ background: 'var(--navy)', width: '80%', height: 6 }} /><div className="l" /><div className="l" style={{ width: '70%' }} /></div></div>
        <div className="stack gap-4 mt-10"><div className="l" /><div className="l" style={{ width: '85%' }} /><div className="l" style={{ width: '60%' }} /></div>
      </div>
      <div className="scan__frame" />
      {scanning && <div className="scan__line" />}
    </div>
  );
  return (
    <Screen tone="blush" side="yaya" header={<StepHeader n={1} back={LIVE ? '' : 'welcome'} />} nav={d.nav} brand={d.brand}
      footer={<Footer back={d.to || undefined}>
        {mode === 'scan' ? <>
          <label className={`btn btn--primary btn--block file-btn${scanning ? ' is-busy' : ''}`} aria-disabled={scanning ? 'true' : 'false'}>
            <Icon name="camera" size={20} /><span>{scanning ? t('ya.biodata.reading') : t('ya.biodata.take')}</span>
            {!scanning && <input type="file" accept="image/*" capture="environment" aria-label={t('ya.biodata.take')} data-testid="biodata-file" onChange={e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) scan(f); }} />}
          </label>
          {showSample && <Button kind="text" disabled={scanning} onClick={() => scan()} testId="biodata-sample">{t('ya.biodata.sample')}</Button>}
        </> : <Button onClick={() => { startManualYaya(); nav('y-about'); }} iconRight="next" testId="biodata-manual-go">{t('ya.biodata.continue')}</Button>}
      </Footer>}>
      <div className="pad mt-18">
        <h1 className="h1">{t('ya.biodata.title')}</h1>
        <p className="lead">{t('ya.biodata.body')}</p>
        <div className="mt-18">
          <button type="button" className={`plan${mode === 'scan' ? ' is-on' : ''}`} style={{ marginTop: 0, borderRadius: 24 }} aria-pressed={mode === 'scan' ? 'true' : 'false'} onClick={() => setMode('scan')}>
            <span className="row gap-12"><span className="tile__icon" style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--coral-deep)', color: '#fff' }}><Icon name="camera" size={24} /></span>
              <span className="flex1"><b className="h3" style={{ display: 'block' }}>{t('ya.biodata.scanT')}</b><span className="small muted" style={{ fontSize: 13.5 }}>{t('ya.biodata.scanS')}</span></span></span>
            {paper}
          </button>
          <button type="button" className={`plan${mode === 'manual' ? ' is-on' : ''}`} style={{ borderRadius: 24 }} aria-pressed={mode === 'manual' ? 'true' : 'false'} onClick={() => setMode('manual')} data-testid="biodata-manual">
            <span className="row gap-12"><span className="tile__icon" style={{ width: 48, height: 48, borderRadius: 14 }}><Icon name="pencil" size={22} /></span>
              <span className="flex1"><b className="h3" style={{ display: 'block' }}>{t('ya.biodata.manualT')}</b><span className="small muted" style={{ fontSize: 13.5 }}>{t('ya.biodata.manualS')}</span></span></span>
          </button>
        </div>
        <Note className="mt-14" icon="lock">{t('ya.biodata.privacy')}</Note>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function YayaAbout() {
  const t = useT();
  const y = useStore(s => s.yaya);
  const [err, setErr] = useState<string | null>(null);
  const { editing, go } = useYayaStep('y-work');
  const d = useStepDesk('y-biodata');
  const submit = () => {
    if (!y.name.trim()) { setErr('name'); return; }
    if (!y.homeCity) { setErr('city'); return; }
    go();
  };
  return (
    <Screen tone="blush" side="yaya" header={<StepHeader n={2} back="y-biodata" />} nav={d.nav} brand={d.brand}
      footer={<Footer back={d.to}><Button onClick={submit} iconRight={editing ? undefined : 'next'} testId="next">{editing ? t('fam.onb.saveChanges') : t('common.next')}</Button></Footer>}>
      <div className="pad mt-18">
        <h1 className="h1">{t('ya.about.title')}</h1>
        {y.fromBiodata && !editing && <div className="mt-8"><Tag tone="white" icon="check">{t('ya.work.fromBiodata')}</Tag></div>}
        <div className="mt-18"><Field label={t('ya.about.name')} value={y.name} testId="yaya-name" onChange={v => { patchYaya({ name: v.replace(/[^\p{L}\s'-]/gu, '').slice(0, 24) }); setErr(null); }} error={err === 'name' ? t('ya.about.nameReq') : null} /></div>
        <div className="label mt-18">{t('ya.about.age')}</div>
        <Card className="mt-10" style={{ padding: '2px 14px' }}>
          <Stepper label={t('ya.about.ageValue', { n: y.age })} value={String(y.age)} onDec={() => patchYaya({ age: Math.max(MIN_HELPER_AGE, y.age - 1) })} onInc={() => patchYaya({ age: Math.min(70, y.age + 1) })} decDisabled={y.age <= MIN_HELPER_AGE} />
        </Card>
        <div className="hint mt-8">{t('ya.about.ageHint')}</div>
        <div className="mt-18"><CitySearch label={t('ya.about.home')} value={y.homeCity} onChange={c => { patchYaya({ homeCity: c, workCities: y.workCities.length ? y.workCities : [c] }); setErr(null); }} testId="home-city" /></div>
        {err === 'city' ? <div className="error" role="alert">{t('ya.about.homeReq')}</div> : <Note className="mt-10" icon="lock" tone="white">{t('ya.about.cityPrivacy')}</Note>}
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function YayaWork() {
  const t = useT();
  const y = useStore(s => s.yaya);
  const [err, setErr] = useState(false);
  const { editing, go } = useYayaStep('y-skills');
  const d = useStepDesk('y-about');
  const cap = Math.max(0, y.age - WORK_START_AGE);
  const toggle = (r: Role) => {
    setErr(false);
    const on = y.roles.includes(r);
    const roles = on ? y.roles.filter(x => x !== r) : [...y.roles, r];
    const yb = { ...y.yearsByRole };
    if (!on && yb[r] == null) yb[r] = 1;
    patchYaya({ roles, yearsByRole: yb });
  };
  const setYears = (r: Role, n: number) => patchYaya({ yearsByRole: { ...y.yearsByRole, [r]: Math.max(0, Math.min(cap, n)) } });
  return (
    <Screen tone="blush" side="yaya" header={<StepHeader n={3} back="y-about" />} nav={d.nav} brand={d.brand}
      footer={<Footer back={d.to}><Button onClick={() => { if (!y.roles.length) { setErr(true); return; } go(); }} iconRight={editing ? undefined : 'next'} testId="next">{editing ? t('fam.onb.saveChanges') : t('common.next')}</Button></Footer>}>
      <div className="pad mt-16">
        <h1 className="h1">{t('ya.work.title')}</h1>
        {y.fromBiodata && !editing && <div className="mt-8"><Tag tone="white" icon="check">{t('ya.work.fromBiodata')}</Tag></div>}
        <div className="tiles mt-14" style={{ gap: 10 }}>
          {ROLES.map(r => { const [a, b] = t.raw<string[]>(`yayaRoleTile.${r}`); return <Tile key={r} icon={ROLE_ICON[r]} title={a} sub={b} on={y.roles.includes(r)} onClick={() => toggle(r)} testId={`role-${r}`} />; })}
        </div>
        {err && <div className="error" role="alert">{t('ya.work.rolesReq')}</div>}
        {y.roles.length > 0 && <>
          <div className="label mt-18">{t('ya.work.yearsQ')}</div>
          <Card className="mt-10" style={{ padding: '2px 14px' }}>
            {y.roles.map(r => (
              <Stepper key={r} label={t(`roles.${r}`)} value={t('common.yrs', { n: y.yearsByRole[r] ?? 0 })}
                onDec={() => setYears(r, (y.yearsByRole[r] ?? 0) - 1)} onInc={() => setYears(r, (y.yearsByRole[r] ?? 0) + 1)}
                decDisabled={(y.yearsByRole[r] ?? 0) <= 0} incDisabled={(y.yearsByRole[r] ?? 0) >= cap} />
            ))}
          </Card>
          <div className="hint mt-8">{t('ya.work.yearsCap', { n: cap })}</div>
        </>}
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function YayaSkills() {
  const t = useT();
  const y = useStore(s => s.yaya);
  const [err, setErr] = useState(false);
  const { editing, go } = useYayaStep('y-looking');
  const d = useStepDesk('y-work');
  const tog = <K extends string>(arr: K[], v: K) => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  return (
    <Screen tone="blush" side="yaya" header={<StepHeader n={4} back="y-work" />} nav={d.nav} brand={d.brand}
      footer={<Footer back={d.to}><Button onClick={() => { if (!y.skills.length) { setErr(true); return; } go(); }} iconRight={editing ? undefined : 'next'} testId="next">{editing ? t('fam.onb.saveChanges') : t('common.next')}</Button></Footer>}>
      <div className="pad mt-16">
        <h1 className="h1">{t('ya.skills.title')}</h1>
        <p className="lead">{t('ya.skills.body')}</p>
        <div className="chips mt-12">{SKILLS.map(s => <Chip key={s} icon={SKILL_ICON[s]} on={y.skills.includes(s)} onClick={() => { patchYaya({ skills: tog(y.skills, s) }); setErr(false); }} testId={`skill-${s}`}>{t(`skills.${s}`)}</Chip>)}</div>
        {err && <div className="error" role="alert">{t('ya.skills.skillsReq')}</div>}
        <div className="label mt-18">{t('ya.skills.caredFor')}</div>
        <div className="chips">{CARED_FOR.map(c => <Chip key={c} on={y.caredFor.includes(c)} onClick={() => patchYaya({ caredFor: tog(y.caredFor, c) })}>{t(`caredFor.${c}`)}</Chip>)}</div>
        <div className="label mt-18">{t('ya.skills.abroadQ')}</div>
        <Segmented label={t('ya.skills.abroadQ')} value={y.abroad ? 'yes' : 'no'} onChange={v => patchYaya({ abroad: v === 'yes', countries: v === 'yes' ? y.countries : [] })}
          options={[{ v: 'no', label: t('ya.skills.abroadNo') }, { v: 'yes', label: t('ya.skills.abroadYes') }]} />
        {y.abroad && <>
          <div className="label mt-14">{t('ya.skills.countries')}</div>
          <div className="chips">{COUNTRIES.map(c => <Chip key={c} small on={y.countries.includes(c)} onClick={() => patchYaya({ countries: tog(y.countries, c) })}>{t(`countries.${c}`)}</Chip>)}</div>
        </>}
        <div className="label mt-18">{t('ya.skills.langs')}</div>
        <div className="chips">{(['tagalog', 'english', 'bisaya', 'ilocano', 'hiligaynon'] as const).map(l => <Chip key={l} on={y.langs.includes(l)} onClick={() => patchYaya({ langs: tog(y.langs, l) })}>{t(`langs.${l}`)}</Chip>)}</div>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function YayaLooking() {
  const t = useT();
  const y = useStore(s => s.yaya);
  const [err, setErr] = useState<string | null>(null);
  const [addCity, setAddCity] = useState(false);
  const { editing, go } = useYayaStep('y-intro');
  const d = useStepDesk('y-skills');
  const floor = rateFloor(y);
  useEffect(() => { if (y.rate < floor) patchYaya({ rate: Math.ceil(floor / RATE_STEP) * RATE_STEP }); }, [floor]);
  const setRate = (r: number) => {
    if (r < floor) { patchYaya({ rate: floor }); toast(t('ya.looking.belowMin', { amount: peso(floor) })); return; }
    patchYaya({ rate: Math.min(RATE_MAX, r) });
  };
  const submit = () => {
    if (!y.daysOff.length) { setErr('days'); return; }
    if (!y.workCities.length) { setErr('cities'); return; }
    go();
  };
  return (
    <Screen tone="blush" side="yaya" header={<StepHeader n={5} back="y-skills" />} nav={d.nav} brand={d.brand}
      footer={<Footer back={d.to}><Button onClick={submit} iconRight={editing ? undefined : 'next'} testId="next">{editing ? t('fam.onb.saveChanges') : t('common.next')}</Button></Footer>}
      overlay={addCity && (
        <Sheet title={t('ya.looking.addCityTitle')} onClose={() => setAddCity(false)}>
          <CitySearch label={t('fam.onb.city')} value={null} onChange={(c: City) => { if (!y.workCities.includes(c)) patchYaya({ workCities: [...y.workCities, c] }); setAddCity(false); setErr(null); }} />
        </Sheet>
      )}>
      <div className="pad mt-14">
        <h1 className="h1">{t('ya.looking.title')}</h1>
        <div className="label mt-14">{t('ya.looking.rate')}</div>
        <div className="money">
          <button type="button" className="stepper__btn" aria-label={t('ya.looking.less')} onClick={() => setRate(y.rate - RATE_STEP)} data-testid="rate-less"><Icon name="minus" size={22} /></button>
          <div className="money__val" aria-live="polite"><b data-testid="rate">{peso(y.rate)}</b><span>{t('ya.looking.perMonth')}</span></div>
          <button type="button" className="stepper__btn" aria-label={t('ya.looking.more')} onClick={() => setRate(y.rate + RATE_STEP)}><Icon name="plus" size={22} /></button>
        </div>
        <Note className="mt-8">{y.homeCity ? minWageLine(t, y.homeCity, 'ya.looking.minWage') : ''}</Note>
        <div className="label mt-14">{t('ya.looking.arrQ')}</div>
        <Segmented label={t('ya.looking.arrQ')} value={y.arrangement} onChange={v => patchYaya({ arrangement: v })} options={[{ v: 'livein', label: t('yarr.livein') }, { v: 'liveout', label: t('yarr.liveout') }]} />
        <div className="label mt-14">{t('ya.looking.dayOff')}</div>
        <DayPicker label={t('ya.looking.dayOff')} value={y.daysOff} onChange={v => { patchYaya({ daysOff: v as typeof y.daysOff }); setErr(null); }} />
        {err === 'days' && <div className="error" role="alert">{t('ya.looking.dayOffReq')}</div>}
        <div className="label mt-14">{t('ya.looking.where')}</div>
        <div className="chips" style={{ gap: 6 }}>
          {y.workCities.map(c => <Chip key={c} on onClick={() => patchYaya({ workCities: y.workCities.filter(x => x !== c) })}>{t(`cities.${c}`)}</Chip>)}
          <Chip add icon="plus" onClick={() => setAddCity(true)}>{t('ya.looking.addCity')}</Chip>
        </div>
        {err === 'cities' && <div className="error" role="alert">{t('ya.looking.citiesReq')}</div>}
        <div className="label mt-14">{t('ya.looking.start')}</div>
        <div className="chips" style={{ gap: 6 }}>{START.map(s => <Chip key={s} on={y.startIn === s} onClick={() => patchYaya({ startIn: s })}>{t(`startOpt.${s}`)}</Chip>)}</div>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

// in-memory recording (not saved between visits)
let voiceUrl: string | null = null;

function VoiceRecorder() {
  const t = useT();
  const sec = useStore(s => s.yaya.voiceSec);
  const [rec, setRec] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [simulated, setSimulated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [p, setP] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<number | null>(null);
  const started = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { if (tick.current) window.clearInterval(tick.current); mr.current?.stream.getTracks().forEach(tr => tr.stop()); }, []);
  const stop = () => {
    if (tick.current) window.clearInterval(tick.current);
    const s = Math.max(3, Math.round((Date.now() - started.current) / 1000));
    setRec(false);
    if (mr.current && mr.current.state !== 'inactive') mr.current.stop(); else void setYayaVoice(null, Math.min(30, s));
  };
  const start = async () => {
    setElapsed(0);
    started.current = Date.now();
    const begin = () => {
      setRec(true);
      tick.current = window.setInterval(() => {
        const e = Math.round((Date.now() - started.current) / 1000);
        setElapsed(e);
        if (e >= 30) stop();
      }, 250);
    };
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('no mic');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream);
      chunks.current = [];
      m.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      m.onstop = () => {
        stream.getTracks().forEach(tr => tr.stop());
        if (voiceUrl) URL.revokeObjectURL(voiceUrl);
        const blob = new Blob(chunks.current, { type: m.mimeType || 'audio/webm' });
        voiceUrl = URL.createObjectURL(blob);
        void setYayaVoice(blob, Math.min(30, Math.max(1, Math.round((Date.now() - started.current) / 1000))));
      };
      mr.current = m;
      m.start();
      setSimulated(false);
      started.current = Date.now();
      begin();
    } catch {
      mr.current = null;
      setSimulated(true);
      begin();
    }
  };
  const play = () => {
    if (!sec) return;
    if (playing) { audio.current?.pause(); setPlaying(false); return; }
    setPlaying(true);
    if (voiceUrl) {
      const a = new Audio(voiceUrl);
      audio.current = a;
      a.ontimeupdate = () => setP(a.duration ? a.currentTime / a.duration : 0);
      a.onended = () => { setPlaying(false); setP(0); };
      a.play().catch(() => setPlaying(false));
    } else {
      const s0 = Date.now();
      const id = window.setInterval(() => {
        const np = (Date.now() - s0) / (sec * 1000);
        setP(Math.min(1, np));
        if (np >= 1) { window.clearInterval(id); setPlaying(false); setP(0); }
      }, 120);
    }
  };
  return (
    <Card className="mt-18">
      <div className="h3" style={{ fontSize: 16.5 }}>{t('ya.intro.voiceTitle')}</div>
      <p className="small muted mt-4" style={{ fontSize: 13.5, lineHeight: 1.45 }}>{t('ya.intro.voiceBody')}</p>
      <div className="row gap-12 mt-14" style={{ padding: '10px 12px', borderRadius: 16, background: 'var(--cream)' }}>
        {rec ? (
          <button type="button" className="voice__play" aria-label={t('ya.intro.stop')} onClick={stop} data-testid="voice-stop"><Icon name="stop" size={18} fill="#fff" sw={0} /></button>
        ) : sec ? (
          <button type="button" className="voice__play voice__play--navy" aria-label={playing ? t('ya.intro.pause') : t('ya.intro.play')} onClick={play}><Icon name={playing ? 'pause' : 'play'} size={18} fill="#fff" sw={0} /></button>
        ) : (
          <button type="button" className="voice__play" aria-label={t('ya.intro.record')} onClick={start} data-testid="voice-record"><Icon name="mic" size={20} /></button>
        )}
        <Waveform bars={26} progress={rec ? 1 : p} recording={rec} />
        <span className="strong" style={{ fontSize: 13, whiteSpace: 'nowrap' }} aria-live="polite">
          {rec ? t('ya.intro.recording', { s: elapsed }) : sec ? `0:${String(sec).padStart(2, '0')}` : '0:30'}
        </span>
      </div>
      {!rec && !sec && <p className="small muted mt-10">{t('ya.intro.suggest')}</p>}
      {sec && !rec ? (
        <div className="row gap-10 mt-12">
          <Button kind="ghost" size="md" icon="mic" onClick={start}>{t('ya.intro.redo')}</Button>
          <Button kind="ok" size="md" icon="check" onClick={() => toast(t('ya.intro.saved'))}>{t('ya.intro.saved')}</Button>
        </div>
      ) : null}
      {simulated && <p className="small muted mt-10">{t('ya.intro.simulated')}</p>}
    </Card>
  );
}

export function YayaIntro() {
  const t = useT();
  const y = useStore(s => s.yaya);
  const editing = useUi(s => s.editing);
  const [err, setErr] = useState(false);
  const d = useStepDesk('y-looking');
  const submit = () => {
    if (!y.voiceSec && y.bio.trim().length < 10) { setErr(true); return; }
    if (editing) { setUi({ editing: false }); nav('y-me'); toast(t('fam.onb.saved')); return; }
    finishYayaOnboarding();
    nav('y-idcheck');
  };
  return (
    <Screen tone="blush" side="yaya" header={<StepHeader n={6} back="y-looking" />} nav={d.nav} brand={d.brand}
      footer={<Footer back={d.to}><Button onClick={submit} testId="finish-profile">{editing ? t('fam.onb.saveChanges') : t('ya.intro.finish')}</Button></Footer>}>
      <div className="pad mt-14">
        <h1 className="h1">{t('ya.intro.title')}</h1>
        <div className="row gap-16 mt-16">
          <div className="photo-edit">
            {y.photo ? <Avatar src={y.photo} size={104} ring="#fff" /> : <Avatar initials={(y.name || '?').slice(0, 1)} size={104} ring="#fff" bg="var(--coral-deep)" />}
            <label aria-label={t('ya.intro.changePhoto')} title={t('ya.intro.changePhoto')}>
              <Icon name="camera" size={18} />
              <input className="sr-only" type="file" accept="image/*" onChange={async e => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                if (await setYayaPhoto(file, f => readImage(f))) toast(t('ya.intro.photoSaved'));
                else if (LIVE) toast(t('live.err.photo'));
              }} data-testid="photo-file" />
            </label>
          </div>
          <div className="stack gap-8">{['t1', 't2', 't3'].map(k => <span key={k} className="row gap-8" style={{ fontSize: 14.5 }}><span style={{ color: 'var(--ok)' }}><Icon name="check" size={18} sw={2.6} /></span>{t(`ya.intro.${k}`)}</span>)}</div>
        </div>
        <VoiceRecorder />
        <div className="field mt-14">
          <label className="label" htmlFor="ybio">{t('ya.intro.writeLabel')}</label>
          <textarea id="ybio" className="textarea" rows={3} value={y.bio} placeholder={t('ya.intro.writePh')} onChange={e => { patchYaya({ bio: (e.target as HTMLTextAreaElement).value.slice(0, 300) }); setErr(false); }} data-testid="bio" />
        </div>
        {err && <div className="error" role="alert">{t('ya.intro.needOne')}</div>}
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export { YayaIdCheck } from '../shared/IdCheck';

export function YayaReady() {
  const t = useT();
  const y = useStore(s => s.yaya);
  const strength = yayaStrength(y);
  const exp = Object.values(y.yearsByRole).reduce((a, b) => Math.max(a ?? 0, b ?? 0), 0) ?? 0;
  const desk = useIsDesktop();
  const preview = (
    <div className="pcard mt-12" style={{ cursor: 'default' }}>
      <div className="pcard__photo" style={{ height: desk ? 240 : 176 }}>{y.photo ? <img src={asset(y.photo)} alt="" /> : null}</div>
      <div className="pcard__body">
        <div className="pcard__name">{y.name || '—'}, {y.age}</div>
        <div className="small muted" style={{ fontSize: 14 }}>{y.roles.map(r => t(`roles.${r}`)).join(' · ')}</div>
        <div className="facts mt-10">
          <Fact icon="briefcase">{t('common.yrs', { n: exp })}</Fact>
          <Fact icon="pin">{y.homeCity ? t(`cities.${y.homeCity}`) : '—'}</Fact>
          <Fact icon="peso">{peso(y.rate)} {t('common.perMonthShort')}</Fact>
          <Fact icon="home">{t(`yarr.${y.arrangement}`)}</Fact>
        </div>
        <div className="tags mt-12">
          {y.idCheck && <Tag tone="ok" icon="check">{t('ya.chats.idTag', { month: monthLabel(t, y.idCheck.month) })}</Tag>}
          {y.voiceSec && <Tag icon="mic">{t('ya.ready.voiceTag', { s: `0:${String(y.voiceSec).padStart(2, '0')}` })}</Tag>}
          {y.nbi && <Tag tone="warn" icon="clock">{t('ya.ready.nbiPending')}</Tag>}
        </div>
      </div>
    </div>
  );
  const extras = <>
    {!y.idCheck && (
      <button type="button" className="banner mt-12" style={{ background: '#fff' }} onClick={() => nav('y-idcheck')}>
        <span className="list-row__icon"><Icon name="id" size={20} /></span><span className="flex1"><strong style={{ fontWeight: 600 }}>{t('ya.ready.addId')}</strong><br /><span className="muted">{t('ya.ready.addIdS')}</span></span><Icon name="next" size={20} />
      </button>
    )}
    {!y.nbi && !LIVE && (
      <label className="banner mt-12 file-btn" style={{ background: '#fff', cursor: 'pointer' }}>
        <span className="list-row__icon"><Icon name="file" size={20} /></span><span className="flex1"><strong style={{ fontWeight: 600 }}>{t('ya.ready.addNbi')}</strong><br /><span className="muted">{t('ya.ready.addNbiS')}</span></span><Icon name="next" size={20} />
        <input type="file" accept="image/*,application/pdf" aria-label={t('ya.ready.addNbi')} onChange={() => { patchYaya({ nbi: true }); toast(t('ya.ready.nbiAdded')); }} />
      </label>
    )}
  </>;
  if (desk) {
    // Pattern I, wide: the strength meter beside the profile preview.
    return (
      <Screen tone="blush" side="yaya" nav={<SlimHeader back="y-idcheck" />} desk="center">
        <div className="dcenter">
          <div className="dcard dcard--wide dready">
            <div className="dready__main">
              <span className="success__icon" style={{ width: 56, height: 56 }}><Icon name="check" size={30} sw={2.6} /></span>
              <h1 className="h1 mt-16">{t('ya.ready.title')}</h1>
              <div className="row mt-20" style={{ justifyContent: 'space-between' }}><span className="strong">{t('ya.ready.strength')}</span><span className="strong" style={{ color: 'var(--ok)' }}>{strength}%</span></div>
              <div className="bar mt-8" style={{ background: '#F1E1E5' }}><i style={{ width: `${strength}%` }} /></div>
              <div className="dready__extras">{extras}</div>
              <div className="dactions dactions--left"><Button block={false} iconRight="next" onClick={() => nav('y-families')} testId="see-families">{t('ya.ready.seeFamilies')}</Button></div>
            </div>
            <div className="dready__preview">
              <div className="label">{t('ya.ready.preview')}</div>
              {preview}
            </div>
          </div>
        </div>
      </Screen>
    );
  }
  return (
    <Screen tone="blush" side="yaya" header={<TopBar back="y-idcheck" />}
      footer={<Footer><Button onClick={() => nav('y-families')} testId="see-families">{t('ya.ready.seeFamilies')}</Button></Footer>}>
      <div className="pad">
        <div className="row gap-12"><span className="success__icon" style={{ width: 48, height: 48 }}><Icon name="check" size={26} sw={2.6} /></span><h1 className="h1 h1--sm flex1">{t('ya.ready.title')}</h1></div>
        <div className="row mt-16" style={{ justifyContent: 'space-between' }}><span className="strong" style={{ fontSize: 14 }}>{t('ya.ready.strength')}</span><span className="strong" style={{ fontSize: 14, color: 'var(--ok)' }}>{strength}%</span></div>
        <div className="bar mt-8"><i style={{ width: `${strength}%` }} /></div>
        <div className="label mt-18">{t('ya.ready.preview')}</div>
        {preview}
        {extras}
        <div className="spacer" />
      </div>
    </Screen>
  );
}
