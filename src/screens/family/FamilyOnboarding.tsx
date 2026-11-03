import { useState } from 'react';
import { useT, minWageLine, peso } from '../../lib/i18n';
import { useStore, useUi, setUi, toast } from '../../lib/store';
import { nav } from '../../lib/router';
import { Screen, TopBar, Progress, Footer, Button, Tile, Chip, Field, CitySearch, Note, Segmented, DayPicker, RangeSlider, Sheet, ValueRow, Tag } from '../../components/ui';
import { patchFamily, setPhone, finishFamilyOnboarding } from '../../lib/actions';
import { ROLES, ROLE_ICON, PERKS, minWageFor, RATE_MAX, RATE_STEP, type Role } from '../../data/constants';
import { isValidPhone } from '../shared/Shared';
import { SlimHeader, BrandPanel } from '../../components/desktop';
import { LIVE } from '../../lib/config';

export function FamilyAccount() {
  const t = useT();
  const saved = useStore(s => s.family.phone);
  const [phone, setP] = useState(saved || '9171234567');
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    const p = phone.replace(/\D/g, '');
    if (!isValidPhone(p)) { setErr(t('auth.phoneInvalid')); return; }
    setPhone('family', p);
    nav('f-otp');
  };
  return (
    <Screen tone="cream" side="family" header={<TopBar back="welcome" />} nav={<SlimHeader back="welcome" />} brand={<BrandPanel side="family" kind="auth" />}
      footer={<Footer back="welcome"><Button onClick={submit} testId="send-code">{t('auth.sendCode')}</Button><div className="footer__fine">{t('auth.terms')}</div></Footer>}>
      <div className="pad">
        <Tag tone="white" icon="home">{t('fam.account.kicker')}</Tag>
        <h1 className="h1 h1--xl mt-12">{t('fam.account.title')}</h1>
        <div className="stack gap-16 mt-22 auth-values">
          <ValueRow icon="calendar" title={t('fam.account.v1t')} sub={t('fam.account.v1s')} />
          <ValueRow icon="chat" title={t('fam.account.v2t')} sub={t('fam.account.v2s')} />
          <ValueRow icon="peso" title={t('fam.account.v3t')} sub={t('fam.account.v3s')} />
        </div>
        <div className="mt-24">
          <Field label={t('auth.mobile')} value={formatPhone(phone)} prefix="+63" inputMode="numeric" maxLength={12} testId="phone"
            onChange={v => { setP(v.replace(/\D/g, '').slice(0, 10)); setErr(null); }} onEnter={submit} error={err} hint={t('auth.phoneHint')} />
        </div>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function formatPhone(p: string) {
  const d = p.replace(/\D/g, '');
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');
}

function useStepNav(next: string) {
  const editing = useUi(s => s.editing);
  const t = useT();
  return {
    editing,
    go: () => { if (editing) { setUi({ editing: false }); nav('f-me'); toast(t('fam.onb.saved')); } else nav(next); },
  };
}

export function FamilyNeeds() {
  const t = useT();
  const roles = useStore(s => s.family.roles);
  const onboarded = useStore(s => s.family.onboarded);
  const [err, setErr] = useState(false);
  const { editing, go } = useStepNav('f-home');
  const toggle = (r: Role) => { setErr(false); patchFamily({ roles: roles.includes(r) ? roles.filter(x => x !== r) : [...roles, r] }); };
  const submit = () => { if (!roles.length) { setErr(true); return; } go(); };
  // live: the first step has nothing to go back to (sign-in is done, the side is chosen)
  const backTo = editing ? 'f-me' : LIVE ? undefined : 'f-account';
  return (
    <Screen tone="cream" side="family" header={<><TopBar back={backTo} />{!editing && <Progress n={1} total={3} label={t('fam.onb.stepOf', { n: 1, total: 3 })} />}</>}
      nav={<SlimHeader back={backTo} />} brand={<BrandPanel side="family" kind="onb" />}
      footer={<Footer back={backTo}><Button onClick={submit} iconRight={editing ? undefined : 'next'} testId="next">{editing ? t('fam.onb.saveChanges') : t('common.next')}</Button></Footer>}>
      <div className="pad mt-18">
        <h1 className="h1">{t('fam.onb.needsTitle')}</h1>
        <p className="lead">{t('fam.onb.needsBody')}</p>
        {!onboarded && !editing && !LIVE && <Note className="mt-12" tone="info" icon="info">{t('fam.onb.prefilled')}</Note>}
        <div className="tiles mt-18">
          {ROLES.map(r => {
            const [title, sub] = t.raw<string[]>(`famRoleTile.${r}`);
            return <Tile key={r} icon={ROLE_ICON[r]} title={title} sub={sub} on={roles.includes(r)} onClick={() => toggle(r)} testId={`role-${r}`} />;
          })}
        </div>
        {err && <div className="error" role="alert">{t('fam.onb.needsMin')}</div>}
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function FamilyHome() {
  const t = useT();
  const f = useStore(s => s.family);
  const [kidSheet, setKidSheet] = useState(false);
  const [err, setErr] = useState(false);
  const { editing, go } = useStepNav('f-setup');
  const submit = () => { if (!f.name.trim()) { setErr(true); return; } go(); };
  const kidLabel = (a: number) => (a === 0 ? t('fam.onb.kidBaby') : t('fam.onb.kidAge', { n: a }));
  return (
    <Screen tone="cream" side="family" header={<><TopBar back={editing ? 'f-me' : 'f-needs'} />{!editing && <Progress n={2} total={3} label={t('fam.onb.stepOf', { n: 2, total: 3 })} />}</>}
      nav={<SlimHeader back={editing ? 'f-me' : 'f-needs'} />} brand={<BrandPanel side="family" kind="onb" />}
      footer={<Footer back={editing ? 'f-me' : 'f-needs'}><Button onClick={submit} iconRight={editing ? undefined : 'next'} testId="next">{editing ? t('fam.onb.saveChanges') : t('common.next')}</Button></Footer>}
      overlay={kidSheet && (
        <Sheet title={t('fam.onb.addKidTitle')} onClose={() => setKidSheet(false)}>
          <div className="chips">
            {Array.from({ length: 18 }, (_, a) => (
              <Chip key={a} small onClick={() => { patchFamily({ kids: [...f.kids, a].sort((x, y) => x - y) }); setKidSheet(false); }}>{kidLabel(a)}</Chip>
            ))}
          </div>
        </Sheet>
      )}>
      <div className="pad mt-18">
        <h1 className="h1">{t('fam.onb.homeTitle')}</h1>
        <div className="fcols">
        <div className="mt-18">
          <Field label={t('fam.onb.familyName')} value={f.name} testId="family-name" onChange={v => { patchFamily({ name: v.replace(/[^\p{L}\s'-]/gu, '').slice(0, 30) }); setErr(false); }}
            error={err ? t('fam.onb.familyNameReq') : null} hint={f.name.trim() ? t('fam.onb.familyNameHint', { name: f.name.trim() }) : undefined} />
        </div>
        <div className="mt-16"><CitySearch label={t('fam.onb.city')} value={f.city} onChange={c => patchFamily({ city: c })} testId="city" /></div>
        </div>
        <Note className="mt-10" icon="lock">{t('fam.onb.cityPrivacy')}</Note>
        <div className="fcols">
        <div>
        <div className="label mt-20">{t('fam.onb.kids')}</div>
        <div className="chips">
          {f.kids.map((a, i) => (
            <button key={i} type="button" className="chip is-on" aria-label={t('fam.onb.removeKid', { age: kidLabel(a) })}
              onClick={() => patchFamily({ kids: f.kids.filter((_, j) => j !== i) })}>{kidLabel(a)}<span aria-hidden="true" style={{ opacity: .7 }}>×</span></button>
          ))}
          <Chip add icon="plus" onClick={() => setKidSheet(true)}>{t('fam.onb.addKid')}</Chip>
        </div>
        </div>
        <div>
        <div className="label mt-18">{t('fam.onb.elderQ')}</div>
        <div className="chips">
          <Chip on={f.elder} onClick={() => patchFamily({ elder: true })}>{t('fam.onb.elderYes')}</Chip>
          <Chip on={!f.elder} onClick={() => patchFamily({ elder: false })}>{t('fam.onb.elderNo')}</Chip>
        </div>
        </div>
        <div>
        <div className="label mt-18">{t('fam.onb.pets')}</div>
        <div className="chips">
          {(['dog', 'cat'] as const).map(p => (
            <Chip key={p} on={f.pets.includes(p)} onClick={() => patchFamily({ pets: f.pets.includes(p) ? f.pets.filter(x => x !== p) : [...f.pets, p] })}>{t(`fam.onb.${p}`)}</Chip>
          ))}
          <Chip on={f.pets.length === 0} onClick={() => patchFamily({ pets: [] })}>{t('fam.onb.noPets')}</Chip>
        </div>
        </div>
        <div>
        <div className="label mt-18">{t('fam.onb.langsHome')}</div>
        <div className="chips">
          {(['tagalog', 'english', 'bisaya', 'ilocano'] as const).map(l => (
            <Chip key={l} on={f.langs.includes(l)} onClick={() => patchFamily({ langs: f.langs.includes(l) ? f.langs.filter(x => x !== l) : [...f.langs, l] })}>{t(`langs.${l}`)}</Chip>
          ))}
        </div>
        </div>
        </div>
        <div className="spacer" />
      </div>
    </Screen>
  );
}

export function FamilySetup() {
  const t = useT();
  const f = useStore(s => s.family);
  const editing = useUi(s => s.editing);
  const [err, setErr] = useState(false);
  const floor = minWageFor(f.city).amount;
  const lo = Math.max(f.budgetMin, floor);
  const hi = Math.max(f.budgetMax, lo + RATE_STEP);
  const submit = () => {
    if (!f.restDays.length) { setErr(true); return; }
    if (lo !== f.budgetMin || hi !== f.budgetMax) patchFamily({ budgetMin: lo, budgetMax: hi });
    if (editing) { setUi({ editing: false }); nav('f-me'); toast(t('fam.onb.saved')); return; }
    finishFamilyOnboarding();
    nav('f-discover');
  };
  const floorRounded = Math.floor(floor / RATE_STEP) * RATE_STEP;
  return (
    <Screen tone="cream" side="family" header={<><TopBar back={editing ? 'f-me' : 'f-home'} />{!editing && <Progress n={3} total={3} label={t('fam.onb.stepOf', { n: 3, total: 3 })} />}</>}
      nav={<SlimHeader back={editing ? 'f-me' : 'f-home'} />} brand={<BrandPanel side="family" kind="onb" />}
      footer={<Footer back={editing ? 'f-me' : 'f-home'}><Button onClick={submit} testId="see-matches">{editing ? t('fam.onb.saveChanges') : t('fam.onb.seeMatches')}</Button></Footer>}>
      <div className="pad mt-16">
        <h1 className="h1">{t('fam.onb.setupTitle')}</h1>
        <div className="fcols">
        <div>
        <div className="label mt-16">{t('fam.onb.arrangement')}</div>
        <Segmented label={t('fam.onb.arrangement')} value={f.arrangement} onChange={v => patchFamily({ arrangement: v })}
          options={[{ v: 'livein', label: t('arr.livein') }, { v: 'liveout', label: t('arr.liveout') }]} />
        </div>
        <div>
        <div className="label mt-14">{t('fam.onb.schedule')}</div>
        <Segmented label={t('fam.onb.schedule')} value={f.schedule} onChange={v => patchFamily({ schedule: v })}
          options={[{ v: 'fulltime', label: t('fam.onb.fulltime') }, { v: 'parttime', label: t('fam.onb.parttime') }]} />
        </div>
        </div>
        <div className="label mt-14">{t('fam.onb.restDay')}</div>
        <DayPicker label={t('fam.onb.restDay')} value={f.restDays} onChange={v => { patchFamily({ restDays: v as typeof f.restDays }); setErr(false); }} />
        {err ? <div className="error" role="alert">{t('fam.onb.restReq')}</div> : <div className="hint mt-8">{t('fam.onb.restHint')}</div>}
        <div className="row mt-18" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="label">{t('fam.onb.budget')}</span>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18 }} data-testid="budget">{peso(lo)} – {peso(hi)}</span>
        </div>
        <RangeSlider min={floorRounded} max={RATE_MAX} step={RATE_STEP} low={lo} high={hi} labelLow={t('fam.onb.budgetFrom')} labelHigh={t('fam.onb.budgetTo')}
          onChange={(a, b) => patchFamily({ budgetMin: Math.max(a, floor), budgetMax: b })} />
        <Note className="mt-6">{minWageLine(t, f.city, 'fam.onb.minWage')}</Note>
        <div className="label mt-16">{t('fam.onb.extras')}</div>
        <div className="chips" style={{ gap: 6 }}>
          {PERKS.map(p => <Chip key={p} small on={f.perks.includes(p)} onClick={() => patchFamily({ perks: f.perks.includes(p) ? f.perks.filter(x => x !== p) : [...f.perks, p] })}>{t(`perks.${p}`)}</Chip>)}
        </div>
        <div className="spacer" />
      </div>
    </Screen>
  );
}
