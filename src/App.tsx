import { useEffect, useState } from 'react';
import { useRoute, nav } from './lib/router';
import { useStore } from './lib/store';
import { useT } from './lib/i18n';
import { Toasts } from './components/ui';
import type { AppState, LiveState } from './lib/types';
import { Welcome, Otp, NotFound, AuthEmail, AuthCode, Booting } from './screens/shared/Shared';
import { FamilyIdCheck } from './screens/shared/IdCheck';
import { Admin } from './screens/admin/Admin';
import { LIVE } from './lib/config';
import { startLive } from './lib/live/sync';
import { takeReturns } from './lib/live/actions';
import { FamilyAccount, FamilyNeeds, FamilyHome, FamilySetup } from './screens/family/FamilyOnboarding';
import { FamilyDiscover, HelperProfile, FamilyMatch, FamilyChat, FamilyPlans, FamilyCheckout, FamilyChecklist, FamilyInbox, FamilyMe } from './screens/family/FamilyMain';
import { YayaWelcome, YayaBiodata, YayaAbout, YayaWork, YayaSkills, YayaLooking, YayaIntro, YayaIdCheck, YayaReady } from './screens/yaya/YayaOnboarding';
import { YayaFamilies, YayaFamilyDetail, YayaMatch, YayaChat, YayaMatches, YayaChats, YayaHired, YayaMe, YayaRights, YayaSafety } from './screens/yaya/YayaMain';

const FAMILY_ONB = ['f-needs', 'f-home', 'f-setup'];
const YAYA_ONB = ['y-biodata', 'y-about', 'y-work', 'y-skills', 'y-looking', 'y-intro'];

const liveHome = (L: LiveState) => (!L.side ? 'welcome' : L.side === 'family' ? (L.onboarded ? 'f-discover' : 'f-needs') : (L.onboarded ? 'y-families' : 'y-biodata'));

// Live: signed in or not, which side, onboarded or not. 'wait' renders the loading screen.
function liveGuard(name: string, s: AppState): string | null {
  const L = s.live!;
  if (L.status === 'boot') return 'wait';
  if (L.status === 'out') return ['welcome', 'auth-email', 'auth-code'].includes(name) ? null : 'welcome';
  if (!L.loaded) return 'wait';
  if (name === 'auth-email' || name === 'auth-code') return liveHome(L);
  if (name === 'admin') return L.role === 'admin' ? null : liveHome(L);
  if (!L.side) return name === 'welcome' ? null : 'welcome';
  // the phone sign-in screens are demo only; the side never changes
  if (name === 'welcome' || ['f-account', 'f-otp', 'y-welcome', 'y-otp'].includes(name)) return liveHome(L);
  if (name.startsWith('f-') || name.startsWith('y-')) {
    if (!name.startsWith(L.side === 'family' ? 'f-' : 'y-')) return liveHome(L);
    if (!L.onboarded) {
      if (L.side === 'family' && !FAMILY_ONB.includes(name)) return 'f-needs';
      if (L.side === 'yaya' && !YAYA_ONB.includes(name) && name !== 'y-idcheck' && name !== 'y-ready') return 'y-biodata';
    }
  }
  return null;
}

// Where a route should send someone who is not ready for it yet.
function guard(name: string, s: AppState): string | null {
  if (LIVE) return liveGuard(name, s);
  const f = s.family; const y = s.yaya;
  if (name.startsWith('f-') && !['f-account', 'f-otp'].includes(name)) {
    if (!f.verified) return 'f-account';
    if (!FAMILY_ONB.includes(name) && !f.onboarded) return 'f-needs';
  }
  if (name === 'f-otp' && !f.phone) return 'f-account';
  if (name.startsWith('y-') && !['y-welcome', 'y-otp'].includes(name)) {
    if (!y.verified) return 'y-welcome';
    if (!YAYA_ONB.includes(name) && name !== 'y-idcheck' && name !== 'y-ready' && !y.onboarded) return 'y-biodata';
  }
  if (name === 'y-otp' && !y.phone) return 'y-welcome';
  return null;
}

export function App() {
  const route = useRoute();
  const s = useStore(st => st);
  const t = useT();
  const redirect = guard(route.name, s);
  const wait = redirect === 'wait';
  useEffect(() => { if (LIVE) void startLive(); }, []);
  // live: returns from Didit and PayMongo are handled once after the first load, before any screen mounts
  const [returnsDone, setReturnsDone] = useState(!LIVE);
  const returnsDue = !returnsDone && s.live?.status === 'in' && !!s.live.loaded;
  useEffect(() => {
    if (!returnsDue) return;
    takeReturns();
    setReturnsDone(true);
  }, [returnsDue]);
  useEffect(() => { if (redirect && !wait) nav(redirect, undefined, { replace: true }); }, [redirect]);
  useEffect(() => { document.documentElement.lang = t.lang === 'tl' ? 'fil' : 'en'; }, [t.lang]);
  useEffect(() => {
    const side = route.name.startsWith('y-') ? 'yaya' : 'family';
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', side === 'yaya' ? '#FDE8EC' : '#FFF7F1');
  }, [route.name]);
  if (wait || returnsDue) return <div className="stage"><div className="app">{<Booting />}<Toasts /></div></div>;
  if (redirect) return null;
  const p = route.param ?? '';
  let screen;
  switch (route.name) {
    case 'welcome': screen = <Welcome />; break;
    case 'auth-email': screen = LIVE ? <AuthEmail /> : <NotFound />; break;
    case 'auth-code': screen = LIVE ? <AuthCode /> : <NotFound />; break;
    case 'admin': screen = LIVE ? <Admin /> : <NotFound />; break;
    case 'f-idcheck': screen = <FamilyIdCheck />; break;
    case 'f-account': screen = <FamilyAccount />; break;
    case 'f-otp': screen = <Otp side="family" />; break;
    case 'f-needs': screen = <FamilyNeeds />; break;
    case 'f-home': screen = <FamilyHome />; break;
    case 'f-setup': screen = <FamilySetup />; break;
    case 'f-discover': screen = <FamilyDiscover />; break;
    case 'f-helper': screen = <HelperProfile id={p} />; break;
    case 'f-match': screen = <FamilyMatch id={p} />; break;
    case 'f-chat': screen = <FamilyChat id={p} />; break;
    case 'f-hired': screen = <FamilyChat id={p} hireOpen />; break;
    case 'f-plans': screen = <FamilyPlans />; break;
    case 'f-checkout': screen = <FamilyCheckout />; break;
    case 'f-checklist': screen = <FamilyChecklist />; break;
    case 'f-inbox': case 'f-likes': screen = <FamilyInbox />; break;
    case 'f-me': screen = <FamilyMe />; break;
    case 'y-welcome': screen = <YayaWelcome />; break;
    case 'y-otp': screen = <Otp side="yaya" />; break;
    case 'y-biodata': screen = <YayaBiodata />; break;
    case 'y-about': screen = <YayaAbout />; break;
    case 'y-work': screen = <YayaWork />; break;
    case 'y-skills': screen = <YayaSkills />; break;
    case 'y-looking': screen = <YayaLooking />; break;
    case 'y-intro': screen = <YayaIntro />; break;
    case 'y-idcheck': screen = <YayaIdCheck />; break;
    case 'y-ready': screen = <YayaReady />; break;
    case 'y-families': screen = <YayaFamilies />; break;
    case 'y-family': screen = <YayaFamilyDetail id={p} />; break;
    case 'y-match': screen = <YayaMatch id={p} />; break;
    case 'y-chat': screen = <YayaChat id={p} />; break;
    case 'y-matches': screen = <YayaMatches />; break;
    case 'y-chats': screen = <YayaChats />; break;
    case 'y-hired': screen = <YayaHired id={p} />; break;
    case 'y-me': screen = <YayaMe />; break;
    case 'y-rights': screen = <YayaRights />; break;
    case 'y-safety': screen = <YayaSafety />; break;
    default: screen = <NotFound />;
  }
  return (
    <div className="stage">
      <div className="app" key={route.name + p}>
        {screen}
        <Toasts />
      </div>
      {!LIVE && <p className="desk-note"><b>YayaMatch</b> · {t('common.demoBadge')}. {t.lang === 'tl' ? 'Pinakamaganda sa phone.' : 'Best on a phone.'}</p>}
    </div>
  );
}
