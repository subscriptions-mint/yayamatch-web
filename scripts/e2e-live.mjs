// Live mode end to end, against an in-memory mock of the Supabase project (scripts/mock-supabase.mjs).
//   node scripts/e2e-live.mjs [--width 390|360|1440|1280] [--height px] [--shots dir] [--full]
// Builds the live app into .live-test/ (it never touches dist-live/), serves it as https://yayamatch.test/,
// and answers https://qvczthltbdefwefpsncd.supabase.co/** with the mock. Realtime is refused, so chat must
// work on polling alone.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { build } from 'esbuild';
import { createMock } from './mock-supabase.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const shotsDir = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const width = args.includes('--width') ? Number(args[args.indexOf('--width') + 1]) : 390;
const desk = width >= 1024;
const height = args.includes('--height') ? Number(args[args.indexOf('--height') + 1]) : width >= 1400 ? 900 : desk ? 800 : 844;
const fullPage = args.includes('--full');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const SUPA = 'https://qvczthltbdefwefpsncd.supabase.co';
const APP = 'https://yayamatch.test/';
const SEED_PW = 'sample-pass-123';
const out = join(root, '.live-test');

execFileSync(process.execPath, [join(root, 'scripts/build.mjs'), '--live', '--out', out], {
  env: { ...process.env, YM_SUPABASE_URL: SUPA, YM_SUPABASE_KEY: 'sb_publishable_test_key', YM_SEED_PASSWORD: SEED_PW, YM_APP_URL: APP },
  stdio: ['ignore', 'ignore', 'inherit'],
});

const load = async f => {
  const r = await build({ entryPoints: [f], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const { HELPERS } = await load(join(root, 'src/data/helpers.ts'));
const { HOUSEHOLDS } = await load(join(root, 'src/data/households.ts'));
const mock = createMock({ helpers: HELPERS, households: HOUSEHOLDS, seedPassword: SEED_PW, appUrl: APP });

let pass = 0, fail = 0;
let page = null;
const check = (cond, msg) => {
  if (cond) { pass++; return; }
  fail++; console.log('FAIL:', msg);
  if (shotsDir && page) void page.screenshot({ path: join(shotsDir, `FAIL-${fail}.png`) }).catch(() => {});
};

const MIME = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript' };
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, prefer, x-upsert, cache-control, x-client-info',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
await context.routeWebSocket(/\/realtime\//, ws => { ws.close(); }); // realtime is absent: polling must carry chat
await context.route('**/*', async route => {
  const req = route.request();
  const url = req.url();
  if (url.startsWith(APP)) {
    const path = new URL(url).pathname.replace(/^\/+/, '') || 'index.html';
    const file = join(out, path);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }, body: readFileSync(file) });
  }
  if (url.startsWith(SUPA)) {
    const headers = req.headers();
    const buf = req.postDataBuffer();
    let body = null;
    if (buf && /json/.test(headers['content-type'] ?? '')) { try { body = JSON.parse(buf.toString()); } catch { body = null; } }
    const r = await mock.handle({ url, method: req.method(), headers, body, raw: buf });
    if (r.html) return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: r.html });
    if (r.raw) return route.fulfill({ status: r.status, headers: { ...CORS, 'content-type': r.type ?? 'application/octet-stream' }, body: r.raw });
    return route.fulfill({ status: r.status, headers: { ...CORS, 'content-type': 'application/json' }, body: r.body == null ? '' : JSON.stringify(r.body) });
  }
  return route.abort();
});

page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource|WebSocket/.test(m.text())) errors.push(m.text()); });

const wait = ms => page.waitForTimeout(ms);
const tid = id => page.getByTestId(id);
const hash = () => page.evaluate(() => location.hash);
const text = () => page.evaluate(() => document.querySelector('.app')?.innerText ?? '');
const has = async s => (await text()).includes(s);
async function until(fn, ms = 9000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { /* not yet */ } await wait(150); }
  return false;
}
const visible = id => until(() => tid(id).first().isVisible());
const at = h => until(async () => (await hash()) === h || (h.endsWith('-') && (await hash()).startsWith(h)));
const uidOf = email => mock.users.get(email)?.id;
let n = 0;
async function shot(name) {
  await wait(300);
  const over = await page.evaluate(() => {
    const o = []; const w = document.querySelector('.app')?.getBoundingClientRect();
    if (!w) return o;
    document.querySelectorAll('.app *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || el.closest('.chips--scroll, .starters, .convs__fresh, .admin__tabs, [style*="overflow"]')) return;
      if (r.right > w.right + 1.5 || r.left < w.left - 1.5) o.push(`${el.tagName}.${el.className}`.slice(0, 60));
    });
    return o.slice(0, 4);
  });
  check(over.length === 0, `${name}: content outside the screen ${JSON.stringify(over)}`);
  if (desk) {
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(wide <= 1, `${name}: page scrolls sideways by ${wide}px`);
  }
  if (shotsDir) await page.screenshot({ path: join(shotsDir, `${String(++n).padStart(2, '0')}-${name}.png`), fullPage });
}
async function codeSignIn(email) {
  await page.goto(APP + '#welcome');
  await visible('signin-email');
  await tid('signin-email').click();
  await at('#auth-email');
  await tid('email').fill(email);
  await tid('email-send').click();
  await at('#auth-code');
  const code = mock.mail[email];
  for (let i = 0; i < 6; i++) await tid(`otp-${i}`).fill(code[i]);
}
async function signOut() {
  const side = await page.evaluate(() => JSON.parse(localStorage.getItem('yayamatch-live-v1') || '{}').live?.side);
  await page.goto(APP + (side === 'yaya' ? '#y-me' : '#f-me'));
  await visible('logout');
  await tid('logout').click();
  await visible('signin');
}
const localState = () => page.evaluate(() => JSON.parse(localStorage.getItem('yayamatch-live-v1') || '{}'));

// ================= signed out =================
await page.goto(APP);
await visible('signin');
check(await tid('signin-facebook').isVisible() && await tid('signin-google').isVisible() && await tid('signin-email').isVisible(), 'Facebook, Google and email sign-in');
check(await tid('samples').isVisible(), 'staging: sample accounts listed');
check(await has('Sample account'), 'sample accounts are marked');
check(!(await page.locator('[data-testid=path-family]').count()), 'no side choice before sign-in');
check(!(await has('Mobile number')) && !(await has('Use demo code')), 'no phone sign-in in live mode');
check(!(await has('Working demo')), 'no demo badge in live mode');
await shot('welcome');

// provider turned off -> ?error= -> friendly toast, clean URL
await tid('signin-facebook').click();
check(await until(() => has('not turned on yet')), 'provider off: friendly toast');
check(!page.url().includes('error='), 'error query removed from the URL');

// Google: returns with #access_token
await tid('signin-google').click();
check(await visible('side-picker'), 'OAuth return signs in, then asks for a side');
check(!page.url().includes('access_token'), 'token hash removed from the URL');
check(await has('oauth.google@example.com'), 'signed in as the OAuth email');
await shot('side-picker');
await tid('signout').click();
check(await visible('signin'), 'sign out from the side picker');

// ================= sample sign-in (Santos) =================
mock.calls.length = 0;
await tid('sample-family').click();
check(await at('#f-discover'), 'sample family lands on Discover');
check(mock.calls.includes('rpc:reset_my_demo'), 'reset_my_demo after a sample sign-in');
check(mock.calls.indexOf('rpc:reset_my_demo') < mock.calls.lastIndexOf('rpc:sample_ids'), 'reset runs before the data loads');
check(await visible('helper-card'), 'sample helpers in the deck');
check(await tid('sample-tag').first().isVisible(), '"Sample profile" tag on sample cards');
check((await tid('likes-left').innerText()).includes('10 free likes'), 'free likes from the server');
check(!Object.values((await localState()).live.helpers).some(h => h.firstName === 'Joy'), 'sample sign-in only sees sample cards');
await shot('f-discover-sample');
await signOut();

// ================= test account: email + password, no reset =================
await tid('test-account-open').click();
check(await visible('test-account'), 'staging: test-account sign-in opens');
await tid('test-email').fill('santos.seed@example.com');
await tid('test-password').fill('wrong-password');
await tid('test-signin').click();
check(await until(() => has('Sign-in did not work')), 'test account: wrong password is refused');
mock.calls.length = 0;
await tid('test-password').fill(SEED_PW);
await tid('test-signin').click();
check(await at('#f-discover'), 'test account signs in with a password');
check(!mock.calls.includes('rpc:reset_my_demo'), 'test account sign-in does not reset anything');
await signOut();

// ================= email code: a new family =================
await tid('signin-email').click();
check(await at('#auth-email'), 'email screen');
await tid('email').fill('not-an-email');
await tid('email-send').click();
check(await has('valid email'), 'email validation');
await shot('auth-email');
await tid('email').fill('carla@example.com');
await tid('email-send').click();
check(await at('#auth-code'), 'code screen');
check((await tid('code-body').innerText()).includes('carla@example.com'), 'code screen names the email');
check(await has('sign-in link'), 'mentions the magic-link fallback');
for (let i = 0; i < 6; i++) await tid(`otp-${i}`).fill('0');
check(await until(() => has('does not match')), 'wrong code');
await shot('auth-code');
const code = mock.mail['carla@example.com'];
for (let i = 0; i < 6; i++) await tid(`otp-${i}`).fill(code[i]);
check(await visible('side-picker'), 'new account picks a side');
const carla = uidOf('carla@example.com');
await tid('path-family').click();
check(await at('#f-needs'), 'family side -> onboarding');
check(mock.prof(carla).side === 'family' && mock.prof(carla).lang === 'en', 'side and language saved');
check(!(await has('Sample answers')), 'no sample answers prefilled in live mode');
await tid('role-nanny').click();
await tid('next').click();
check(await at('#f-home'), 'needs -> home');
await tid('family-name').fill('Cruz');
await tid('city').fill('makat');
await page.getByRole('option', { name: /Makati/ }).click();
await tid('next').click();
check(await at('#f-setup'), 'home -> setup');
await tid('see-matches').click();
check(await at('#f-discover'), 'finish -> Discover');
check(await visible('helper-card'), 'deck after onboarding');
check(mock.calls.includes('rpc:finish_onboarding'), 'finish_onboarding called');
const card = mock.T.families.find(f => f.id === carla);
check(card?.family_name === 'Cruz' && card?.city === 'makati' && card?.needs.includes('nanny'), 'family card upserted');
check(await until(() => has('helpers already liked your family')), 'liked-you count without a pass (seed_likes_new)');
await shot('f-discover');

// like -> match (sample like-back)
await tid('like').click();
check(await at('#f-match-'), 'like a sample -> instant match');
const helperId = (await hash()).replace('#f-match-', '');
await shot('f-match');
await tid('say-hello').click();
check(await at('#f-chat-'), 'match -> chat');
check(await visible('id-gate'), 'household ID check before the first message');
check(!(await tid('composer').count()), 'no composer before the ID check');
await shot('f-chat-gate');
await tid('id-gate-start').click();
check(await at('#f-idcheck'), 'gate -> household ID check');
check((await tid('id-title').innerText()) === 'Household ID check', 'household ID screen');
await shot('f-idcheck');
await tid('id-start').click();
check(await visible('id-sample'), 'test mode keeps the photo screens');
check(mock.calls.includes('fn:id-check-start'), 'id-check-start called');
await tid('id-sample').click(); await wait(500);
await tid('id-sample').click();
check(await until(() => has('household ID is checked')), 'test-mode ID check passes');
check(mock.T.checks.some(c => c.user_id === carla && c.kind === 'household_id' && c.status === 'passed'), 'id-check-test stored the result');
await shot('f-id-done');
await tid('id-continue').click();
check(await at('#f-chat-' + helperId), 'back to the chat');
await tid('composer').fill('Hello po! Kami po ang Cruz family sa Makati.');
await tid('send').click();
check(await until(async () => (await page.locator('.bubble--them').count()) >= 1), 'sample auto-reply shows up');
check(await visible('locked-card'), 'free opener used -> locked');
const match = mock.T.matches.find(m => m.family_id === carla && m.helper_id === helperId);
mock.T.messages.push({ id: randomUUID(), match_id: match.id, sender_id: helperId, kind: 'text', body: 'Pwede po ako sa Lunes.', meta: {}, created_at: new Date().toISOString() });
check(await until(() => has('Pwede po ako sa Lunes.'), 9000), 'new message arrives by polling (no realtime)');
await shot('f-chat-locked');

// test-mode checkout -> pass -> likes visible
await tid('keep-chatting').click();
check(await at('#f-plans'), 'locked -> plans');
await tid('plan-pass').click();
await tid('plans-continue').click();
check(await at('#f-checkout'), 'plans -> checkout (test mode)');
check(mock.calls.includes('fn:checkout'), 'checkout function called');
check(await has('Test mode: no money moves'), 'test-mode label');
await tid('method-card').click();
await tid('card-name').fill('Carla Cruz');
await tid('pay').click();
check(await until(() => has('Payment received')), 'checkout-test -> paid');
check(mock.T.purchases.some(p => p.user_id === carla && p.item === 'pass' && p.status === 'paid'), 'purchase paid on the server');
await shot('f-paid');
await tid('checkout-done').click();
check(await at('#f-chat-' + helperId), 'back to the chat');
check(await until(async () => !(await tid('composer').isDisabled())), 'chat open with a pass');
await page.goto(APP + '#f-discover');
check(await until(async () => (await tid('likes-left').innerText()).includes('Unlimited')), 'pass active: unlimited likes');
await page.goto(APP + '#f-likes');
check(await until(async () => (await page.locator('[data-testid^=like-back-]').count()) >= 1), 'pass active: likes visible');
await shot('f-likes-open');

// plan a call or meeting
await page.goto(APP + '#f-chat-' + helperId);
await visible('chat-plan');
check(!(await page.locator('[data-testid=chat-video]').count()), 'no video button');
await tid('chat-plan').click();
check(await visible('plan-sheet'), 'plan sheet');
await tid('plan-how-in_person').click();
await tid('plan-note').fill('SM Megamall food court');
await shot('f-plan-sheet');
await tid('plan-send').click();
check(await until(() => tid('plan-card').first().isVisible()), 'plan card in the chat');
const planRow = mock.T.messages.find(m => m.match_id === match.id && m.kind === 'plan');
check(planRow?.meta?.how === 'in_person' && planRow?.meta?.note === 'SM Megamall food court' && !!planRow?.meta?.when, 'plan message with when/how/note');
check(await has('In person'), 'plan card shows how');
await shot('f-chat-plan');

// mark hired -> checklist
await tid('chat-more').click();
await tid('menu-hired').click();
await tid('confirm-hired').click();
check(await at('#f-checklist'), 'hired -> checklist');
check(mock.calls.includes('rpc:mark_hired'), 'mark_hired called');
check(await until(() => tid('ck-contract').isVisible()), 'checklist items');
await tid('ck-contract').click();
check(await until(() => has('1 of 7 done')), 'checklist tick');
check(await until(() => mock.T.hires.find(h => h.match_id === match.id)?.checklist?.contract === true), 'toggle_checklist saved');
await shot('f-checklist');

// report and block another helper
await page.goto(APP + '#f-discover');
await visible('helper-card');
await tid('helper-card').click();
check(await at('#f-helper-'), 'open a profile');
const other = (await hash()).replace('#f-helper-', '');
await tid('profile-more').click();
await page.getByRole('dialog').getByRole('button', { name: 'Report' }).click();
await tid('reason-rFees').click();
await tid('report-note').fill('Asked for a deposit first');
await shot('f-report');
await tid('report-send').click();
check(await until(() => mock.T.reports.some(r => r.reporter_id === carla && r.target_id === other && r.reason === 'fees' && r.note === 'Asked for a deposit first')), 'report saved with reason and note');
await page.keyboard.press('Escape');
await tid('profile-more').click();
await page.getByRole('dialog').getByRole('button', { name: /^Block/ }).click();
check(await until(() => mock.T.blocks.some(b => b.user_id === carla && b.blocked_id === other)), 'block saved');
check(await at('#f-discover'), 'back to Discover after a block');
check(!(await localState()).family.passes.includes(other) && (await localState()).family.blocked.includes(other), 'blocked locally');
// not an admin
await page.goto(APP + '#admin');
check(await until(async () => (await hash()) !== '#admin'), 'non-admins cannot open #admin');
await signOut();

// ================= email code: a new yaya =================
await codeSignIn('ana@example.com');
check(await visible('side-picker'), 'yaya: side picker');
const ana = uidOf('ana@example.com');
await tid('path-yaya').click();
check(await at('#y-biodata'), 'yaya side -> biodata');
check(await has('May biodata ka na ba?'), 'yaya side opens in Tagalog');
check(mock.prof(ana).lang === 'tl', 'Tagalog saved');
await shot('y-biodata');
await page.setInputFiles('[data-testid=biodata-file]', join(root, 'public/assets/kristine.jpg'));
check(await at('#y-about'), 'biodata photo -> answers');
check(mock.calls.includes('fn:biodata-read'), 'biodata-read called');
check((await tid('yaya-name').inputValue()) === 'Kristine', 'name read from the biodata');
await tid('next').click(); await at('#y-work');
await tid('next').click(); await at('#y-skills');
await tid('next').click(); await at('#y-looking');
await tid('next').click();
check(await at('#y-intro'), 'looking -> intro');
await page.setInputFiles('[data-testid=photo-file]', join(root, 'public/assets/kristine.jpg'));
check(await until(() => [...mock.storage.keys()].some(k => k.startsWith(`photos/${ana}/`))), 'photo uploaded to storage');
await tid('bio').fill('Limang taon na akong yaya. May routine ako para sa mga bata.');
await shot('y-intro');
await tid('finish-profile').click();
check(await at('#y-idcheck'), 'finish -> ID check');
const yc = mock.T.helpers.find(h => h.id === ana);
check(yc?.first_name === 'Kristine' && yc?.last_initial === 'V' && String(yc?.photo_path).startsWith(ana + '/') && yc?.start_in === '2w' && yc?.arrangement === 'live-out', 'helper card upserted');
await tid('id-later').click();
check(await at('#y-ready'), 'later -> ready');
await tid('see-families').click();
check(await at('#y-families'), 'ready -> families');
await until(async () => (await page.locator('[data-testid^=interest-]').count()) > 0);
await shot('y-families');
await page.locator('[data-testid^=interest-]').first().click();
check(await at('#y-match-'), 'interest in a sample family -> match');
const famId = (await hash()).replace('#y-match-', '');
await tid('say-hello').click();
check(await at('#y-chat-' + famId), 'match -> chat');
check(await visible('id-gate'), 'yaya: ID check before the first message');
await shot('y-chat-gate');
await tid('id-gate-start').click();
check(await at('#y-idcheck'), 'gate -> ID check');
await tid('id-start').click();
await visible('id-sample');
await tid('id-sample').click(); await wait(500);
await tid('id-sample').click();
check(await until(() => has('Na-check na ang ID mo')), 'yaya ID check passes (test mode)');
await tid('id-continue').click();
check(await at('#y-chat-' + famId), 'back to the chat');
await tid('composer').fill('Magandang araw po! Interesado po ako.');
await tid('send').click();
check(await until(async () => (await page.locator('.bubble--them').count()) >= 1), 'family sample auto-reply');
check(await visible('share-number'), 'share-number card after a reply');
await tid('share-number').click();
check(await tid('share-confirm').isDisabled(), 'share waits for the pre-check');
await tid('pre-1').click(); await tid('pre-2').click(); await tid('pre-3').click();
await tid('share-phone').fill('9171234567');
await shot('y-share');
await tid('share-confirm').click();
check(await until(() => mock.T.messages.some(m => m.sender_id === ana && m.kind === 'number' && m.body === '+63 917 123 4567')), 'number sent as a message');
check(mock.prof(ana).phone === '+639171234567', 'number saved privately on the profile');
check(await until(() => has('Ibinigay mo ang number mo')), 'number shared card');
// the family marks her hired on their side
const ym = mock.T.matches.find(m => m.helper_id === ana && m.family_id === famId);
mock.T.hires.push({ id: randomUUID(), match_id: ym.id, family_id: famId, helper_id: ana, start_date: null, family_confirmed: true, helper_confirmed: false, checklist: {}, created_at: new Date().toISOString() });
mock.T.messages.push({ id: randomUUID(), match_id: ym.id, sender_id: famId, kind: 'hired', body: 'hired', meta: {}, created_at: new Date().toISOString() });
check(await until(() => tid('hired-card').isVisible(), 9000), 'hired card arrives by polling');
await shot('y-chat-hired');
await tid('hired-card').click();
check(await at('#y-hired-' + famId), 'hired screen');
await tid('confirm-hired').click();
check(await at('#y-me'), 'confirm -> Ako');
check(mock.calls.includes('rpc:confirm_hired') && mock.T.helpers.find(h => h.id === ana)?.visible === false, 'confirm_hired hides the card');
check(await has('Nakatago ka muna'), 'profile hidden after the hire');
check(await has('ana@example.com') && await has('+63 917 123 4567'), 'Ako shows the email and the private number');
await shot('y-me');
await signOut();

// ================= admin console =================
await codeSignIn('admin@yayamatch.test');
check(await at('#f-discover'), 'admin signs in');
await page.goto(APP + '#admin');
check(await visible('admin'), 'admin console opens for role admin');
const rep = mock.T.reports.find(r => r.reporter_id === carla);
check(await visible(`report-${rep.id}`), 'reports tab lists the report');
check(await has('Asked for a fee') && await has('Asked for a deposit first'), 'report reason and note');
await shot('admin-reports');
await tid(`rep-action-${rep.id}`).click();
check(await until(() => rep.status === 'actioned' && !!rep.resolved_at), 'report actioned');
await tid('admin-tab-reviews').click();
const rv = mock.T.checks.find(c => c.status === 'review');
check(await visible(`review-${rv.id}`), 'ID reviews tab');
check(await has('Birth date not read'), 'review shows what is missing');
await shot('admin-reviews');
await tid(`review-pass-${rv.id}`).click();
check(await until(() => rv.status === 'passed' && !!rv.checked_on), 'review passed with a date (admin_review_check)');
await tid('admin-tab-members').click();
await tid('admin-search').fill('Cruz');
check(await visible(`member-${carla}`), 'member search');
await tid(`member-visible-${carla}`).click();
check(await until(() => mock.T.families.find(f => f.id === carla)?.visible === false), 'hide a card');
await shot('admin-members');
await tid('admin-tab-samples').click();
check(await until(() => has('29 of 29 sample cards')), 'sample count');
await tid('admin-samples-toggle').click();
check(await until(() => mock.calls.includes('rpc:set_samples_visible') && mock.T.helpers.filter(h => mock.prof(h.id).is_seed && !mock.prof(h.id).demo_login).every(h => !h.visible)), 'set_samples_visible(false)');
check(await until(() => has('0 of 29')), 'count after hiding');
await shot('admin-samples');
await tid('admin-samples-toggle').click();
check(await until(() => has('29 of 29')), 'samples back on');
mock.T.families.find(f => f.id === carla).visible = true;
await signOut();

// ================= returns from Didit and PayMongo =================
await codeSignIn('carla@example.com');
check(await at('#f-discover'), 'returning family');
mock.T.checks = mock.T.checks.filter(c => !(c.user_id === carla && c.kind === 'household_id'));
mock.flags.diditLive = true;
await page.goto(APP + '#f-idcheck');
await page.reload();
await visible('id-start');
await tid('id-start').click();
check(await until(() => has('household ID is checked'), 12000), 'back from Didit: waits for the result, then done');
check(!page.url().includes('didit='), 'Didit query removed from the URL');
mock.flags.paymongoLive = true;
await page.goto(APP + '#f-plans');
await visible('plan-premium');
await tid('plan-premium').click();
await tid('plans-continue').click();
check(await until(() => has('Payment received'), 12000), 'back from PayMongo: paid');
check(!page.url().includes('paid='), 'paid query removed from the URL');
check(mock.T.purchases.some(p => p.user_id === carla && p.item === 'premium' && p.status === 'paid'), 'webhook marked it paid');
await shot('f-paid-return');
mock.flags.paymongoCancel = true;
await page.goto(APP + '#f-plans');
await visible('plan-pass');
await tid('plans-continue').click();
check(await until(() => has('Payment cancelled')), 'cancelled checkout: toast');
check(!page.url().includes('cancelled='), 'cancelled query removed');

check(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
console.log(`\n${pass} checks passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
