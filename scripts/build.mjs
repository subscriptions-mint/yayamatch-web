// Build: bundles src/ with esbuild, inlines JS + CSS into dist/index.html, copies images to dist/assets.
//   node scripts/build.mjs           -> dist/ (index.html + assets/): the offline demo
//   node scripts/build.mjs --single  -> dist-single/index.html (images inlined, one file)
//   node scripts/build.mjs --watch   -> rebuild dist/ on change
//   node scripts/build.mjs --live    -> dist-live/: the app on Supabase. Reads from the environment:
//        YM_SUPABASE_URL, YM_SUPABASE_KEY (default: live.config.json), YM_SEED_PASSWORD, YM_APP_URL (optional)
//   --out <dir> writes somewhere else (the live e2e test uses this).
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const single = args.includes('--single');
const watch = args.includes('--watch');
const live = args.includes('--live');
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const out = outArg ? (outArg.startsWith('/') ? outArg : join(root, outArg)) : join(root, live ? (single ? 'dist-live-single' : 'dist-live') : single ? 'dist-single' : 'dist');

// Live config goes into the page as window.__YM_CONFIG__. The demo build has none.
let configJs = '';
if (live) {
  const env = process.env;
  // Public defaults live in live.config.json, so a fresh Vercel project builds without extra settings.
  const defaults = existsSync(join(root, 'live.config.json')) ? JSON.parse(readFileSync(join(root, 'live.config.json'), 'utf8')) : {};
  const url = (env.YM_SUPABASE_URL || defaults.supabaseUrl || '').trim().replace(/\/+$/, '');
  const key = (env.YM_SUPABASE_KEY || defaults.supabaseKey || '').trim();
  if (!/^https:\/\/[\w.-]+$/.test(url) || !key) {
    console.error('--live needs YM_SUPABASE_URL (https://<project>.supabase.co) and YM_SUPABASE_KEY (the publishable or anon key).');
    process.exit(1);
  }
  const cfg = { supabaseUrl: url, supabaseKey: key, mode: 'live' };
  if (env.YM_SEED_PASSWORD) cfg.seedPassword = env.YM_SEED_PASSWORD;
  if (env.YM_APP_URL) cfg.appUrl = env.YM_APP_URL.trim();
  configJs = `window.__YM_CONFIG__=${JSON.stringify(cfg).replace(/</g, '\\u003c')};`;
}

const options = {
  entryPoints: [join(root, 'src/main.tsx')],
  bundle: true,
  minify: !watch,
  format: 'iife',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  loader: { '.css': 'css' },
  write: false,
  outdir: join(root, '.build'),
  legalComments: 'none',
  logLevel: 'warning',
};

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function writeOut(result) {
  let js = '', css = '';
  for (const f of result.outputFiles) {
    if (f.path.endsWith('.js')) js = f.text;
    else if (f.path.endsWith('.css')) css = f.text;
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const assetsDir = join(root, 'public/assets');
  const files = readdirSync(assetsDir);
  let assetMap = {};
  if (single) {
    for (const f of files) {
      assetMap[f] = `data:${MIME[extname(f)] || 'application/octet-stream'};base64,${readFileSync(join(assetsDir, f)).toString('base64')}`;
    }
  } else {
    mkdirSync(join(out, 'assets'), { recursive: true });
    for (const f of files) { copyFileSync(join(assetsDir, f), join(out, 'assets', f)); assetMap[f] = `assets/${f}`; }
  }
  const template = readFileSync(join(root, 'src/index.html'), 'utf8');
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const html = template
    .replace('/*__CSS__*/', () => css)
    .replace('/*__ASSETS__*/', () => `window.__YM_ASSETS__=${JSON.stringify(assetMap)};${configJs}`)
    .replace('/*__JS__*/', () => safeJs);
  writeFileSync(join(out, 'index.html'), html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`built ${out}/index.html (${kb} KB)${single ? ' with inlined images' : ` + ${files.length} assets`}${live ? ' · live mode' : ''}`);
}

if (watch) {
  const ctx = await context({ ...options, plugins: [{ name: 'out', setup(b) { b.onEnd(r => { if (!r.errors.length) writeOut(r); }); } }] });
  await ctx.watch();
  console.log('watching src/ …');
} else {
  const result = await build(options);
  writeOut(result);
}
