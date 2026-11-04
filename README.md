# YayaMatch web app

A mobile-first web app for YayaMatch (with a desktop layout from 1024px), with two separate journeys:

- **Families** ("I need help at home"): sign up, describe the home, browse helpers, like, match, household ID check, chat, buy a plan, plan a call or meeting, mark as hired, run the hiring checklist.
- **Yayas** ("Naghahanap ako ng trabaho"): scan a biodata or fill in by hand, record a voice intro, ID check, browse families, show interest, match, chat, share a number, confirm the hire. Always free for helpers.

It builds two ways from the same screens:

- **Demo** (`npm run build`): every screen works offline with sample data and a simulated other side. This is what the published demo and `npm test` use.
- **Live** (`npm run build:live`): the same app on Supabase (auth, data, realtime, storage, edge functions). See "Live mode" below.

English and Tagalog are complete (1,058 keys each). The yaya side opens in Tagalog by default and the family side in English. Anyone can switch.

## Quick start

```bash
npm install          # react, react-dom, esbuild, typescript, playwright
npm run build        # -> dist/index.html + dist/assets/
open dist/index.html # works from file:// too; no server needed
```

| Script | What it does |
|---|---|
| `npm run build` | Bundles to `dist/index.html` (CSS + JS inline) with images in `dist/assets/` |
| `npm run build:live` | The live app, in `dist-live/` (needs `YM_SUPABASE_URL` and `YM_SUPABASE_KEY`; see "Live mode") |
| `npm run build:single` | One self-contained file, `dist-single/index.html`, with images inlined (about 1.1 MB) |
| `npm run dev` | Rebuilds `dist/` on every change (unminified) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run check:i18n` | Confirms EN and TL have the same keys and list lengths |
| `npm test` | Playwright walk through both journeys (110 checks on a phone). Options: `--width 360`, `--width 1440` or `--width 1280` (desktop layout), `--shots <dir>` to save screenshots, `--full` for full-page shots |
| `npm run test:desktop` | The same walk at 1440×900 on the desktop layout, plus desktop-only states (modals, OTP, selfie, chat list) |
| `npm run test:live` | The live build against an in-memory mock of the Supabase project (`scripts/e2e-live.mjs`). Same `--width`, `--height`, `--shots` options |

**Demo shortcuts**
- Any PH mobile number that starts with 9 (10 digits) works. The code is always `123456`; there's a "Use demo code" button.
- Payments, the QR Ph scan, ID checks and helper replies are simulated. A QR payment confirms itself after about 6 seconds.
- Both sides do an ID check before their first message (the yaya's free ID check; the family's household ID check). Use "Use a sample photo" twice.
- "Reset demo" is under Account (families) or Ako (yayas).

## Desktop layout

The phone layout is unchanged. From 600 to 1023px the app stays a centered phone column. From **1024px** it switches to a desktop layout (spec: `desktop-spec.md`, Nov 2, 2026).

- **One breakpoint.** CSS uses `@media (min-width: 1024px)` (one block at the end of `app.css`). `useIsDesktop()` in `src/lib/useIsDesktop.ts` uses the same query through `matchMedia` and is used only for structure: the top nav, rails, panes and side cards. Everything else is CSS.
- **Shell.** On desktop `.app` is full width and screens scroll as normal pages. `Screen` takes `nav`, `brand`, `desk` and `wide` props, which it ignores on phones. Logged-in screens pass `<FamilyNav>` or `<YayaNav>`: a 72px top nav with the same links, badges and active state as the tab bar (built from the same `useFamilyNavItems` / `useYayaNavItems`), plus the plan pill or bell, the EN/TL toggle and the avatar. The bottom tab bar is not rendered.
- **Patterns** (letters follow the spec):
  - **A** split onboarding: pass `nav={<SlimHeader back=… />}` and `brand={<BrandPanel side kind />}` to `Screen`. `Footer back="…"` turns the sticky footer into an inline row with a Back button.
  - **B** modals: `Sheet` becomes a centered 520px dialog in CSS (`wide` gives 600px for filters), with a close X and right-aligned actions.
  - **C** Discover: filter rail, profile card, right rail. **D** yaya families feed: availability and filters, cards in two columns, strength and likes. Below 1440px both use two columns: the right rail moves into the left column.
  - **E** helper profile and family detail: 760px main column plus a sticky 360px side card.
  - **F** messages: list, thread and context panel in one card. The inbox and chat-list routes show the list with an empty thread. The context panel hides below 1200px.
  - **G** plans in three cards with a FAQ; checkout in two columns. **H** Account and Ako: section nav plus cards. **I** match, paid (with a receipt), ID done, Ready and hired as centered cards. **J** ID photo and selfie: a dark capture panel with instructions and two equal options (camera or upload).
  - The welcome route is a landing page with a hero, a proof strip and "How it works".
- **Copy.** New strings live under `desk.*` in `en.ts` and `tl.ts`. The same rules apply: no "verified", "safe" or "trusted", checks always show dates, helpers never pay.
- **Tests.** `node scripts/e2e.mjs --width 1440` (900px tall) or `--width 1280` (800px tall) runs both journeys on the desktop layout. It also checks that the page never scrolls sideways and that the tab bar is hidden.

## Stack

- React 19 + TypeScript, no router or state library
- esbuild bundles everything into one HTML file (`scripts/build.mjs`)
- Plain CSS with design tokens (`src/styles/app.css`)
- Fonts: Poppins (display) and Inter (text), from Google Fonts

**Building offline.** The project was built in a sandbox that had no npm registry. Because of that, `types/react-shim.d.ts` holds minimal React typings instead of `@types/react`. If you install `@types/react` and `@types/react-dom`, delete `types/react-shim.d.ts` and remove `"types": []` and `"typeRoots"` from `tsconfig.json`.

## Structure

```
src/
  main.tsx              entry
  App.tsx               route switch, guards (must verify phone, finish onboarding), per-side theme
  index.html            shell; build fills in CSS, the image map and JS
  styles/app.css        tokens, layout, all components
  lib/
    types.ts            Helper, Household, Chat, Message, Purchase, AppState
    store.ts            persisted app store + UI store (toasts, sheets) + toast()
    router.ts           hash routes (#f-discover, #f-chat-h-03, #y-family-k-13 …), nav(), back()
    i18n.ts             t(), peso and date formatters, minimum-wage line
    useIsDesktop.ts     matchMedia hook for the 1024px breakpoint
    match.ts            entitlements (likes left, chat unlocks, pass, premium) + fit scoring and lists
    actions.ts          every state change the UI can make (the backend seam; hands off to live/ in the live build)
    config.ts           window.__YM_CONFIG__ (live build only) and the LIVE flag
    live/               Supabase client, realtime, sync, row mappers, live actions, admin data, URL boot
  data/
    constants.ts        roles, skills, cities and regions, minimum wage table, prices, limits
    helpers.ts          16 sample helpers
    households.ts       13 sample families
  i18n/en.ts, tl.ts     full dictionaries
  components/
    ui.tsx              Screen, TopBar, Button, Chip, Tile, Sheet, RangeSlider, CitySearch, QrCode …
    domain.tsx          VoicePlayer, QuoteCard, MessageView, ReportSheet, CallSheet …
    desktop.tsx         desktop only: DesktopNav (FamilyNav, YayaNav), SlimHeader, BrandPanel, PageHead, SideNav …
    icons.ts            64 line icons
  screens/
    shared/             Welcome, OTP, Not found, live sign-in (email, code, side picker), ID check (both sides)
    admin/              admin console (#admin, live only)
    family/             onboarding (4 steps) + Discover, Profile, Match, Chat, Plans, Checkout,
                        Checklist, Inbox (chats + likes), Account
    yaya/               onboarding (6 steps, ID check, ready) + Families, Family detail, Match,
                        Chat, Matches, Chats, Hired, Ako, Rights, Safety
public/assets/          helper photos, logo, welcome image
scripts/                build (--live), i18n check, end-to-end tests (demo, and live against mock-supabase.mjs)
supabase/               migrations (0001, 0002, proposed 0003) and edge functions
```

## Business rules in the demo

| Rule | Value (`src/data/constants.ts`) |
|---|---|
| Free likes per day (families) | 10 |
| Free open chats (families) | 3, plus one free opener per match |
| Chat unlock | ₱79 for one helper |
| Hiring Pass | ₱199 for 7 days: unlimited likes and chats, see who liked you, filters |
| Premium | ₱399 for 30 days |
| Full background report | ₱99 |
| Urgent boost | ₱199 for 72 hours |
| Helpers | never pay |
| Kasambahay minimum wage | NCR ₱7,800 · Central Visayas ₱7,500 · Davao ₱6,500. Budgets and asking rates can't go below the floor for the region. |

The wage figures follow the current regional wage orders (NCR-DW-06; ROVII-DW-06; RB XI, March 2026). Check them again before launch.

**Copy rules.** The app never says "verified", "safe" or "trusted". It shows dated checks instead (for example "ID checked · Oct 2026"). YayaMatch is not a party to the hire. Rights and contract text is general information, not legal advice.

## What is simulated

| Feature | Where | What to replace it with |
|---|---|---|
| OTP | `verifyPhone()` | SMS provider (e.g. Supabase Auth phone OTP, Semaphore, Twilio) |
| Helper and family replies, like-backs, hire offers | `actions.ts` timers | Realtime messages from the other user |
| Payments (QR Ph, GCash, Maya, card) | `FamilyCheckout`, `completePurchase()` | PayMongo or Xendit checkout + webhook that writes the purchase |
| Biodata scan | `applyBiodata()` | OCR / LLM extraction from the uploaded photo |
| ID and selfie check | `setIdChecked()` | KYC vendor; store only the result and date |
| Voice intro | `VoiceRecorder` | Uses the real mic when allowed; upload the blob to storage |
| Calls and meetings | `PlanSheet` | Nothing: there are no calls in the app. "Plan a call or meeting" sends a dated plan card (Messenger, Viber, phone call or in person) |

## Plugging in a backend (how the live build does it)

The screens never write state themselves. They read with `useStore()` and change things only through the functions in `src/lib/actions.ts`:

`setPhone`, `verifyPhone`, `patchFamily`, `finishFamilyOnboarding`, `likeHelper`, `passHelper`, `createFamilyMatch`, `sendFamilyMessage`, `scheduleFamilyCall`, `markFamilyHired`, `toggleChecklist`, `blockParty`, `reportParty`, `startCheckout`, `completePurchase`, `patchYaya`, `applyBiodata`, `finishYayaOnboarding`, `setIdChecked`, `toggleAvailable`, `interestHousehold`, `hideHousehold`, `createYayaMatch`, `sendYayaMessage`, `scheduleYayaCall`, `shareYayaNumber`, `confirmYayaHired`, `setYayaVisible`, and more.

To go live:

1. Keep `store.ts` as a client cache. Have each action call your API first (or optimistically update, then reconcile).
2. Replace the sample `data/helpers.ts` and `data/households.ts` with queries. The `Helper` and `Household` types in `lib/types.ts` are the contract.
3. Delete the timer-based simulations in `actions.ts` (search for `setTimeout`) and subscribe to realtime messages and matches instead.
4. Move the entitlement checks in `match.ts` (`likesLeft`, `chatUnlocked`, `hasPass` …) to the server. Keep the client copies only for display.

The live build follows exactly this pattern: every action in `actions.ts` checks `LIVE` and hands off to `src/lib/live/actions.ts`; `match.ts` reads the cards loaded into the store. The schema is in `supabase/migrations/`.

## Live mode

The live build runs the same screens on the Supabase project in `backend-spec.md` (Nov 2, 2026). The demo build is unchanged and has no config.

### Config and build

`node scripts/build.mjs --live` writes this into the page as `window.__YM_CONFIG__` and outputs `dist-live/` (a static site, like `dist/`):

| Env var | Required | Goes into | What it is |
|---|---|---|---|
| `YM_SUPABASE_URL` | yes | `supabaseUrl` | `https://qvczthltbdefwefpsncd.supabase.co` |
| `YM_SUPABASE_KEY` | yes | `supabaseKey` | The publishable key (or the legacy anon key). Never the service-role key |
| `YM_SEED_PASSWORD` | staging only | `seedPassword` | Shows "Try a sample account" on Welcome (Kristine and the Santos family). Leave it out of production builds |
| `YM_APP_URL` | recommended | `appUrl` | The site's own URL, e.g. `https://yayamatch.vercel.app/`. Used as the return address for Google/Facebook sign-in, the email link, Didit and PayMongo. Defaults to the page's own address |

```bash
YM_SUPABASE_URL=https://qvczthltbdefwefpsncd.supabase.co \
YM_SUPABASE_KEY=sb_publishable_R6MiXfrtugCVFauHRqGDwQ_ddYGsX0c \
YM_APP_URL=https://<your-site>/ \
YM_SEED_PASSWORD=<sample password, staging only> \
node scripts/build.mjs --live
```

### How it works

- `src/lib/config.ts` reads the config; `LIVE` is false in the demo build.
- `src/lib/live/` is a small fetch client with no dependencies: `client.ts` (Auth, PostgREST, RPC, edge functions, Storage; session in `localStorage` under `yayamatch-live-session`, refreshed about 60 s before expiry), `realtime.ts` (a minimal Phoenix client for new messages in the open chat), `sync.ts` (loads the signed-in user's data into the store, then polls every 4 s for the open chat and every 20 s for the inbox, so chat works even if the socket is blocked), `map.ts` (database rows ↔ the app's `Helper`, `Household` and `Chat` types), `actions.ts` (the live version of each action), `admin.ts` (the admin console) and `boot.ts` (reads `#access_token=…`, `?error=…`, `?didit=1…`, `?paid=…` and `?cancelled=…` before the hash router starts, then cleans the URL).
- The live store is saved under `yayamatch-live-v1` (never the demo's key) and is only a cache: the server is the truth. There are no timers pretending to be the other side: sample profiles reply on the server.
- Sample profiles (`rpc/sample_ids`) carry a "Sample profile" tag on cards, profile pages and chats.

### Sign-in

- Welcome shows **Continue with Facebook**, **Continue with Google** and **Use email instead**. There is no phone or SMS sign-in in live mode.
- Email: `POST /auth/v1/otp` sends a 6-digit code; the code screen reuses the demo's code boxes, with a resend timer. Until the email template is changed, the email holds a link instead: opening it on the same device signs in too.
- After the first sign-in the person picks a side once (the path cards), then onboards. The card is saved at the end of onboarding, then `rpc/finish_onboarding`. Later edits save themselves.
- Staging: with `YM_SEED_PASSWORD` set, "Try a sample account" signs in as `kristine.seed@example.com` or `santos.seed@example.com` and calls `rpc/reset_my_demo` first, so each tester starts clean.

### Owner's dashboard steps

1. **Migrations:** apply `0001_core.sql`, `0002_samples.sql`, then review and apply `0003_live_app.sql` (likes count for families without a pass, dated admin ID reviews, matched people keep seeing each other's card after a hire).
2. **Auth → URL Configuration:** Site URL = the live site. Add it (and any preview URLs) under Redirect URLs.
3. **Auth → Email templates → Magic Link:** replace the link with the code, e.g. `<p>Your YayaMatch code: <b>{{ .Token }}</b></p>`. Keep the OTP length at 6.
4. **Auth → Providers:** Google: create an OAuth client in Google Cloud with the redirect URI `https://qvczthltbdefwefpsncd.supabase.co/auth/v1/callback`, then paste the client ID and secret. Facebook: the same with a Meta app (Facebook Login, same redirect URI). Until a provider is on, its button shows "That sign-in option is not turned on yet. Use email instead."
5. **Leave Phone/SMS sign-in off.**
6. **Admins:** `update public.profiles set role = 'admin' where email = '<you>';` then open `#admin` (also linked from Account / Ako).
7. **Edge function secrets** (switch each vendor from test mode to live): `APP_URL`; Didit: `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, `DIDIT_WEBHOOK_SECRET` (webhook URL `…/functions/v1/didit-webhook`); PayMongo: `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` (webhook URL `…/functions/v1/paymongo-webhook`, event `checkout_session.payment.paid`); biodata reading: `ANTHROPIC_API_KEY`.
8. **Before launch:** Admin console → Sample profiles → switch off (`rpc/set_samples_visible`), and build without `YM_SEED_PASSWORD`.

### Test modes

Each edge function answers `mode: 'test'` until its vendor keys are set (and always for the two shared sample sign-ins):

| Feature | Test mode | Live mode |
|---|---|---|
| ID check (both sides) | `id-check-start` → the app's own ID photo, selfie and "checking" screens → `id-check-test` stores a passed, dated check | Redirect to Didit → back on `?didit=1&verificationSessionId=…&status=…` → the app waits for the webhook's result (done, under review, or failed) |
| Payments | `checkout` → the simulated QR Ph, GCash, Maya and card screens → `checkout-test` marks the purchase paid | Redirect to PayMongo → back on `?paid=<purchase_id>` (waits for the webhook) or `?cancelled=…` (toast) |
| Biodata photo | `biodata-read` returns a sample biodata | The photo (resized in the browser) is read by the model; the yaya checks every answer next |

### What live mode changes, and what changed in both modes

- Live only: email/Google/Facebook sign-in, the side picker, uploads (photos to the `photos` bucket, voice intros to `voice`, at `<uid>/<uuid>.<ext>`), server entitlements (likes left, pass, chat unlocks, reports) and the admin console (reports, ID reviews, members, sample profiles). Hidden in live: phone sign-in, "Reset demo", "Switch to the other app", the NBI upload (it needs a private bucket) and the voice-message button in chat.
- Both modes: no video calls ("Plan a call or meeting" sends a plan card), the share-number pre-check (three ticks before sharing), the new safety copy ("talk first; meet in a public place or tell someone where you are going"), and the ID check before the first message for both sides.

### Tests

`npm run test:live` (or `node scripts/e2e-live.mjs --width 1440`) builds into `.live-test/`, serves it as `https://yayamatch.test/` and answers `https://qvczthltbdefwefpsncd.supabase.co/**` with `scripts/mock-supabase.mjs`, an in-memory version of the tables, the RLS rules that matter, the RPCs and the edge functions. Realtime is refused on purpose, so chat must work on polling. It walks: sign-in with a provider that is off, Google, a sample account, an email code; family onboarding; like → match; the household ID check; a message and the sample's auto-reply; a message that only arrives by polling; test-mode checkout → pass → likes visible; plan a call; mark hired and the checklist; report and block; the whole yaya journey with a biodata photo, a photo upload, the ID check, share-number and confirm-hired; the admin console; and the Didit and PayMongo returns.

## Hosting

`dist/` and `dist-live/` are static sites. Deploy either anywhere: Vercel, Netlify, Cloudflare Pages, S3. Routes are hash-based (`#f-discover`), so no rewrite rules are needed. The demo saves to `localStorage` under `yayamatch-web-v1`; the live build caches under `yayamatch-live-v1` and keeps the session under `yayamatch-live-session`.

## Open items before launch

- Sample helpers and families are illustrative. Photos of helpers in the YayaMatch uniform need CEO sign-off.
- New features need product sign-off: Hiring Pass and Premium prices, the urgent boost, the ₱99 report, and the yaya-side "share my number" flow.
- Have a lawyer review the wage figures and the Batas Kasambahay (RA 10361) rights text.
- The live build needs the dashboard steps in "Live mode" (email template, providers, vendor keys) before real users arrive.
