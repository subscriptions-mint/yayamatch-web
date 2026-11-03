import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { ICONS } from './icons';
import { nav, back as goBack } from '../lib/router';
import { useUi, dismissToast } from '../lib/store';
import { CITY_KEYS, CITIES, POPULAR_CITIES, type City } from '../data/constants';
import { useT } from '../lib/i18n';
import { setLang } from '../lib/actions';
import { useIsDesktop } from '../lib/useIsDesktop';

declare global { interface Window { __YM_ASSETS__?: Record<string, string> } }
// Bundled images by file name; data:, blob: and http(s) URLs (live uploads) pass through.
export const asset = (name: string) => (/^(data:|blob:|https?:)/.test(name) ? name : (window.__YM_ASSETS__?.[name] ?? `assets/${name}`));

// ---------- icon ----------
export function Icon({ name, size = 20, sw = 2, fill, label, className }: { name: string; size?: number; sw?: number; fill?: string; label?: string; className?: string }) {
  const shapes = ICONS[name] ?? [];
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill ?? 'none'} stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      {shapes.map((s, i) => s[0] === 'p' ? <path key={i} d={s[1]} /> : s[0] === 'c' ? <circle key={i} cx={s[1]} cy={s[2]} r={s[3]} /> : <rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} />)}
    </svg>
  );
}

// ---------- layout ----------
// Desktop (>= 1024px): `nav` renders at the top (DesktopNav or SlimHeader), `brand` switches to the split
// onboarding layout (pattern A), `desk` adds a `d-<name>` class for page-specific CSS, `wide` uses the
// wider page container. On phones these props are ignored and the markup is unchanged.
export function Screen({ children, tone = 'cream', side, header, footer, tabbar, overlay, scrollRef, label, nav, brand, desk, wide }: {
  children?: ReactNode; tone?: 'cream' | 'blush' | 'white'; side?: 'family' | 'yaya'; header?: ReactNode; footer?: ReactNode; tabbar?: ReactNode; overlay?: ReactNode;
  scrollRef?: { current: HTMLDivElement | null }; label?: string; nav?: ReactNode; brand?: ReactNode; desk?: string; wide?: boolean;
}) {
  const local = useRef<HTMLDivElement | null>(null);
  const ref = scrollRef ?? local;
  const isDesk = useIsDesktop();
  useEffect(() => { ref.current?.scrollTo?.(0, 0); if (isDesk) window.scrollTo(0, 0); }, []);
  if (isDesk) {
    const cls = `screen screen--${tone}${side === 'yaya' ? ' screen--yaya' : ''}${desk ? ' d-' + desk : ''}`;
    if (brand) {
      return (
        <div className={`${cls} screen--split`} aria-label={label}>
          {nav}
          <div className="split">
            <aside className="split__brand">{brand}</aside>
            <div className="split__form">{header}<main className="scroll" ref={ref}>{children}</main>{footer}</div>
          </div>
          {overlay}
        </div>
      );
    }
    return (
      <div className={`${cls} screen--desk`} aria-label={label}>
        {nav}
        <div className={`page${wide ? ' page--wide' : ''}`}>{header}<main className="scroll" ref={ref}>{children}</main>{footer}</div>
        {overlay}
      </div>
    );
  }
  return (
    <div className={`screen screen--${tone}${side === 'yaya' ? ' screen--yaya' : ''}`} aria-label={label}>
      {header}
      <main className="scroll" ref={ref}>{children}</main>
      {footer}
      {tabbar}
      {overlay}
    </div>
  );
}

export function TopBar({ back, onBack, title, sub, right }: { back?: string; onBack?: () => void; title?: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  const t = useT();
  const doBack = onBack ?? (back ? () => goBack(back) : undefined);
  return (
    <header className="topbar">
      {doBack && <IconButton name="back" label={t('common.back')} onClick={doBack} />}
      <div className="topbar__title">{title && <b>{title}</b>}{sub && <span>{sub}</span>}</div>
      {right}
    </header>
  );
}

export function Progress({ n, total, label }: { n: number; total: number; label: string }) {
  return (
    <div className="progress" aria-label={label}>
      <div className="progress__bars" aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</div>
      <span>{label}</span>
    </div>
  );
}

// `back`: on desktop the footer becomes an inline row with a Back ghost button on the left (pattern A).
export function Footer({ children, bar, row, back }: { children?: ReactNode; bar?: boolean; row?: boolean; back?: string | (() => void) }) {
  const isDesk = useIsDesktop();
  const t = useT();
  if (isDesk) {
    const onBack = typeof back === 'function' ? back : back ? () => goBack(back) : undefined;
    return (
      <div className="footer footer--desk">
        {onBack && <Button kind="ghost" block={false} icon="back" onClick={onBack} className="footer__back">{t('common.back')}</Button>}
        <div className="footer__actions">{children}</div>
      </div>
    );
  }
  return <div className={`footer${bar ? ' footer--bar' : ''}${row ? ' footer--row' : ''}`}>{children}</div>;
}

export function Section({ title, action, children, className = '' }: { title: ReactNode; action?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`section ${className}`}>
      <div className="section__head"><h2 className="h2">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

// ---------- buttons ----------
type BtnKind = 'primary' | 'navy' | 'ghost' | 'soft' | 'ok' | 'text';
export function Button({ children, kind = 'primary', onClick, to, param, icon, iconRight, block = true, size, disabled, type = 'button', className = '', style, testId }: {
  children?: ReactNode; kind?: BtnKind; onClick?: () => void; to?: string; param?: string; icon?: string; iconRight?: string; block?: boolean; size?: 'sm' | 'md';
  disabled?: boolean; type?: 'button' | 'submit'; className?: string; style?: CSSProperties; testId?: string;
}) {
  const cls = `btn btn--${kind}${block ? ' btn--block' : ''}${size ? ' btn--' + size : ''} ${className}`;
  const handle = () => { if (disabled) return; onClick?.(); if (to) nav(to, param); };
  return (
    <button type={type} className={cls} onClick={type === 'submit' && !to && !onClick ? undefined : handle} disabled={disabled} style={style} data-testid={testId}>
      {icon && <Icon name={icon} size={20} />}<span>{children}</span>{iconRight && <Icon name={iconRight} size={20} />}
    </button>
  );
}

export function IconButton({ name, label, onClick, to, param, variant = '', size = 20, dot, testId, sw }: {
  name: string; label: string; onClick?: () => void; to?: string; param?: string; variant?: string; size?: number; dot?: boolean; testId?: string; sw?: number;
}) {
  return (
    <button type="button" className={`iconbtn ${variant}`} aria-label={label} title={label} data-testid={testId}
      onClick={() => { onClick?.(); if (to) nav(to, param); }}>
      <Icon name={name} size={size} sw={sw} />{dot && <span className="dot" />}
    </button>
  );
}

// ---------- chips & tags ----------
export function Chip({ children, on, onClick, icon, small, add, testId }: { children?: ReactNode; on?: boolean; onClick?: () => void; icon?: string; small?: boolean; add?: boolean; testId?: string }) {
  return (
    <button type="button" className={`chip${on ? ' is-on' : ''}${small ? ' chip--sm' : ''}${add ? ' chip--add' : ''}`} aria-pressed={on ? 'true' : 'false'} onClick={onClick} data-testid={testId}>
      {on && !icon && !add && <Icon name="check" size={16} />}
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
}

export function Tag({ children, tone = 'coral', icon }: { children?: ReactNode; tone?: 'coral' | 'ok' | 'white' | 'muted' | 'navy' | 'warn' | 'solid'; icon?: string }) {
  return <span className={`tag${tone !== 'coral' ? ' tag--' + tone : ''}`}>{icon && <Icon name={icon} size={13} sw={2.4} />}{children}</span>;
}

export function Tile({ icon, title, sub, on, onClick, testId }: { icon: string; title: string; sub: string; on?: boolean; onClick?: () => void; testId?: string }) {
  return (
    <button type="button" className={`tile${on ? ' is-on' : ''}`} aria-pressed={on ? 'true' : 'false'} onClick={onClick} data-testid={testId}>
      {on && <span className="tile__check"><Icon name="check" size={14} sw={3} /></span>}
      <span className="tile__icon"><Icon name={icon} size={22} /></span>
      <span><b>{title}</b><small>{sub}</small></span>
    </button>
  );
}

// ---------- forms ----------
export function Field({ label, value, onChange, prefix, icon, hint, error, inputMode, maxLength, placeholder, autoFocus, testId, onEnter, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; icon?: string; hint?: ReactNode; error?: string | null; inputMode?: string;
  maxLength?: number; placeholder?: string; autoFocus?: boolean; testId?: string; onEnter?: () => void; type?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <div className={`input${error ? ' is-error' : ''}`}>
        {icon && <span className="input__icon"><Icon name={icon} size={20} /></span>}
        {prefix && <span className="input__prefix">{prefix}</span>}
        <input id={id} type={type} value={value} inputMode={inputMode} maxLength={maxLength} placeholder={placeholder} autoFocus={autoFocus} data-testid={testId}
          aria-invalid={error ? 'true' : 'false'} onChange={e => onChange((e.target as HTMLInputElement).value)}
          onKeyDown={e => { if (e.key === 'Enter') onEnter?.(); }} />
      </div>
      {error ? <div className="error" role="alert">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function Segmented<V extends string>({ options, value, onChange, label }: { options: { v: V; label: string }[]; value: V; onChange: (v: V) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(o => <button key={o.v} type="button" className={o.v === value ? 'is-on' : ''} aria-pressed={o.v === value ? 'true' : 'false'} onClick={() => onChange(o.v)}>{o.label}</button>)}
    </div>
  );
}

export function Toggle({ on, onChange, label, testId }: { on: boolean; onChange: (v: boolean) => void; label: string; testId?: string }) {
  return <button type="button" role="switch" aria-checked={on ? 'true' : 'false'} aria-label={label} className="toggle" onClick={() => onChange(!on)} data-testid={testId}><span /></button>;
}

export function Stepper({ label, sub, value, onDec, onInc, decDisabled, incDisabled }: { label: string; sub?: string; value: string; onDec: () => void; onInc: () => void; decDisabled?: boolean; incDisabled?: boolean }) {
  const t = useT();
  return (
    <div className="stepper">
      <div className="flex1"><div className="strong" style={{ fontSize: 16 }}>{label}</div>{sub && <div className="small muted">{sub}</div>}</div>
      <button type="button" className="stepper__btn" aria-label={`${t('ya.looking.less')}: ${label}`} onClick={onDec} disabled={decDisabled}><Icon name="minus" size={18} /></button>
      <span className="stepper__val" aria-live="polite">{value}</span>
      <button type="button" className="stepper__btn" aria-label={`${t('ya.looking.more')}: ${label}`} onClick={onInc} disabled={incDisabled}><Icon name="plus" size={18} /></button>
    </div>
  );
}

export function DayPicker({ value, onChange, label }: { value: string[]; onChange: (v: string[]) => void; label: string }) {
  const t = useT();
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const short = t.raw<Record<string, string>>('days');
  const long = t.raw<Record<string, string>>('daysLong');
  return (
    <div className="days" role="group" aria-label={label}>
      {days.map(d => {
        const on = value.includes(d);
        return <button key={d} type="button" className={on ? 'is-on' : ''} aria-pressed={on ? 'true' : 'false'} aria-label={long[d]}
          onClick={() => onChange(on ? value.filter(x => x !== d) : [...value, d])}>{short[d]}</button>;
      })}
    </div>
  );
}

export function RangeSlider({ min, max, step, low, high, onChange, labelLow, labelHigh }: {
  min: number; max: number; step: number; low: number; high: number; onChange: (lo: number, hi: number) => void; labelLow: string; labelHigh: string;
}) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="range">
      <div className="range__track" />
      <div className="range__fill" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
      <input type="range" min={min} max={max} step={step} value={low} aria-label={labelLow}
        onChange={e => { const v = Number((e.target as HTMLInputElement).value); onChange(Math.min(v, high - step), high); }} />
      <input type="range" min={min} max={max} step={step} value={high} aria-label={labelHigh}
        onChange={e => { const v = Number((e.target as HTMLInputElement).value); onChange(low, Math.max(v, low + step)); }} />
    </div>
  );
}

export function CitySearch({ value, onChange, label, testId }: { value: City | null; onChange: (c: City) => void; label: string; testId?: string }) {
  const t = useT();
  const names = t.raw<Record<string, string>>('cities');
  const [q, setQ] = useState(value ? names[value] : '');
  const [open, setOpen] = useState(false);
  useEffect(() => { if (value && !open) setQ(names[value]); }, [value, t.lang]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || (value && names[value] === q)) return POPULAR_CITIES;
    return CITY_KEYS.filter(c => names[c].toLowerCase().includes(s) || c.includes(s) || CITIES[c].aliases.some(a => a.includes(s) || s.includes(a)));
  }, [q, t.lang]);
  return (
    <div className="field">
      <Field label={label} value={q} icon="search" placeholder={t('city.search')} testId={testId}
        onChange={v => { setQ(v); setOpen(true); }} />
      {open && (
        <div className="card mt-4" style={{ padding: 6 }} role="listbox" aria-label={label}>
          {results.length === 0 && <div className="small muted" style={{ padding: 10 }}>{t('city.none')}</div>}
          {results.slice(0, 7).map(c => (
            <button key={c} type="button" role="option" aria-selected={c === value ? 'true' : 'false'} className="menu-item" style={{ padding: '11px 8px' }}
              onClick={() => { onChange(c); setQ(names[c]); setOpen(false); }}>
              <Icon name="pin" size={18} /><span className="flex1">{names[c]}</span>{c === value && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- display ----------
export function Card({ children, className = '', style, tone }: { children?: ReactNode; className?: string; style?: CSSProperties; tone?: 'flat' | 'navy' | 'blush' | 'cream' }) {
  return <div className={`card${tone ? ' card--' + tone : ''} ${className}`} style={style}>{children}</div>;
}

export function Note({ children, icon = 'info', tone = 'ok', className = '', bar }: { children?: ReactNode; icon?: string; tone?: 'ok' | 'warn' | 'white' | 'info'; className?: string; bar?: boolean }) {
  return <div className={`note${tone !== 'ok' ? ' note--' + tone : ''}${bar ? ' note--bar' : ''} ${className}`}><Icon name={icon} size={16} /><span>{children}</span></div>;
}

export function Avatar({ src, size = 48, initials, square, ring, bg }: { src?: string | null; size?: number; initials?: string; square?: boolean; ring?: string; bg?: string }) {
  const style: CSSProperties = { width: size, height: size, borderRadius: square ? Math.round(size * 0.3) : 999, ...(ring ? { boxShadow: `0 0 0 3px ${ring}` } : {}) };
  if (src) return <img className="avatar" src={asset(src)} alt="" style={style} />;
  return <span className="avatar avatar--initials" style={{ ...style, fontSize: Math.round(size * 0.36), background: bg ?? 'var(--navy)' }} aria-hidden="true">{initials}</span>;
}

export function CheckRow({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <div className="check-row">
      <span className={`check-row__icon${ok ? '' : ' no'}`}><Icon name={ok ? 'check' : 'minus'} size={16} sw={ok ? 2.6 : 2} /></span>
      <div className="flex1"><b>{title}</b><span>{detail}</span></div>
    </div>
  );
}

export function Fact({ icon, children, size }: { icon: string; children?: ReactNode; size?: number }) {
  return <span className="fact" style={size ? { fontSize: size } : undefined}><Icon name={icon} size={16} />{children}</span>;
}

export function ValueRow({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return <div className="value-row"><span className="value-row__icon"><Icon name={icon} size={20} /></span><div><b>{title}</b><small>{sub}</small></div></div>;
}

export function TabBar({ items, active }: { items: { icon: string; label: string; to: string; badge?: number }[]; active: string }) {
  const t = useT();
  return (
    <nav className="tabbar" aria-label={t('tabs.nav')}>
      {items.map(it => (
        <a key={it.label} href={'#' + it.to} aria-current={it.label === active ? 'page' : undefined}>
          <Icon name={it.icon} size={24} sw={it.label === active ? 2.2 : 1.8} />
          {it.badge ? <span className="tabbar__badge">{it.badge}</span> : null}
          {it.label}
        </a>
      ))}
    </nav>
  );
}

// On desktop the same sheet is a centered modal (pattern B): see the `.sheet` rules in the desktop CSS block.
export function Sheet({ title, onClose, children, actions, icon, testId, wide }: { title?: ReactNode; onClose: () => void; children?: ReactNode; actions?: ReactNode; icon?: ReactNode; testId?: string; wide?: boolean }) {
  const t = useT();
  const isDesk = useIsDesktop();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('button, [href], input, textarea');
    first?.focus();
  }, []);
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className={`sheet${wide ? ' sheet--wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref} data-testid={testId}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
        <div className="sheet__grip" aria-hidden="true" />
        {(title || icon) ? (
          <div className="sheet__head">
            {icon}
            {title && <h2 className="sheet__title">{title}</h2>}
            <IconButton name="x" label={t('common.close')} onClick={onClose} variant="iconbtn--plain" />
          </div>
        ) : isDesk ? <span className="sheet__x"><IconButton name="x" label={t('common.close')} onClick={onClose} variant="iconbtn--plain" /></span> : null}
        <div className="sheet__body">{children}</div>
        {actions && <div className="sheet__actions">{actions}</div>}
      </div>
    </>
  );
}

export function Toasts() {
  const toasts = useUi(s => s.toasts);
  return (
    <div className="toasts" aria-live="polite" role="status">
      {toasts.map(tt => (
        <div key={tt.id} className={`toast${tt.tone === 'ok' ? ' toast--ok' : ''}`}>
          <span className="flex1">{tt.text}</span>
          {tt.action && <button type="button" onClick={() => { tt.action!.run(); dismissToast(tt.id); }}>{tt.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

export function Waveform({ bars = 30, progress = 0, recording = false }: { bars?: number; progress?: number; recording?: boolean }) {
  const hs = useMemo(() => Array.from({ length: bars }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37))), [bars]);
  return (
    <span className={`wave${recording ? ' is-rec' : ''}`} aria-hidden="true">
      {hs.map((h, i) => <i key={i} className={i / bars < progress ? 'on' : ''} style={{ height: `${Math.round(h * 24)}px`, animationDelay: `${(i % 7) * 0.08}s` }} />)}
    </span>
  );
}

export function QrCode({ seed = 7, label }: { seed?: number; label: string }) {
  const cells = useMemo(() => {
    let x = seed * 9301 + 49297;
    const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
    const out: [number, number][] = [];
    for (let yy = 0; yy < 25; yy++) for (let xx = 0; xx < 25; xx++) {
      const inF = (xx < 8 && yy < 8) || (xx > 16 && yy < 8) || (xx < 8 && yy > 16);
      if (!inF && rnd() < 0.48) out.push([xx, yy]);
    }
    return out;
  }, [seed]);
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}><rect x={x} y={y} width="7" height="7" fill="#1E2559" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#1E2559" /></g>
  );
  return (
    <svg viewBox="0 0 25 25" role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width="25" height="25" fill="#fff" />
      {finder(0, 0)}{finder(18, 0)}{finder(0, 18)}
      {cells.map(([a, b]) => <rect key={`${a}.${b}`} x={a} y={b} width="1" height="1" fill="#1E2559" />)}
    </svg>
  );
}

export function Empty({ icon, title, body, children }: { icon: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty__icon"><Icon name={icon} size={28} /></span>
      <h2 className="h3">{title}</h2>
      {body && <p className="muted small" style={{ fontSize: 14 }}>{body}</p>}
      {children}
    </div>
  );
}

export function LangToggle() {
  const t = useT();
  return (
    <div className="lang-toggle" role="group" aria-label={t('common.language')}>
      {(['en', 'tl'] as const).map(l => (
        <button key={l} type="button" className={t.lang === l ? 'is-on' : ''} aria-pressed={t.lang === l ? 'true' : 'false'}
          onClick={() => setLang(l)}>{l === 'en' ? 'EN' : 'TL'}</button>
      ))}
    </div>
  );
}

// File picker that turns an image into a small data URL (works inside sandboxed frames, no camera API needed).
export function readImage(file: File, max = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      try { resolve(c.toDataURL('image/jpeg', 0.82)); } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
}
