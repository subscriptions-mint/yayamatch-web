// End-to-end walk through both journeys in headless Chromium.
//   node scripts/e2e.mjs [--shots dir] [--width 390] [--height 844] [--full]
// Phone: --width 390 (default) or 360. Desktop (>= 1024): --width 1440 (900 tall) or --width 1280 (800 tall)
// runs the same journeys on the desktop layout and adds desktop-only shots (modals, OTP, selfie, chat list).
// --full saves full-page screenshots instead of the viewport.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
const url = 'file://' + join(root, 'dist/index.html');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

let pass = 0, fail = 0;
const check = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.route('**/*', r => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));

const hash = () => page.evaluate(() => location.hash);
const wait = ms => page.waitForTimeout(ms);
const tid = id => page.getByTestId(id);
let n = 0;
async function shot(name) {
  await wait(320);
  const over = await page.evaluate(() => {
    const out = [];
    const w = document.querySelector('.app')?.getBoundingClientRect();
    if (!w) return out;
    document.querySelectorAll('.app *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      if (el.closest('.chips--scroll, .starters, .convs__fresh, [style*="overflow"]')) return;
      if (r.right > w.right + 1.5 || r.left < w.left - 1.5) out.push(`${el.tagName}.${el.className}`.slice(0, 60) + ` ${Math.round(r.left)}-${Math.round(r.right)}`);
    });
    return out.slice(0, 4);
  });
  check(over.length === 0, `${name}: content outside the screen ${JSON.stringify(over)}`);
  if (desk) {
    // nothing may spill past the viewport, and the phone tab bar must not show
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(wide <= 1, `${name}: page scrolls sideways by ${wide}px`);
    check(!(await page.locator('.tabbar').count()), `${name}: tab bar hidden on desktop`);
    // nothing may stick out of its card (e.g. a long Tagalog tag in a narrow column)
    const spill = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.card, .fcard, .lcard, .dcard, .pcard, .sheet, .convs, .thread, .ctx').forEach(box => {
        const b = box.getBoundingClientRect();
        box.querySelectorAll('*').forEach(el => {
          if (el.closest('.chips--scroll, .starters, .convs__fresh, .convs__list, .thread__scroll, .sheet__body')) return;
          const cs = getComputedStyle(el);
          if (cs.position === 'absolute' || cs.position === 'fixed' || el.tagName === 'IMG') return;
          const r = el.getBoundingClientRect();
          if (r.width && (r.right > b.right + 1.5 || r.left < b.left - 1.5)) out.push(`${el.tagName}.${el.className}`.slice(0, 50));
        });
      });
      return out.slice(0, 4);
    });
    check(spill.length === 0, `${name}: content sticks out of a card ${JSON.stringify(spill)}`);
  }
  if (shotsDir) await page.screenshot({ path: join(shotsDir, `${String(++n).padStart(2, '0')}-${name}.png`), fullPage });
}
const text = () => page.evaluate(() => document.querySelector('.app')?.innerText ?? '');
const has = async s => (await text()).includes(s);

// ================= FAMILY =================
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await wait(400);
await shot('welcome');
check(await has('Where good homes'), 'welcome headline');
await tid('path-family').click();
check((await hash()) === '#f-account', 'family -> account');
await shot('f-account');
await tid('phone').fill('12345');
await tid('send-code').click();
check(await has('10-digit'), 'phone validation');
await tid('phone').fill('9171234567');
await tid('send-code').click();
check((await hash()) === '#f-otp', 'otp screen');
await shot('f-otp');
await tid('otp-0').fill('1'); await tid('otp-1').fill('1'); await tid('otp-2').fill('1'); await tid('otp-3').fill('1'); await tid('otp-4').fill('1'); await tid('otp-5').fill('1');
await wait(200);
check(await has('does not match'), 'wrong otp error');
await tid('otp-demo').click();
check((await hash()) === '#f-needs', 'otp -> needs');
await shot('f-needs');
await tid('role-nanny').click(); await tid('role-housekeeper').click();
await tid('next').click();
check(await has('Choose at least one'), 'needs validation');
await tid('role-nanny').click(); await tid('role-housekeeper').click();
await tid('next').click();
check((await hash()) === '#f-home', 'needs -> home');
await shot('f-home');
await tid('city').fill('bgc');
await page.getByRole('option', { name: /Taguig/ }).click();
await tid('city').fill('makat');
await page.getByRole('option', { name: /Makati/ }).click();
await tid('next').click();
check((await hash()) === '#f-setup', 'home -> setup');
await shot('f-setup');
check((await page.locator('[data-testid=budget]').innerText()).includes('₱12,000'), 'budget shown');
await tid('see-matches').click();
check((await hash()) === '#f-discover', 'setup -> discover');
await shot('f-discover');
check((await tid('likes-left').innerText()).includes('10 free likes'), 'free likes count');
const firstName = (await page.locator('.pcard__name').innerText()).split(' ')[0];
await tid('helper-card').click();
check((await hash()).startsWith('#f-helper-'), 'open profile');
await shot('f-profile');
check(await has('What has been checked'), 'checks section');
await tid('voice-play').click(); await wait(600);
check(await has('Transcript'), 'voice transcript');
await tid('full-report').click();
check(await tid('report-buy').isVisible(), 'report buy sheet');
if (desk) await shot('f-profile-report-modal');
await page.keyboard.press('Escape');
await tid('profile-like').click();
await wait(300);
let h = await hash();
if (h.startsWith('#f-match-')) {
  await shot('f-match');
  await tid('say-hello').click();
} else {
  check(await has('Liked!'), 'liked toast');
  await page.goto(url + '#f-likes'); await wait(300);
}
// get to a chat: liked-you helpers always match
if (!(await hash()).startsWith('#f-chat-')) {
  await page.goto(url + '#f-discover'); await wait(300);
  for (let i = 0; i < 12; i++) {
    if (!(await tid('helper-card').count())) break;
    const liked = await page.locator('.pcard .tag--solid').count();
    if (liked) { await tid('like').click(); await wait(300); break; }
    await tid('pass').click(); await wait(150);
  }
  h = await hash();
  check(h.startsWith('#f-match-'), 'liked-you helper matches instantly');
  if (desk) await shot('f-match');
  await tid('say-hello').click();
}
check((await hash()).startsWith('#f-chat-'), 'in chat');
await shot('f-chat-empty');
// household ID check before the first message
check(await tid('id-gate').isVisible(), 'household ID check needed before the first message');
check(!(await tid('composer').count()), 'no composer until the household ID check');
await tid('chat-plan').click();
check((await hash()) === '#f-idcheck', 'plan button also asks for the ID check first');
await page.goBack(); await wait(300);
await tid('id-gate-start').click();
check((await hash()) === '#f-idcheck', 'gate -> household ID check');
await wait(300);
check((await tid('id-title').innerText()) === 'Household ID check', 'household ID screen');
await shot('f-idcheck');
await tid('id-start').click();
await tid('id-sample').click(); await wait(500);
await tid('id-sample').click(); await wait(3600);
check(await has('Your household ID is checked'), 'household ID checked');
await shot('f-id-done');
await tid('id-continue').click(); await wait(300);
check((await hash()).startsWith('#f-chat-'), 'back to the chat after the ID check');
check(!(await tid('id-gate').count()), 'gate gone after the ID check');
await tid('composer').fill('Hi! We are the Santos family in Makati. Are you open to live-in?');
await tid('send').click();
await wait(3800);
check((await page.locator('.bubble--them').count()) >= 1, 'helper replied');
check(await tid('locked-card').isVisible(), 'chat locked after free opener');
check(await tid('composer').isDisabled(), 'composer disabled when locked');
await shot('f-chat-locked');
await tid('keep-chatting').click();
check((await hash()) === '#f-plans', 'locked -> plans');
await shot('f-plans');
check(await tid('plan-chat_unlock').isVisible(), 'unlock option shown');
await tid('plan-chat_unlock').click();
await tid('plans-continue').click();
check((await hash()) === '#f-checkout', 'plans -> checkout');
await shot('f-checkout-qr');
await tid('method-card').click();
await tid('pay').click();
check(await has('Name on card'), 'card validation');
await tid('card-name').fill('Carla Santos');
await tid('pay').click();
await wait(1700);
check(await has('Payment received'), 'card payment success');
await shot('f-checkout-done');
await tid('checkout-done').click();
check((await hash()).startsWith('#f-chat-'), 'back to chat after unlock');
check(!(await tid('composer').isDisabled()), 'composer enabled after unlock');
await tid('composer').fill('When can you start?');
await tid('send').click();
await wait(3800);
check((await page.locator('.bubble--them').count()) >= 2, 'second reply');
check(!(await page.locator('[data-testid=chat-video]').count()), 'no video call button');
await tid('chat-plan').click();
check(await tid('plan-sheet').isVisible(), 'plan a call or meeting sheet');
check(await has('Calls happen outside the app'), 'plan sheet copy');
await tid('plan-how-viber').click();
await tid('plan-note').fill('Viber: Santos Family');
if (desk) await shot('f-plan-modal');
await tid('plan-send').click();
await wait(400);
check(await tid('plan-card').first().isVisible(), 'plan card in chat');
check(await has('Call or meeting planned') && await has('Viber'), 'plan card text');
await tid('composer').fill('Do you want a written contract?');
await tid('send').click();
await wait(3800);
check(await has('shared a number'), 'helper shared number');
await shot('f-chat-active');
await tid('chat-more').click();
await tid('menu-hired').click();
await shot('f-hire-sheet');
await tid('confirm-hired').click();
check((await hash()) === '#f-checklist', 'hired -> checklist');
await tid('ck-contract').click();
check(await has('1 of 7 done'), 'checklist tick');
await shot('f-checklist');
await tid('checklist-done').click();
check((await hash()) === '#f-inbox', 'checklist -> inbox');
check(await has('Hired'), 'inbox hired tag');
await shot('f-inbox');
// likes tab: locked, then unlock with a pass via QR Ph auto-confirm
await tid('tab-likes').click();
await shot('f-likes-locked');
if (await tid('unlock-likes').count()) {
  await tid('unlock-likes').click();
  await tid('plans-continue').click();
  await wait(7400);
  check(await has('Payment received'), 'QR Ph auto-confirm');
  await tid('checkout-done').click();
  await wait(300);
  check((await hash()) === '#f-likes', 'back to likes');
  check((await page.locator('[data-testid^=like-back-]').count()) >= 1, 'likes visible with pass');
  await shot('f-likes-open');
}
await page.goto(url + '#f-discover'); await wait(300);
check((await tid('likes-left').innerText()).includes('Unlimited'), 'unlimited likes with pass');
await tid('filters').click();
await shot('f-filters');
await page.keyboard.press('Escape');
await page.goto(url + '#f-me'); await wait(300);
await shot('f-me');
check(await has('Hiring Pass'), 'plan on account');
// Tagalog
await page.getByRole('button', { name: 'TL' }).click(); await wait(200);
check(await has('Mga sagot mo'), 'family Tagalog');
await page.getByRole('button', { name: 'EN' }).click();

if (desk) {
  // States that are hard to reach in the walk above.
  await page.goto(url + '#f-plans'); await wait(300);
  check(await tid('plan-pass').isVisible(), 'desktop: generic plans');
  await shot('f-plans-generic');
  await page.goto(url + '#f-inbox'); await wait(300);
  const row = page.locator('[data-testid^=chat-row-]').first();
  await row.click(); await wait(300);
  check((await hash()).startsWith('#f-chat-'), 'desktop: list row opens the chat');
  check(await page.locator('.convs .list-row.is-active').count() === 1, 'desktop: active row in list');
  if (width >= 1200) check(await page.locator('.ctx').isVisible(), 'desktop: context panel'); // hidden below 1200px by design
  const hid = (await hash()).replace('#f-chat-', '');
  await page.goto(url + '#f-helper-' + hid); await wait(300);
  await tid('profile-more').click(); await wait(200);
  await page.getByRole('dialog').getByRole('button', { name: 'Report' }).click(); await wait(200);
  check(await tid('report-sheet').isVisible(), 'desktop: report modal');
  await shot('f-report-modal');
  await page.keyboard.press('Escape');
  // out of likes: no pass, 10 likes used today
  await page.evaluate(() => {
    const k = 'yayamatch-web-v1'; const st = JSON.parse(localStorage.getItem(k));
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    Object.assign(st.family, { passUntil: null, premiumUntil: null, likesUsedToday: 10, likeDay: today, passes: [] });
    localStorage.setItem(k, JSON.stringify(st));
  });
  await page.goto(url + '#f-discover'); await page.reload(); await wait(400);
  check((await tid('likes-left').innerText()).includes('0 free likes'), 'desktop: no likes left');
  await shot('f-discover-free');
  await tid('like').click(); await wait(250);
  check(await tid('limit-sheet').isVisible(), 'desktop: out-of-likes modal');
  await shot('f-out-of-likes');
  await page.keyboard.press('Escape');
  await tid('filters').click(); await wait(200);
  await shot('f-filters-locked');
  await page.keyboard.press('Escape');
  await page.goto(url + '#f-likes'); await wait(300);
  await shot('f-likes-locked-grid');
}

// ================= YAYA =================
await page.goto(url + '#welcome'); await wait(200);
await page.evaluate(() => localStorage.clear());
await page.reload(); await wait(400);
await tid('path-yaya').click();
check((await hash()) === '#y-welcome', 'yaya -> welcome');
check(await has('Trabahong may respeto'), 'yaya defaults to Tagalog');
await shot('y-welcome');
await tid('send-code').click();
if (desk) await shot('y-otp');
await tid('otp-demo').click();
check((await hash()) === '#y-biodata', 'yaya otp -> biodata');
await shot('y-biodata');
await tid('biodata-sample').click();
await wait(2900);
check((await hash()) === '#y-about', 'biodata -> about');
check((await tid('yaya-name').inputValue()) === 'Kristine', 'biodata prefilled name');
await shot('y-about');
await tid('next').click();
check((await hash()) === '#y-work', 'about -> work');
await shot('y-work');
await tid('next').click();
await shot('y-skills');
await tid('next').click();
check((await hash()) === '#y-looking', 'skills -> looking');
for (let i = 0; i < 12; i++) await tid('rate-less').click();
check((await tid('rate').innerText()).includes('7,800'), 'rate floor at NCR minimum');
for (let i = 0; i < 8; i++) await page.getByRole('button', { name: /Dagdagan|Higher/ }).first().click();
await shot('y-looking');
await tid('next').click();
check((await hash()) === '#y-intro', 'looking -> intro');
await tid('voice-record').click(); await wait(2200); await tid('voice-stop').click(); await wait(300);
check(await has('0:0'), 'voice recorded');
await shot('y-intro');
await tid('finish-profile').click();
check((await hash()) === '#y-idcheck', 'intro -> id check');
await shot('y-idcheck');
// "Later": she can browse and say she is interested; the ID check comes before her first message
await tid('id-later').click();
check((await hash()) === '#y-ready', 'id later -> ready');
await shot('y-ready');
await tid('see-families').click();
check((await hash()) === '#y-families', 'ready -> families');
await shot('y-families');
await tid('available').click();
check(await has('available'), 'available toggle');
await tid('interest-k-13').click();
await wait(300);
check((await hash()) === '#y-match-k-13', 'Dela Cruz match');
await shot('y-match');
await tid('say-hello').click();
await wait(3600);
check((await page.locator('.bubble--them').count()) >= 1, 'family opened the chat');
check(await tid('id-gate').isVisible(), 'yaya: ID check needed before the first message');
check(!(await tid('share-number').count()), 'no share-number before the ID check');
await shot('y-chat-gate');
await tid('id-gate-start').click();
check((await hash()) === '#y-idcheck', 'gate -> ID check');
await tid('id-start').click();
await shot('y-id-capture');
await tid('id-sample').click(); await wait(500);
if (desk) await shot('y-id-selfie');
await tid('id-sample').click(); await wait(3600);
check(await has('Na-check na ang ID mo'), 'id checked');
if (desk) await shot('y-id-done');
await tid('id-continue').click(); await wait(300);
check((await hash()) === '#y-chat-k-13', 'id -> back to the chat');
await shot('y-chat');
await tid('share-number').click();
check(await tid('share-sheet').isVisible(), 'share pre-check sheet');
check(await has('Nag-chat na kayo nang maayos') && await has('Alam mo na ang sweldo, oras at day off') && await has('Walang humihingi ng bayad o deposito'), 'share pre-check items');
check(await tid('share-confirm').isDisabled(), 'share waits for all three pre-checks');
await tid('pre-1').click(); await tid('pre-2').click();
check(await tid('share-confirm').isDisabled(), 'share still waits for the third pre-check');
await tid('pre-3').click();
if (desk) await shot('y-share-modal');
await tid('share-confirm').click();
check(await has('Ibinigay mo ang number mo'), 'number shared');
const say = async (m) => { await tid('composer').fill(m); await tid('send').click(); await wait(3700); };
await say('Ano po ang oras ng trabaho?');
check(await has('8 AM'), 'hours reply');
await say('Pwede po bang mag-usap muna sa phone?');
check(await has('May plano kayong mag-usap'), 'family planned a phone call');
check(await has('Tawag sa phone'), 'plan card says how');
await say('Salamat po!');
await say('Opo, ready po ako.');
check(await tid('hired-card').isVisible(), 'family says hired');
await shot('y-chat-hired');
await tid('hired-card').click();
check((await hash()) === '#y-hired-k-13', 'hired screen');
await shot('y-hired');
await tid('confirm-hired').click();
check((await hash()) === '#y-me', 'hired -> me');
check(await has('Hired via YayaMatch'), 'hired tag on profile');
check(await has('Nakatago ka muna'), 'profile hidden after hire');
await shot('y-me');
await page.goto(url + '#y-rights'); await wait(200); await shot('y-rights');
await page.goto(url + '#y-safety'); await wait(200); await shot('y-safety');
await page.goto(url + '#y-matches'); await wait(200); await shot('y-matches');
await page.goto(url + '#y-family-k-11'); await wait(200); await shot('y-family-detail');
if (desk) {
  await page.goto(url + '#y-chats'); await wait(300); await shot('y-chats');
  check(await page.locator('.thread--empty').isVisible(), 'desktop: empty thread state');
  await page.goto(url + '#y-families'); await wait(300); await shot('y-families-after');
  await page.goto(url + '#y-chat-k-13'); await wait(300); await shot('y-chat-context');
}
await page.goto(url + '#nope'); await wait(200);
check(await has('Walang ganitong page') || await has('Page not found'), 'not found page');

check(errors.length === 0, 'no page errors: ' + errors.slice(0, 3).join(' | '));
console.log(`\n${pass} checks passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
