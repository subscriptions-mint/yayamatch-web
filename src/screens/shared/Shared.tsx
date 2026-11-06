import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useT, monthLabel, pesoRange } from '../../lib/i18n';
import { useStore, getState, toast, getUi, setUi } from '../../lib/store';
import { nav } from '../../lib/router';
import { Screen, Icon, LangToggle, Sheet, Button, TopBar, Note, Footer, Tag, Field, Avatar, asset } from '../../components/ui';
import { HouseholdAvatar } from '../../components/domain';
import { helperName } from '../../lib/match';
import { HELPERS } from '../../data/helpers';
import { HOUSEHOLDS } from '../../data/households';
import { enterSide, verifyPhone, chooseSide, sendSignInCode, verifySignInCode, signInSample, signInTestAccount, signInWith, logout, settle } from '../../lib/actions';
import { DEMO_OTP } from '../../data/constants';
import { LIVE, SEEDS_ON } from '../../lib/config';
import type { Side } from '../../lib/types';
import { useIsDesktop } from '../../lib/useIsDesktop';
import { SlimHeader, BrandPanel } from '../../components/desktop';

export function Welcome() {
  if (LIVE) return <LiveWelcome />;
  return <DemoWelcome />;
}

function DemoWelcome() {
  const t = useT();
  const [login, setLogin] = useState(false);
  const goFamily = () => {
    enterSide('family');
    const f = getState().family;
    nav(f.verified ? (f.onboarded ? 'f-discover' : 'f-needs') : 'f-account');
  };
  const goYaya = () => {
    enterSide('yaya');
    const y = getState().yaya;
    nav(y.verified ? (y.onboarded ? 'y-families' : 'y-biodata') : 'y-welcome');
  };
  const desk = useIsDesktop();
  const loginSheet = login && (
    <Sheet title={t('welcome.loginTitle')} onClose={() => setLogin(false)}>
      <button type="button" className="menu-item" onClick={() => { setLogin(false); goFamily(); }}><Icon name="home" size={20} />{t('welcome.loginFamily')}</button>
      <button type="button" className="menu-item" onClick={() => { setLogin(false); goYaya(); }}><Icon name="briefcase" size={20} />{t('welcome.loginYaya')}</button>
    </Sheet>
  );
  if (desk) return <Landing goFamily={goFamily} goYaya={goYaya} onLogin={() => setLogin(true)} overlay={loginSheet} />;
  return (
    <Screen tone="cream" label="YayaMatch"
      overlay={login && (
        <Sheet title={t('welcome.loginTitle')} onClose={() => setLogin(false)}>
          <button type="button" className="menu-item" onClick={() => { setLogin(false); goFamily(); }}><Icon name="home" size={20} />{t('welcome.loginFamily')}</button>
          <button type="button" className="menu-item" onClick={() => { setLogin(false); goYaya(); }}><Icon name="briefcase" size={20} />{t('welcome.loginYaya')}</button>
        </Sheet>
      )}>
      <div className="row" style={{ justifyContent: 'space-between', padding: 'calc(20px + var(--safe-t)) 20px 0' }}>
        <img src={asset('logo.png')} alt="YayaMatch" style={{ height: 34, width: 'auto' }} />
        <LangToggle />
      </div>
      <div className="hero"><img src={asset('welcome-hero.jpg')} alt={t('welcome.heroAlt')} /></div>
      <div className="pad mt-22">
        <h1 className="h1">{t('welcome.title')}</h1>
        <p className="lead"><strong style={{ color: 'var(--navy)', fontWeight: 600 }}>{t('welcome.leadStrong')}</strong> {t('welcome.lead')}</p>
      </div>
      <div className="stack gap-12 pad-s mt-22">
        <button type="button" className="path path--family" onClick={goFamily} data-testid="path-family">
          <span className="path__icon"><Icon name="home" size={24} /></span>
          <span className="flex1"><b>{t('welcome.familyTitle')}</b><small>{t('welcome.familySub')}</small></span>
          <Icon name="next" size={22} />
        </button>
        <button type="button" className="path path--yaya" onClick={goYaya} data-testid="path-yaya">
          <span className="path__icon"><Icon name="briefcase" size={24} /></span>
          <span className="flex1"><b>{t('welcome.yayaTitle')}</b><small>{t('welcome.yayaSub')}</small></span>
          <Icon name="next" size={22} />
        </button>
      </div>
      <div className="stack gap-12 mt-24" style={{ padding: '0 24px 28px', alignItems: 'center' }}>
        <div className="proofs">
          <span><Icon name="check" size={15} />{t('welcome.p1')}</span>
          <span><Icon name="check" size={15} />{t('welcome.p2')}</span>
          <span><Icon name="check" size={15} />{t('welcome.p3')}</span>
        </div>
        <div style={{ fontSize: 14 }} className="muted">{t('welcome.haveAccount')} <button type="button" className="btn--text" style={{ border: 0, background: 'none', fontWeight: 600, color: 'var(--coral-deep)', padding: 0 }} onClick={() => setLogin(true)}>{t('welcome.login')}</button></div>
        <div className="small muted">{t('common.demoBadge')}</div>
      </div>
    </Screen>
  );
}

// Desktop landing page (>= 1024px): nav, hero split, proof strip, how it works, footer.
function Landing({ goFamily, goYaya, onLogin, overlay, cta, loginLabel }: { goFamily: () => void; goYaya: () => void; onLogin: () => void; overlay?: ReactNode; cta?: ReactNode; loginLabel?: string }) {
  const t = useT();
  // illustrations: always the bundled sample profiles (tagged "Sample profile")
  const h = HELPERS.find(x => x.id === 'h-01');
  const k = HOUSEHOLDS.find(x => x.id === 'k-13');
  const how = () => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const steps = (prefix: 'f' | 'y') => (['1', '2', '3'] as const).map(n => (
    <li key={n}><span className="how__n">{n}</span><div><b>{t(`desk.landing.${prefix}${n}t`)}</b><p>{t(`desk.landing.${prefix}${n}s`)}</p></div></li>
  ));
  return (
    <Screen tone="cream" label="YayaMatch" desk="landing" overlay={overlay}
      nav={
        <header className="dnav">
          <div className="dnav__in">
            <a className="dnav__logo" href="#welcome"><img src={asset('logo.png')} alt="YayaMatch" /></a>
            <nav className="dnav__links dnav__links--plain" aria-label={t('tabs.nav')}>
              <button type="button" onClick={how}>{t('desk.landing.how')}</button>
              <button type="button" onClick={goFamily}>{t('desk.landing.forFamilies')}</button>
              <button type="button" onClick={goYaya}>{t('desk.landing.forYayas')}</button>
            </nav>
            <div className="dnav__right">
              <LangToggle />
              <Button kind="ghost" size="sm" block={false} onClick={onLogin}>{loginLabel ?? t('welcome.login')}</Button>
            </div>
          </div>
        </header>
      }>
      <section className="lhero">
        <div className="lhero__copy">
          <h1 className="lhero__title">{t('welcome.title')}</h1>
          <p className="lhero__lead"><strong>{t('welcome.leadStrong')}</strong> {t('welcome.lead')}</p>
          {cta ?? <><div className="lhero__paths">
            <button type="button" className="path path--family" onClick={goFamily} data-testid="path-family">
              <span className="path__icon"><Icon name="home" size={24} /></span>
              <span className="flex1"><b>{t('welcome.familyTitle')}</b><small>{t('welcome.familySub')}</small></span>
              <Icon name="next" size={22} />
            </button>
            <button type="button" className="path path--yaya" onClick={goYaya} data-testid="path-yaya">
              <span className="path__icon"><Icon name="briefcase" size={24} /></span>
              <span className="flex1"><b>{t('welcome.yayaTitle')}</b><small>{t('welcome.yayaSub')}</small></span>
              <Icon name="next" size={22} />
            </button>
          </div>
          <div className="muted lhero__login">{t('welcome.haveAccount')} <button type="button" className="textlink" onClick={onLogin}>{t('welcome.login')}</button></div></>}
        </div>
        <div className="lhero__visual">
          <div className="lhero__photo"><img src={asset('welcome-hero.jpg')} alt={t('welcome.heroAlt')} /></div>
          {h && k && (
            <div className="lpeek" aria-label={t('common.sample')}>
              <div className="lpeek__card">
                <img className="lpeek__img" src={asset(h.photo)} alt="" />
                <div className="lpeek__body">
                  <b>{helperName(h)}, {h.age}</b>
                  <small>{h.roles.map(r => t(`roles.${r}`)).join(' · ')} · {t(`cities.${h.city}`)}</small>
                  {h.checks.id && <Tag tone="ok" icon="check">{t('fam.discover.idChecked', { month: monthLabel(t, h.checks.id.month) })}</Tag>}
                </div>
              </div>
              <span className="lpeek__heart" aria-hidden="true"><Icon name="heart" size={20} fill="#F4516C" /></span>
              <div className="lpeek__card">
                <HouseholdAvatar k={k} size={64} />
                <div className="lpeek__body">
                  <b>{k.name}</b>
                  <small>{t(`cities.${k.city}`)} · {pesoRange(k.rateMin, k.rateMax)}</small>
                  {k.checks.id && <Tag tone="ok" icon="check">{t('ya.family.hid')} · {monthLabel(t, k.checks.id)}</Tag>}
                </div>
              </div>
              <span className="lpeek__sample"><Tag tone="white">{t('common.sample')}</Tag></span>
            </div>
          )}
        </div>
      </section>
      <section className="lproof">
        {(['p1', 'p2', 'p3'] as const).map(k => <span key={k}><span className="lproof__icon"><Icon name="check" size={16} sw={2.6} /></span>{t(`welcome.${k}`)}</span>)}
      </section>
      <section className="how" id="how">
        <div className="how__head">
          <h2 className="how__title">{t('desk.landing.how')}</h2>
          <p className="muted">{t('desk.landing.howSub')}</p>
        </div>
        <div className="how__cols">
          <div className="how__col how__col--family">
            <div className="how__kicker"><Icon name="home" size={18} />{t('fam.account.kicker')}</div>
            <ol>{steps('f')}</ol>
            <Button kind="navy" block={false} iconRight="next" onClick={goFamily}>{t('welcome.familyTitle')}</Button>
          </div>
          <div className="how__col how__col--yaya">
            <div className="how__kicker"><Icon name="briefcase" size={18} />{t('ya.welcome.kicker')}</div>
            <ol>{steps('y')}</ol>
            <Button block={false} iconRight="next" onClick={goYaya}>{t('welcome.yayaTitle')}</Button>
          </div>
        </div>
      </section>
      <footer className="lfoot">
        <img src={asset('logo.png')} alt="YayaMatch" />
        <span className="flex1">{t('desk.landing.footer')}</span>
        {!LIVE && <span>{t('common.demoBadge')}</span>}
      </footer>
    </Screen>
  );
}

// Six code boxes with paste support. Used by the demo phone code and the live email code.
function OtpBoxes({ digits, setDigits, error, onComplete, label, onEdit }: {
  digits: string[]; setDigits: (d: string[]) => void; error: boolean; onComplete: (code: string) => void; label: string; onEdit?: () => void;
}) {
  const t = useT();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const setAt = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    onEdit?.();
    if (clean.length > 1) { // paste
      const arr = clean.slice(0, 6).split('');
      const next = [...arr, ...Array(6 - arr.length).fill('')];
      setDigits(next);
      if (arr.length === 6) onComplete(arr.join(''));
      else refs.current[arr.length]?.focus();
      return;
    }
    const next = [...digits]; next[i] = clean; setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.join('').length === 6) onComplete(next.join(''));
  };
  return (
    <div className={`otp mt-24${error ? ' is-error' : ''}`} role="group" aria-label={label}>
      {digits.map((d, i) => (
        <input key={i} ref={el => { refs.current[i] = el; }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={6}
          aria-label={t('auth.digit', { n: i + 1 })} data-testid={`otp-${i}`}
          onChange={e => setAt(i, (e.target as HTMLInputElement).value)}
          onKeyDown={e => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }} />
      ))}
    </div>
  );
}

function useCountdown(start: number) {
  const [left, setLeft] = useState(start);
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft(l => l - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  return [left, setLeft] as const;
}

export function Otp({ side }: { side: 'family' | 'yaya' }) {
  const t = useT();
  const phone = useStore(s => s[side].phone);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [err, setErr] = useState(false);
  const [left, setLeft] = useCountdown(30);
  const code = digits.join('');
  const submit = (c = code) => {
    if (c === DEMO_OTP) {
      verifyPhone(side);
      const st = getState()[side];
      if (side === 'family') nav(st.onboarded ? 'f-discover' : 'f-needs', undefined, { replace: true });
      else nav(st.onboarded ? 'y-families' : 'y-biodata', undefined, { replace: true });
    } else setErr(true);
  };
  const pretty = phone ? `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}` : '';
  return (
    <Screen tone={side === 'yaya' ? 'blush' : 'cream'} side={side}
      header={<TopBar back={side === 'family' ? 'f-account' : 'y-welcome'} />}
      nav={<SlimHeader back={side === 'family' ? 'f-account' : 'y-welcome'} />} brand={<BrandPanel side={side} kind="auth" />}
      footer={<Footer back={side === 'family' ? 'f-account' : 'y-welcome'}><Button onClick={() => submit()} disabled={code.length < 6} testId="otp-verify">{t('auth.verify')}</Button></Footer>}>
      <div className="pad mt-8">
        <h1 className="h1">{t('auth.otpTitle')}</h1>
        <p className="lead">{t('auth.otpBody', { phone: pretty })}</p>
        <OtpBoxes digits={digits} setDigits={setDigits} error={err} onComplete={submit} onEdit={() => setErr(false)} label={t('auth.otpTitle')} />
        {err && <div className="error" role="alert">{t('auth.otpWrong', { code: DEMO_OTP })}</div>}
        <Note className="mt-16" tone={side === 'yaya' ? 'white' : 'info'} icon="info">
          {t('auth.otpDemo', { code: DEMO_OTP })} · <button type="button" style={{ border: 0, background: 'none', padding: 0, color: 'var(--coral-deep)', fontWeight: 700 }}
            onClick={() => { setDigits(DEMO_OTP.split('')); submit(DEMO_OTP); }} data-testid="otp-demo">{t('auth.useDemo')}</button>
        </Note>
        <div className="row mt-18" style={{ justifyContent: 'space-between' }}>
          {left > 0 ? <span className="small muted">{t('auth.resendIn', { s: left })}</span>
            : <button type="button" className="topbar__link" style={{ padding: 0 }} onClick={() => { setLeft(30); toast(t('auth.resent')); }}>{t('auth.resend')}</button>}
          <button type="button" className="topbar__link" style={{ padding: 0 }} onClick={() => nav(side === 'family' ? 'f-account' : 'y-welcome')}>{t('auth.changeNumber')}</button>
        </div>
      </div>
    </Screen>
  );
}

export function NotFound() {
  const t = useT();
  return (
    <Screen tone="cream">
      <div className="empty" style={{ marginTop: 80 }}>
        <span className="empty__icon"><Icon name="search" size={28} /></span>
        <h1 className="h3">{t('notFound.title')}</h1>
        <p className="muted">{t('notFound.body')}</p>
        <Button block={false} to="welcome">{t('notFound.cta')}</Button>
      </div>
    </Screen>
  );
}

export function isValidPhone(p: string) { return /^9\d{9}$/.test(p); }

// =====================================================================
// Live sign-in (Supabase Auth): Facebook, Google, or an email code. No SMS, no phone codes.
// =====================================================================

const FbMark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#fff" /><path fill="#1877F2" d="M13.4 21.9v-7.1h2.4l.4-2.8h-2.8v-1.8c0-.8.2-1.4 1.4-1.4h1.5V6.3c-.3 0-1.1-.1-2.1-.1-2.1 0-3.6 1.3-3.6 3.7V12H8.2v2.8h2.4v7.1z" /></svg>
);
const GoogleMark = () => (
  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const SAMPLE_LOGINS = [
  { key: 'yaya', email: 'kristine.seed@example.com', photo: 'kristine.jpg' },
  { key: 'family', email: 'santos.seed@example.com', photo: null },
] as const;

/** Staging only (a seed password is configured): the two shared sample sign-ins. */
function SampleAccounts() {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const go = (email: string) => { setBusy(email); void signInSample(email).then(ok => { if (!ok) setBusy(null); }); };
  return (
    <section className="samples" data-testid="samples" aria-label={t('live.samples.title')}>
      <div className="row gap-8"><b className="flex1 samples__title">{t('live.samples.title')}</b><Tag tone="warn">{t('live.samples.staging')}</Tag></div>
      <p className="samples__body">{t('live.samples.body')}</p>
      {SAMPLE_LOGINS.map(a => (
        <button key={a.key} type="button" className="list-row sample-row" disabled={!!busy} onClick={() => go(a.email)} data-testid={`sample-${a.key}`}>
          {a.photo ? <Avatar src={a.photo} size={44} /> : <Avatar initials="S" size={44} />}
          <div className="flex1"><b>{a.key === 'yaya' ? t('live.samples.yaya') : t('live.samples.family')}</b><small>{a.key === 'yaya' ? t('live.samples.yayaSub') : t('live.samples.familySub')}</small></div>
          {busy === a.email ? <span className="spinner" /> : <Tag tone="muted">{t('live.samples.tag')}</Tag>}
        </button>
      ))}
      <TestAccountSignIn disabled={!!busy} />
    </section>
  );
}

/** Staging only: sign in to a personal test account with a password (no reset, unlike the shared samples). */
function TestAccountSignIn({ disabled }: { disabled: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const go = () => {
    if (!email.trim() || !pw) return;
    setBusy(true);
    void signInTestAccount(email, pw).then(ok => { if (!ok) setBusy(false); });
  };
  if (!open) return <button type="button" className="textlink mt-12" onClick={() => setOpen(true)} data-testid="test-account-open">{t('live.samples.testOpen')}</button>;
  return (
    <div className="stack gap-12 mt-12" data-testid="test-account">
      <b className="samples__title">{t('live.samples.testTitle')}</b>
      <Field label={t('live.email.label')} value={email} type="email" inputMode="email" icon="mail" testId="test-email" onChange={v => setEmail(v.slice(0, 120))} onEnter={go} />
      <Field label={t('live.samples.testPassword')} value={pw} type="password" icon="lock" testId="test-password" onChange={v => setPw(v.slice(0, 128))} onEnter={go} />
      <Button onClick={go} disabled={disabled || busy || !email.trim() || !pw} testId="test-signin">{busy ? t('live.signin.working') : t('live.samples.testGo')}</Button>
    </div>
  );
}

function SignInOptions() {
  const t = useT();
  return (
    <div className="signin" id="signin" data-testid="signin">
      <div className="signin__title">{t('live.signin.title')}</div>
      <button type="button" className="sbtn sbtn--fb" onClick={() => signInWith('facebook')} data-testid="signin-facebook"><FbMark />{t('live.signin.facebook')}</button>
      <button type="button" className="sbtn sbtn--google" onClick={() => signInWith('google')} data-testid="signin-google"><GoogleMark />{t('live.signin.google')}</button>
      <button type="button" className="sbtn sbtn--email" onClick={() => nav('auth-email')} data-testid="signin-email"><Icon name="mail" size={20} />{t('live.signin.email')}</button>
      <p className="signin__fine">{t('live.signin.fine')}</p>
      {SEEDS_ON && <SampleAccounts />}
    </div>
  );
}

function SidePicker({ onPick, busy }: { onPick: (s: Side) => void; busy: Side | null }) {
  const t = useT();
  const L = useStore(s => s.live);
  return (
    <div className="signin sidepick" data-testid="side-picker">
      <div className="signin__title">{t('live.signin.pickSide')}</div>
      <p className="signin__fine" style={{ marginTop: -4 }}>{t('live.signin.pickSideSub')}</p>
      <button type="button" className="path path--family" onClick={() => onPick('family')} disabled={!!busy} data-testid="path-family">
        <span className="path__icon"><Icon name="home" size={24} /></span>
        <span className="flex1"><b>{t('welcome.familyTitle')}</b><small>{t('welcome.familySub')}</small></span>
        {busy === 'family' ? <span className="spinner" /> : <Icon name="next" size={22} />}
      </button>
      <button type="button" className="path path--yaya" onClick={() => onPick('yaya')} disabled={!!busy} data-testid="path-yaya">
        <span className="path__icon"><Icon name="briefcase" size={24} /></span>
        <span className="flex1"><b>{t('welcome.yayaTitle')}</b><small>{t('welcome.yayaSub')}</small></span>
        {busy === 'yaya' ? <span className="spinner" /> : <Icon name="next" size={22} />}
      </button>
      <div className="row gap-8 sidepick__who">
        <span className="flex1">{t('live.signin.signedInAs', { email: L?.email ?? '' })}</span>
        {L?.role === 'admin' && <button type="button" className="textlink" onClick={() => nav('admin')} data-testid="open-admin">{t('live.admin')}</button>}
        <button type="button" className="textlink" onClick={() => logout('family')} data-testid="signout">{t('live.signin.signOut')}</button>
      </div>
    </div>
  );
}

function LiveWelcome() {
  const t = useT();
  const L = useStore(s => s.live);
  const desk = useIsDesktop();
  const [busy, setBusy] = useState<Side | null>(null);
  const signedIn = L?.status === 'in';
  const pick = (side: Side) => {
    setBusy(side);
    enterSide(side);
    settle(chooseSide(side), ok => { setBusy(null); if (ok) nav(side === 'family' ? 'f-needs' : 'y-biodata'); });
  };
  const toSignin = () => document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const cta = signedIn ? <SidePicker onPick={pick} busy={busy} /> : <SignInOptions />;
  if (desk) {
    return <Landing goFamily={signedIn ? () => pick('family') : toSignin} goYaya={signedIn ? () => pick('yaya') : toSignin}
      onLogin={signedIn ? () => logout('family') : toSignin} loginLabel={signedIn ? t('live.signin.signOut') : undefined} cta={<div className="lhero__cta">{cta}</div>} />;
  }
  return (
    <Screen tone="cream" label="YayaMatch">
      <div className="row" style={{ justifyContent: 'space-between', padding: 'calc(20px + var(--safe-t)) 20px 0' }}>
        <img src={asset('logo.png')} alt="YayaMatch" style={{ height: 34, width: 'auto' }} />
        <LangToggle />
      </div>
      <div className="hero"><img src={asset('welcome-hero.jpg')} alt={t('welcome.heroAlt')} /></div>
      <div className="pad mt-22">
        <h1 className="h1">{t('welcome.title')}</h1>
        <p className="lead"><strong style={{ color: 'var(--navy)', fontWeight: 600 }}>{t('welcome.leadStrong')}</strong> {t('welcome.lead')}</p>
      </div>
      <div className="pad-s mt-22">{cta}</div>
      <div className="stack gap-12 mt-24" style={{ padding: '0 24px 28px', alignItems: 'center' }}>
        <div className="proofs">
          <span><Icon name="check" size={15} />{t('welcome.p1')}</span>
          <span><Icon name="check" size={15} />{t('welcome.p2')}</span>
          <span><Icon name="check" size={15} />{t('welcome.p3')}</span>
        </div>
      </div>
    </Screen>
  );
}

const EMAIL_KEY = 'ym-auth-email';
const savedEmail = () => { try { return getUi().authEmail || sessionStorage.getItem(EMAIL_KEY) || ''; } catch { return getUi().authEmail; } };

export function AuthEmail() {
  const t = useT();
  const [email, setEmail] = useState(savedEmail);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setErr(t('live.email.invalid')); return; }
    setBusy(true);
    void sendSignInCode(e).then(r => {
      setBusy(false);
      if (r === 'ok') {
        setUi({ authEmail: e });
        try { sessionStorage.setItem(EMAIL_KEY, e); } catch { /* ignore */ }
        nav('auth-code');
      } else setErr(r === 'limit' ? t('live.err.tooMany') : t('live.email.failed'));
    });
  };
  return (
    <Screen tone="cream" side="family" header={<TopBar back="welcome" />} nav={<SlimHeader back="welcome" />} brand={<BrandPanel side="family" kind="auth" />}
      footer={<Footer back="welcome"><Button onClick={submit} disabled={busy} testId="email-send">{busy ? t('live.signin.working') : t('live.email.send')}</Button><div className="footer__fine">{t('auth.terms')}</div></Footer>}>
      <div className="pad">
        <Tag tone="white" icon="mail">{t('live.signin.title')}</Tag>
        <h1 className="h1 h1--xl mt-12">{t('live.email.title')}</h1>
        <p className="lead">{t('live.email.body')}</p>
        <div className="mt-24">
          <Field label={t('live.email.label')} value={email} type="email" inputMode="email" icon="mail" placeholder={t('live.email.ph')} testId="email"
            onChange={v => { setEmail(v.slice(0, 120)); setErr(null); }} onEnter={submit} error={err} />
        </div>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function AuthCode() {
  const t = useT();
  const email = savedEmail();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCountdown(60);
  const [round, setRound] = useState(0);
  useEffect(() => { if (!email) nav('auth-email', undefined, { replace: true }); }, [email]);
  const code = digits.join('');
  const submit = (c = code) => {
    if (busy || c.length < 6) return;
    setBusy(true);
    void verifySignInCode(email, c).then(r => {
      setBusy(false);
      // start over with empty boxes, so editing one box doesn't resend a half-wrong code
      if (r !== 'ok') { setErr(true); setDigits(['', '', '', '', '', '']); setRound(x => x + 1); if (r === 'error') toast(t('live.err.generic')); }
    });
  };
  const resend = () => {
    setLeft(60);
    void sendSignInCode(email).then(r => toast(r === 'ok' ? t('live.code.resent') : r === 'limit' ? t('live.err.tooMany') : t('live.email.failed')));
  };
  return (
    <Screen tone="cream" side="family" header={<TopBar back="auth-email" />} nav={<SlimHeader back="auth-email" />} brand={<BrandPanel side="family" kind="auth" />}
      footer={<Footer back="auth-email"><Button onClick={() => submit()} disabled={code.length < 6 || busy} testId="code-go">{busy ? t('live.signin.working') : t('live.code.go')}</Button></Footer>}>
      <div className="pad mt-8">
        <h1 className="h1">{t('live.code.title')}</h1>
        <p className="lead" data-testid="code-body">{t('live.code.body', { email })}</p>
        <OtpBoxes key={round} digits={digits} setDigits={setDigits} error={err} onComplete={submit} onEdit={() => setErr(false)} label={t('live.code.title')} />
        {err && <div className="error" role="alert">{t('live.code.wrong')}</div>}
        <Note className="mt-16" tone="info" icon="mail">{t('live.code.link')}</Note>
        <div className="row mt-18" style={{ justifyContent: 'space-between' }}>
          {left > 0 ? <span className="small muted">{t('auth.resendIn', { s: left })}</span>
            : <button type="button" className="topbar__link" style={{ padding: 0 }} onClick={resend} data-testid="code-resend">{t('auth.resend')}</button>}
          <button type="button" className="topbar__link" style={{ padding: 0 }} onClick={() => nav('auth-email')}>{t('live.code.changeEmail')}</button>
        </div>
      </div>
    </Screen>
  );
}

/** While the session is restored and the first data loads. */
export function Booting() {
  const t = useT();
  return (
    <div className="booting" role="status" aria-live="polite" data-testid="booting">
      <img src={asset('logo.png')} alt="YayaMatch" />
      <span className="spinner" style={{ width: 32, height: 32, borderWidth: 4 }} />
      <span className="small muted">{t('live.loading')}</span>
    </div>
  );
}
