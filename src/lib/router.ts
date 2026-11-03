// Hash router using plain #names (letters, digits, hyphens), which is what the Claude page frame passes through.
import { useSyncExternalStore } from 'react';

export interface Route { name: string; param?: string }

const PARAM_PREFIXES = ['f-helper-', 'f-match-', 'f-chat-', 'f-hired-', 'y-family-', 'y-match-', 'y-chat-', 'y-hired-'];

export function parse(hash: string): Route {
  const h = decodeURIComponent(hash.replace(/^#/, '')).trim();
  if (!h) return { name: 'welcome' };
  for (const p of PARAM_PREFIXES) {
    if (h.startsWith(p) && h.length > p.length) return { name: p.slice(0, -1), param: h.slice(p.length) };
  }
  return { name: h };
}

export function href(name: string, param?: string): string {
  return '#' + name + (param ? '-' + param : '');
}

const stack: string[] = [];
let current = typeof location !== 'undefined' ? location.hash : '';
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }

if (typeof window !== 'undefined') {
  stack.push(current || '#welcome');
  window.addEventListener('hashchange', () => {
    const h = location.hash || '#welcome';
    if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop();
    else if (stack[stack.length - 1] !== h) stack.push(h);
    current = location.hash;
    emit();
  });
}

export function nav(name: string, param?: string, opts: { replace?: boolean } = {}): void {
  const h = href(name, param);
  if (h === (location.hash || '#welcome')) return;
  if (opts.replace) {
    try { history.replaceState(null, '', h); } catch { location.replace(h); }
    stack[stack.length - 1] = h;
    current = h;
    emit();
  } else {
    location.hash = h;
  }
}

export function back(fallback: string, param?: string): void {
  if (stack.length > 1) history.back();
  else nav(fallback, param, { replace: true });
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

export function useRoute(): Route {
  const h = useSyncExternalStore(subscribe, () => current);
  return parse(h);
}
