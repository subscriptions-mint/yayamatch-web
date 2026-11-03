// Fails if en.ts and tl.ts do not have exactly the same keys (and array lengths).
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const load = async f => {
  const r = await build({ entryPoints: [f], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  const mod = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  return mod;
};
const { en } = await load(new URL('../src/i18n/en.ts', import.meta.url).pathname);
const { tl } = await load(new URL('../src/i18n/tl.ts', import.meta.url).pathname);
const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, p + k + '.') : [[p + k, Array.isArray(v) ? v.length : typeof v]]));
const a = new Map(keys(en)), b = new Map(keys(tl));
let bad = 0;
for (const [k, v] of a) if (!b.has(k) || b.get(k) !== v) { console.log('tl missing/mismatch:', k); bad++; }
for (const k of b.keys()) if (!a.has(k)) { console.log('en missing:', k); bad++; }
console.log(`${a.size} keys checked, ${bad} problems`);
process.exit(bad ? 1 : 0);
