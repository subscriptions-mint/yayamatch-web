// ID check for both sides: the yaya's free ID check and the family's household ID check (same screens).
// Demo: simulated. Live: id-check-start decides. Test mode keeps these screens and ends with id-check-test;
// live mode goes to Didit and comes back with ?didit=1, then we wait for the result.
import { useEffect, useState } from 'react';
import { useT, monthLabel } from '../../lib/i18n';
import { useStore, getUi, setUi } from '../../lib/store';
import { nav } from '../../lib/router';
import { Screen, TopBar, Footer, Button, Tag, Icon, Note, readImage } from '../../components/ui';
import { settle, startIdCheck, finishIdCheck, pollIdCheck, consumeDidit } from '../../lib/actions';
import { ID_TYPES, type IdType } from '../../data/constants';
import { useIsDesktop } from '../../lib/useIsDesktop';
import { SlimHeader, BrandPanel } from '../../components/desktop';
import { LIVE } from '../../lib/config';
import type { Side } from '../../lib/types';

type Phase = 'choose' | 'starting' | 'id' | 'selfie' | 'checking' | 'polling' | 'done' | 'review' | 'failed';

export function YayaIdCheck() { return <IdCheckFlow side="yaya" />; }
export function FamilyIdCheck() { return <IdCheckFlow side="family" />; }

function IdCheckFlow({ side }: { side: Side }) {
  const t = useT();
  const st = useStore(s => s[side]);
  const idStatus = useStore(s => s.live?.idStatus ?? 'none');
  const yaya = side === 'yaya';
  const tone = yaya ? 'blush' : 'cream';
  const k = (key: string) => (yaya ? `ya.id.${key}` : `fam.id.${key}`);
  const [type, setType] = useState<IdType>('philid');
  const [phase, setPhase] = useState<Phase>(() => {
    if (LIVE && consumeDidit()) return 'polling';
    if (st.idCheck) return 'done';
    if (LIVE && idStatus === 'review') return 'review';
    if (LIVE && idStatus === 'failed') return 'failed';
    return 'choose';
  });
  const [img, setImg] = useState<string | null>(null);
  const desk = useIsDesktop();
  const returnTo = getUi().idReturn;
  const backTo = returnTo ?? (yaya ? 'y-intro' : 'f-me');
  const leave = (fallback: string) => { const to = getUi().idReturn ?? fallback; setUi({ idReturn: null }); nav(to); };
  const afterDone = () => leave(yaya ? 'y-ready' : 'f-discover');
  const later = () => leave(yaya ? 'y-ready' : 'f-discover');

  useEffect(() => {
    if (phase !== 'polling') return;
    let alive = true;
    void pollIdCheck(side).then(s => { if (alive) setPhase(s === 'passed' ? 'done' : s === 'failed' ? 'failed' : 'review'); });
    return () => { alive = false; };
  }, [phase]);

  const begin = () => {
    setPhase('starting');
    settle(startIdCheck(side), r => setPhase(r === 'test' ? 'id' : r === 'redirect' ? 'starting' : 'choose'));
  };
  const capture = async (file?: File) => {
    if (file) { try { setImg(await readImage(file, 600)); } catch { setImg(null); } }
    if (phase === 'id') { window.setTimeout(() => { setImg(null); setPhase('selfie'); }, file ? 700 : 300); }
    else if (phase === 'selfie') {
      window.setTimeout(() => {
        setImg(null); setPhase('checking');
        // we never keep the photos: only the result and the date
        void finishIdCheck(side, type).then(ok => setPhase(ok ? 'done' : 'failed'));
      }, file ? 700 : 300);
    }
  };
  const stepIdx = phase === 'choose' || phase === 'starting' ? -1 : phase === 'id' ? 0 : phase === 'selfie' ? 1 : 2;
  const steps = (
    <div className="steps3 mt-18">
      {[t('ya.id.s1'), t('ya.id.s2'), t('ya.id.s3')].map((s, i) => (
        <div key={s} className={i < stepIdx || phase === 'done' ? 'done' : i === stepIdx || (stepIdx < 0 && i === 0) ? 'on' : ''}><i>{i < stepIdx || phase === 'done' ? '✓' : i + 1}</i>{s}</div>
      ))}
    </div>
  );
  const laterBtn = <button type="button" className="topbar__link" onClick={later} data-testid="id-later">{t('ya.id.later')}</button>;

  // ---------- results (pattern I) ----------
  const result = (icon: string, title: string, body: string, actions: React.ReactNode, ok = true) => {
    if (desk) {
      return (
        <Screen tone={tone} side={side} nav={<SlimHeader back={backTo} />} desk="center">
          <div className="dcenter">
            <div className="dcard center">
              <span className={`success__icon${ok ? '' : ' success__icon--wait'}`} style={{ margin: '0 auto' }}><Icon name={icon} size={36} sw={2.6} /></span>
              <h1 className="h1 mt-16">{title}</h1>
              <p className="dlead">{body}</p>
              <Note className="mt-16" tone="info" icon="lock">{t('ya.id.privacy')}</Note>
              <div className="dactions">{actions}</div>
            </div>
          </div>
        </Screen>
      );
    }
    return (
      <Screen tone={tone} side={side} header={<TopBar back={backTo} />} footer={<Footer>{actions}</Footer>}>
        <div className="success">
          <span className={`success__icon${ok ? '' : ' success__icon--wait'}`}><Icon name={icon} size={36} sw={2.6} /></span>
          <h1 className="h1 mt-8">{title}</h1>
          <p className="lead">{body}</p>
          <Note className="mt-8" tone={yaya ? 'white' : 'info'} icon="lock">{t('ya.id.privacy')}</Note>
        </div>
      </Screen>
    );
  };
  if (phase === 'done' && st.idCheck) {
    return result('check', t(k('doneT')), t(k('doneB'), { month: monthLabel(t, st.idCheck.month) }),
      <Button block={!desk} onClick={afterDone} testId="id-continue">{t('common.continue')}</Button>);
  }
  if (phase === 'review') {
    return result('clock', t('live.idReviewT'), t('live.idReviewB'), <Button block={!desk} onClick={afterDone} testId="id-continue">{t('common.continue')}</Button>, false);
  }
  if (phase === 'failed') {
    return result('alert', t('live.idFailT'), t('live.idFailB'), <>
      {desk && <Button kind="ghost" block={false} onClick={later}>{t('ya.id.later')}</Button>}
      <Button block={!desk} onClick={() => setPhase('choose')} testId="id-retry">{t('live.idRetry')}</Button>
    </>, false);
  }
  if (phase === 'polling' || phase === 'starting') {
    const label = phase === 'polling' ? t('live.idWaiting') : t('live.signin.working');
    return (
      <Screen tone={tone} side={side} header={<TopBar back={backTo} />} nav={<SlimHeader back={backTo} />} desk="center">
        <div className={desk ? 'dcenter' : 'success'}>
          <div className={desk ? 'dcard center' : 'center'}>
            <span className="spinner" style={{ width: 44, height: 44, borderWidth: 5, margin: '0 auto' }} />
            <h1 className="h3 mt-16" data-testid="id-waiting">{label}</h1>
          </div>
        </div>
      </Screen>
    );
  }

  // ---------- capture (pattern J) ----------
  if (phase === 'id' || phase === 'selfie' || phase === 'checking') {
    const isId = phase === 'id';
    if (desk) {
      const tips = isId ? ['idTip1', 'idTip2', 'idTip3'] : ['selfieTip1', 'selfieTip2', 'selfieTip3'];
      return (
        <Screen tone={tone} side={side} nav={<SlimHeader onBack={() => setPhase(isId || phase === 'checking' ? 'choose' : 'id')} />} desk="camera">
          <div className="dcam">
            <div className="dcam__panel">
              {img && <img src={img} alt="" />}
              <div className={`capture__frame${isId ? '' : ' capture__frame--face'}`} />
              {phase === 'checking'
                ? <span className="dcam__hint"><span className="spinner" />{t('ya.id.checking')}</span>
                : <span className="dcam__hint"><Icon name="camera" size={16} />{t('desk.id.preview')}</span>}
            </div>
            <div className="dcam__side">
              {steps}
              {phase === 'checking' ? (
                <div className="dcam__checking"><span className="spinner" style={{ width: 44, height: 44, borderWidth: 5 }} /><h1 className="h3">{t('ya.id.checking')}</h1></div>
              ) : <>
                <h1 className="h1 mt-20">{isId ? t('ya.id.capIdT', { type: t(`idTypes.${type}`) }) : t('ya.id.capSelfieT')}</h1>
                <p className="lead">{isId ? t('ya.id.capIdB') : t('ya.id.capSelfieB')}</p>
                <div className="dcam__tips">
                  <div className="eyebrow">{t('desk.id.tipsT')}</div>
                  <ul>{tips.map(x => <li key={x}><Icon name="check" size={16} sw={2.6} />{t(`desk.id.${x}`)}</li>)}</ul>
                </div>
                <div className="dcam__opts">
                  <label className="dcam__opt file-btn">
                    <span className="dcam__opticon"><Icon name="camera" size={22} /></span><b>{t('desk.id.camera')}</b>
                    <input type="file" accept="image/*" capture={isId ? 'environment' : 'user'} aria-label={t('desk.id.camera')} onChange={e => capture((e.target as HTMLInputElement).files?.[0])} />
                  </label>
                  <label className="dcam__opt file-btn">
                    <span className="dcam__opticon"><Icon name="image" size={22} /></span><b>{t('desk.id.upload')}</b>
                    <input type="file" accept="image/*" aria-label={t('desk.id.upload')} onChange={e => capture((e.target as HTMLInputElement).files?.[0])} />
                  </label>
                </div>
                <div className="row gap-12 mt-16">
                  <Button kind="text" block={false} onClick={() => capture()} testId="id-sample">{t('ya.id.sample')}</Button>
                  <span className="flex1" />
                  {laterBtn}
                </div>
              </>}
            </div>
          </div>
        </Screen>
      );
    }
    return (
      <Screen tone={tone} side={side} header={<TopBar onBack={() => setPhase(isId ? 'choose' : 'id')} right={laterBtn} />}
        footer={phase === 'checking' ? undefined : <Footer>
          <label className="btn btn--primary btn--block file-btn"><Icon name="camera" size={20} /><span>{t('ya.id.take')}</span>
            <input type="file" accept="image/*" capture={isId ? 'environment' : 'user'} aria-label={t('ya.id.take')} onChange={e => capture((e.target as HTMLInputElement).files?.[0])} /></label>
          <Button kind="text" onClick={() => capture()} testId="id-sample">{t('ya.id.sample')}</Button>
        </Footer>}>
        <div className="pad">
          {phase === 'checking' ? (
            <div className="success"><span className="spinner" style={{ width: 44, height: 44, borderWidth: 5 }} /><h1 className="h3 mt-8">{t('ya.id.checking')}</h1></div>
          ) : <>
            <h1 className="h1 h1--sm">{isId ? t('ya.id.capIdT', { type: t(`idTypes.${type}`) }) : t('ya.id.capSelfieT')}</h1>
            <p className="lead">{isId ? t('ya.id.capIdB') : t('ya.id.capSelfieB')}</p>
            <div className="capture">{img && <img src={img} alt="" />}<div className={`capture__frame${isId ? '' : ' capture__frame--face'}`} style={{ position: 'relative' }} /></div>
          </>}
          {steps}
        </div>
      </Screen>
    );
  }

  // ---------- choose an ID (pattern A) ----------
  return (
    <Screen tone={tone} side={side} header={<TopBar back={backTo} right={desk ? undefined : laterBtn} />} nav={<SlimHeader back={backTo} />} brand={<BrandPanel side={side} kind="id" />}
      footer={<Footer back={backTo}><Button onClick={begin} testId="id-start">{t('ya.id.start')}</Button>{desk && <Button kind="text" block={false} onClick={later} testId="id-later">{t('ya.id.later')}</Button>}<div className="footer__fine">{t(k('free'))}</div></Footer>}>
      <div className="pad">
        <span className="empty__icon" style={{ width: 60, height: 60, borderRadius: 18 }}><Icon name="id" size={30} /></span>
        <h1 className="h1 mt-14" data-testid="id-title">{t(k('title'))}</h1>
        <p className="lead">{t(k('body'))}</p>
        <div className="label mt-18">{t('ya.id.choose')}</div>
        <div className="stack gap-8 mt-10" role="radiogroup" aria-label={t('ya.id.choose')}>
          {ID_TYPES.map(id => (
            <button key={id} type="button" role="radio" aria-checked={type === id ? 'true' : 'false'} className={`id-option${type === id ? ' is-on' : ''}`} onClick={() => setType(id)}>
              <span style={{ color: 'var(--coral-deep)' }}><Icon name="id" size={22} /></span>
              <span className="flex1"><b>{id === 'philid' ? 'PhilID / ePhilID' : t(`idTypes.${id}`)}</b><small>{t(`ya.id.subs.${id}`)}</small></span>
              {id === 'philid' && <Tag tone="ok">{t('ya.id.fastest')}</Tag>}
              <span className={`radio${type === id ? ' is-on' : ''}`} />
            </button>
          ))}
        </div>
        {steps}
        <div className="spacer" />
      </div>
    </Screen>
  );
}
