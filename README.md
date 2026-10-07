# Course Finder

Course Finder is a web app that helps South African learners find university and
TVET/private college courses they qualify for. A learner enters their Grade 11/12
subject marks, the app converts those marks into NSC achievement levels and
per-university APS (Admission Point Score) totals, and matches them against a
database of courses with real admission requirements — minimum APS, key subject
minimums, qualification type, and (for colleges) grade/NQF-level gates. Matched
results are grouped by the actual South African university application process
(1st / 2nd / 3rd choice per institution), and the app includes an admin panel for
managing the course catalog, a paid "Apply For Me" concierge feature via Yoco, and
SEO-optimized public course pages that are prerendered to static HTML.

Live site: https://mycoursefinder.web.app · Planned work: [ROADMAP.md](ROADMAP.md)

---

## Table of contents

- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Core features](#core-features)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [NPM / build scripts](#npm--build-scripts)
- [Maintenance scripts](#maintenance-scripts)
- [Deployment](#deployment) (including [offline support](#offline-support))
- [Known issues, rough edges & security notes](#known-issues-rough-edges--security-notes)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, Tailwind CSS 3 |
| SSR / prerendering | `react-dom/server`, custom Node prerender script |
| SEO | `react-helmet-async`, hand-rolled sitemap generator |
| Auth & data | Firebase Auth (email/password + Google), Firestore |
| Backend (payments) | Vercel serverless functions **and** Firebase Cloud Functions (v2, Node 22) — see [known issues](#known-issues-rough-edges--security-notes) |
| Payments | Yoco (South African card payment gateway) |
| Hosting | Firebase Hosting (site: `mycoursefinder`) |
| Linting | ESLint 10, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` |
| Tests & CI | Vitest, React Testing Library (jsdom), GitHub Actions (`.github/workflows/ci.yml`: lint → test → build) |
| Build-time codegen | Babel + `babel-plugin-react-compiler` via `@rolldown/plugin-babel` (React Compiler enabled at build time) |

## Architecture

This is a client-rendered React SPA with two additions layered on top for SEO and payments:

1. **SPA core** — `src/main.jsx` mounts `<App />` (in `src/App.jsx`), which defines all
   routes with `react-router-dom`. Firebase Auth state drives which screens a visitor
   can reach (`RequireAuth`, `RequireAdmin`).

2. **SSR-prerendering pipeline for public course pages** — the `/courses`,
   `/courses/:institutionSlug`, and `/courses/:institutionSlug/:courseSlug` routes are
   also rendered server-side at **build time** (not on each request) so that crawlers
   and link-unfurlers (Google, WhatsApp, Slack, X, LinkedIn) that don't execute
   JavaScript still get a real `<title>`, meta description, Open Graph tags, and
   JSON-LD in the initial HTML. The flow:
   - `vite build` — builds the normal client bundle.
   - `vite build --ssr src/entry-server.jsx --outDir dist-ssr` — builds a Node-renderable
     SSR bundle of just the three public course routes (`src/entry-server.jsx`
     deliberately excludes Welcome/SignIn/SignUp since those depend on Firebase's
     browser-only auth listener).
   - `scripts/prerender.mjs` — for every known institution/course URL (derived from
     `scripts/routes.mjs`, which reads the same JSON data the app uses), renders real
     HTML via `renderToString`, strips the template's default SEO tags, injects the
     page-specific ones, and writes a static `dist/<path>/index.html`. The client JS
     bundle is still referenced, so once it loads, React hydrates and takes over as a
     normal SPA.
   - This whole sequence is wired into `npm run build`. Course pages are capped at
     `PRERENDER_COURSE_LIMIT` (400 by default); the rest are still served by the SPA.
   - `npm run sitemap` regenerates `public/sitemap.xml` from the same route data. It is
     **not** part of the build, so run it after changing course data.

3. **Payments backend (duplicated across two providers)** — the "Apply For Me" paid
   plan (R100, one-time) uses Yoco's hosted checkout. There are **two independent,
   near-identical implementations** of this flow in the repo:
   - `api/create-checkout.js` + `api/yoco-webhook.js` — Vercel serverless functions,
     deployed separately from Firebase Hosting (see `vercel.json`). The webhook uses
     `firebase-admin` with env-var credentials to update Firestore.
   - `functions/index.js` — Firebase Cloud Functions (`createYocoCheckout`,
     `yocoWebhook`) doing the same job, additionally binding a HMAC `checksum` into
     the Yoco metadata to guard against metadata tampering.

   `src/components/PricingModal.jsx` currently calls the **Vercel** endpoint
   (hardcoded `API_BASE = "https://course-finder-app-zeta.vercel.app"`). It's unclear
   from the code alone whether the Firebase Functions version is still live or is a
   leftover from an earlier architecture — worth confirming before touching either.

## Core features

### Public (no login required)
- **Welcome screen** (`/`) — entry point; redirects signed-in users straight to `/home`.
- **Course directory** (`/courses`) — search/filter all institutions by name and type
  (university vs. college), with aggregate course counts.
- **Institution course list** (`/courses/:institutionSlug`) and **course detail**
  (`/courses/:institutionSlug/:courseSlug`) — public, SEO-indexed pages showing
  admission requirements without requiring sign-up.

### Authenticated learner flow
- **Sign up / sign in** (`/signup`, `/signin`) — Firebase Auth, email/password and
  Google sign-in. Email/password accounts must verify their email before accessing
  any gated route (`RequireAuth` blocks access and offers a resend-verification flow
  with a 60-second cooldown).
- **Enter marks** (`/enter-marks`) — learner selects their grade (9–12) and completion
  status, then enters percentage marks for each subject from the full official NSC
  subject list (all 11 official languages × Home Language/First Additional Language,
  plus all standard NSC subjects). Grade/status determines which institution types
  (university vs. college) the learner is even eligible to browse.
- **Matching engine** (`src/utils/marksToAPS.js`, `src/utils/subjectMatch.js`):
  - Converts each percentage mark to an NSC achievement level (1–7) via standard
    band cutoffs (80/70/60/50/40/30%).
  - Computes a **general APS** (best 6 levels, Life Orientation excluded) and a
    per-university score using **institution-specific models** (`UNIVERSITY_MODELS`):
    most universities use the generic best-6 model, while Wits, UCT, Stellenbosch,
    UKZN, UWC, UNIZULU, UNIVEN, Rhodes, Sol Plaatje, MUT, NMU and Sefako Makgatho each
    have their own scale (e.g. Wits' weighted bands with a Maths/English bonus, UCT's
    percentage sum out of 600). Some rules are per course rather than per
    institution: CPUT's three APS methods (`apsMethod` on the course) and NMU's
    course-required subjects. Each model's comment cites the prospectus it follows,
    and `marksToAPS.test.js` reproduces the prospectuses' worked examples.
  - Fuzzy subject matching (`subjectMatches`) reconciles course requirements written
    in short form (e.g. "English") against full NSC subject names the learner
    entered (e.g. "English Home Language"), while explicitly preventing false
    matches like Mathematics ↔ Mathematical Literacy or Mathematics ↔ Technical
    Mathematics. It also understands known synonym pairs (e.g. Computer Literacy ↔
    CAT) and generic placeholder requirements like "20 Credit Subject" or "Other
    Subject" (any subject except Life Orientation, at a minimum mark).
  - Separate eligibility logic for colleges (`meetsCollegeRequirement`,
    `getEffectiveMinAPS`), which gate on grade level and NQF level rather than pure
    APS, since TVET/NCV qualifications work differently from university admission.
- **Results** (`/results`) — shows every course the learner qualifies for, split into
  normal-stream, extended/foundation-stream, and college courses, with search and
  filters by faculty, institution, qualification type, and "open for
  applications only." Each course card also shows its admission notes (wait-list
  rules, selection processes, deadlines). Below the list, **Within reach** shows
  courses the learner would qualify for with marks up to 10% higher, and what's
  missing for each; a **What if my marks change?** panel lets them try different
  marks without saving them (`src/utils/matching.js`). Learners can star courses
  into a saved **shortlist**, **share** what's on screen on WhatsApp or **save it as
  a PDF** (print layout), add an application **closing date to their calendar**
  (.ics), and run a quick **NSFAS funding check** (`src/utils/funding.js`). Also
  drives the guided **application-round selection flow**:
  - **Round 1** — pick one course per institution, up to 6 institutions (mirroring
    South Africa's real centralized university application process).
  - **Round 2 / 3** — pick a 2nd and 3rd choice course from each of those same 6
    institutions.
  - Selections are saved to Firestore and resumable — a returning learner picks up
    exactly where they left off.
  - A final step collects a contact phone number and email before confirming
    submission.
  - Institutions can be marked "closed" for applications (via admin-configured
    open/close dates in `institutionStatus.js`); closed institutions are locked out
    of selection and can be filtered out of the results view. An institution with no
    dates configured defaults to **open**.
- **Payment / "Apply For Me"** (`PricingModal.jsx`, `ApplyModal.jsx`,
  `/payment-success`) — a R100 one-time paid plan where the team applies to
  institutions on the learner's behalf. Checkout is hosted by Yoco; a webhook
  (signature-verified via HMAC-SHA256, with a 5-minute replay window) upgrades the
  user's `plan` field in Firestore once payment succeeds.

### Admin panel (`/admin`, `RequireAdmin`)
`src/pages/Admin.jsx` is a thin shell (tab navigation and toasts). Each tab is a
component in `src/pages/admin/` (`UsersTab`, `CoursesTab`, …), and each area's state and
actions live in a hook there (`useAdminUsers`, `useAdminCourses`,
`useApplicationWindows`, `useAuditLog`). The hooks are owned by the shell rather
than the tabs, so filters survive switching tabs. It supports:
- **Role-based access**: `super` (hardcoded email, cannot be revoked from the UI,
  always granted full access even if their Firestore doc is deleted), `admin` (full
  panel except the super-admin guarantee), and `moderator` (courses tab only).
  Permissions per role are centrally defined in `src/utils/adminConfig.js`.
- **Dashboard, Users, Courses, Audit Log, and Settings tabs** (tab visibility is
  filtered by the current admin's role).
- **Course management**: create/edit/delete courses for ~26 named public
  universities plus TVET/private colleges, with fields for faculty, campus (for
  colleges with multiple sites), duration, qualification type, minimum APS (with
  per-subject APS *alternatives*, e.g. a different cutoff for learners who took
  Maths Lit instead of Mathematics), key subject requirements (including
  subject-group "any-of" requirements), free-text admission requirement
  descriptions, and, for colleges, minimum grade/NQF level gates and a
  display-only curriculum breakdown (fundamental vs. vocational subjects).
- **College course JSON expansion**: college course data is authored once per
  college in `src/data/college-courses.json` with an optional `campuses` array;
  the admin panel and matching logic expand that into one entry per campus,
  carrying over the shared institution-level data and applying any
  per-campus vocational-subject exclusions.
- **Institution application windows**: set per-institution open/close dates
  that drive the "open for applications" status seen by learners.
- **User management**: promote/demote admin roles, view user data, trigger
  password resets.
- **Audit log**: records every course add/edit/delete (with a field-level diff for
  edits) and who made it; visible to the super admin only.
- **Seed-exclusion handling**: logic to prevent originally-seeded courses that an
  admin has since deleted from silently reappearing on the next data seed/import.

## Data model

**Firestore collections** (inferred from the code; there's no schema file, and
`firestore.rules` is referenced from `firebase.json` but **missing from the repo** —
see [known issues](#known-issues-rough-edges--security-notes)):
- `users/{uid}` — `plan` ("free" / "ad_free" / "apply_for_me"), `paidAt`, `paymentId`,
  `amountPaid`, `isAdmin`, `adminRole`, `email`, saved subject marks, grade/status,
  `applySelections` (the round 1/2/3 course picks keyed by institution),
  `applicationProgress` (which institutions the team has applied to, set by admins),
  `shortlist` (starred courses: `[{ id, courseName, institution, campus? }]`).
- `courses/{id}` — one document per course; the shape mirrors the `BLANK_COURSE`
  object in `Admin.jsx` (institution, faculty, campus, duration, qualification type,
  `minAPS`, `apsAlternatives`, `keySubjects`, `admissionRequirement`, and
  college-only `minGrade`/`minNQFLevel`/`curriculum`).
- `institutionSettings/{institutionName}` — `{ openDate, closeDate, updatedAt,
  updatedBy }`, driving application-window status.
- `facultySettings/{institution}|||{faculty}` — optional per-faculty override of the
  institution's window, same shape.
- `courseAuditLogs/{id}` — one entry per admin course add/edit/delete.
- `meta/seedExclusions` — `{ keys: [...] }`, dedupe keys of courses an admin deleted,
  so re-seeding from the JSON doesn't bring them back.

**Static JSON data** (bundled with the app, used for the public prerendered pages
and as source data for course seeding):
- `src/data/courses.json` (~1.6 MB, ~1,940 courses) — university course catalog.
- `src/data/college-courses.json` (~470 KB, ~300 entries that expand to ~600 course
  docs) — college/TVET course catalog, with the `campuses` expansion structure
  described above (`src/utils/collegeCourses.js`).

Note that the public course pages read these JSON files, while the matcher on
`/results` reads the `courses` collection in Firestore. Admin edits only change
Firestore, so the two can drift apart until the JSON is updated.

## Project structure

```
course-finder-app/
├── api/                        # Vercel serverless functions (Yoco checkout/webhook)
│   ├── create-checkout.js
│   └── yoco-webhook.js
├── functions/                   # Firebase Cloud Functions (v2) — parallel Yoco impl.
│   ├── index.js
│   ├── package.json
│   └── .env.example
├── scripts/
│   ├── routes.mjs               # shared institution/course slug + URL derivation
│   ├── generate-sitemap.mjs     # builds public/sitemap.xml
│   └── prerender.mjs            # writes static HTML for public course routes
├── src/
│   ├── components/              # ApplyModal, PricingModal, Seo, RequireAuth/Admin, OnboardingModal
│   ├── data/                    # courses.json, college-courses.json
│   ├── pages/
│   │   ├── public/               # CoursesDirectory, InstitutionCourses, CourseDetail (SSR'd)
│   │   ├── admin/                # admin tabs, panels and the hooks holding their state
│   │   ├── results/              # CourseCard, WithinReach, WhatIfPanel, RoundReview, SubmittedSummary, …
│   │   ├── Welcome.jsx, SignIn.jsx, SignUp.jsx
│   │   ├── EnterMarks.jsx, Results.jsx
│   │   ├── ExamNumberEntry.jsx   # no longer routed — safe to delete
│   │   ├── Admin.jsx             # admin shell: tabs + toasts
│   │   ├── PaymentSuccess.jsx
│   │   └── Details.jsx           # currently empty (0 bytes)
│   ├── utils/                    # APS models, subject matching, apply-round selection, slugs, etc.
│   ├── App.jsx, main.jsx, entry-server.jsx, firebase.js
├── .github/workflows/ci.yml     # lint, test and build on every push / PR
├── deduplicate-courses.mjs      # one-off Firestore maintenance script (needs serviceAccountKey.json)
├── verify-college-matching.mjs  # superseded by src/utils/collegeCourses.test.js (and broken by data changes)
├── register-webhook.js          # one-off script to register the Yoco webhook (reads YOCO_SECRET_KEY from env)
├── build-ewc-courses.mjs        # currently empty (0 bytes)
├── firebase.json, .firebaserc   # firebase.json references firestore.rules, which is missing
├── vercel.json
├── vite.config.js, tailwind.config.js, postcss.config.js
└── package.json
```

Tests sit next to the code they cover (`*.test.js` / `*.test.jsx`). `Admin.test.jsx` and
`Results.test.jsx` are smoke tests that render the pages against an in-memory
fake of Firestore and click through every tab and the full apply flow.

## Getting started

Requires Node.js (Vite 8 / the toolchain here targets a recent Node LTS; Firebase
Functions specify Node 22 explicitly).

```bash
git clone https://github.com/Alpha10-1/course-finder-app.git
cd course-finder-app
npm install
npm run dev
npm test        # unit + smoke tests (no Firebase connection needed)
```

This starts the Vite dev server (`server.host = true`, so it's reachable from other
devices on your network, and `allowedHosts: true`, so it'll accept any Host header —
convenient for local tunneling/testing, but worth tightening if you ever run this
config anywhere non-local).

The app talks to a live Firebase project (`course-finder-214e7`) using the config
hardcoded in `src/firebase.js`. That means `npm run dev` will work against the real
backend out of the box with no `.env` setup on the frontend — there's no separate
local/dev Firebase project. If you want an isolated environment, you'll need to
either point `firebase.js` at your own Firebase project or use the Firebase Local
Emulator Suite.

To install Firebase Functions dependencies separately:
```bash
cd functions
npm install
```

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `YOCO_SECRET_KEY` | `api/create-checkout.js`, `functions/index.js` | Server-side Yoco API key to create a hosted checkout session |
| `YOCO_WEBHOOK_SECRET` | `api/yoco-webhook.js`, `functions/index.js` | Verifies the HMAC signature on incoming Yoco webhook events |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | `api/yoco-webhook.js` (Vercel path only) | Firebase Admin SDK credentials, used to update Firestore from the Vercel webhook handler |

The Firebase Functions path (`functions/index.js`) doesn't need explicit Firebase
Admin credentials since `initializeApp()` picks up ambient credentials automatically
when running as a deployed Cloud Function.

The frontend Firebase config (API key, project ID, etc.) is **not** an environment
variable — it's hardcoded directly in `src/firebase.js`. This is normal for Firebase
web apps (these values are not treated as secrets; access is enforced by Firestore
security rules, not by hiding the config), but it does mean there's no way to point
different environments (dev/staging/prod) at different Firebase projects without
editing that file.

## NPM / build scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server |
| `npm run sitemap` | Regenerates `public/sitemap.xml` from current course data |
| `npm run build` | Full production build: client bundle → SSR bundle → prerender public course pages → clean up `dist-ssr` |
| `npm run preview` | Serves the built `dist/` locally to sanity-check the production build |
| `npm run lint` | Runs ESLint across the project |
| `npm test` | Runs the Vitest suite once (`npm run test:watch` to re-run on save) |

## Maintenance scripts

These are standalone Node scripts, not part of the `npm run` pipeline — run them
directly with `node <script>` when needed:

- **`deduplicate-courses.mjs`** — connects to Firestore directly (via a
  `serviceAccountKey.json` you must generate yourself from Firebase Console →
  Project Settings → Service Accounts and place at the project root — it is not
  included in the repo) and removes duplicate `courses` documents based on a
  normalized name+institution key.
- **`verify-college-matching.mjs`** — an older standalone check of college matching
  against the JSON data. It no longer runs (the course it looks up was renamed)
  and is superseded by `src/utils/collegeCourses.test.js`; safe to delete.
- **`register-webhook.js`** — one-time script to register the production Yoco
  webhook URL with Yoco's API:
  `YOCO_SECRET_KEY=sk_live_... node register-webhook.js`. An earlier version had a
  live key hardcoded — see Known Issues.

## Deployment

The app is split across two hosting providers:

- **Firebase Hosting** (`site: mycoursefinder`, configured in `firebase.json`)
  serves the built `dist/` folder, with a catch-all SPA rewrite to `index.html`.
  `/index.html` and `/courses/**` are set to `no-cache, no-store, must-revalidate`
  (since prerendered course pages should always be re-fetched fresh), while
  `/assets/**` gets a 1-year immutable cache (safe because Vite fingerprints asset
  filenames). `/sw.js` and `/site.webmanifest` are `no-cache` so changes to them
  reach browsers straight away. The ignore list deliberately doesn't exclude
  dotfiles, so `public/.well-known/` (needed for the Android app) gets deployed.
- **Firebase Cloud Functions** (`functions/`, Node 22 runtime) can be deployed with
  `npm run deploy` from inside `functions/` (`firebase deploy --only functions`), or
  run locally with `npm run serve` (the Functions emulator).
- **Vercel** hosts the `api/` serverless functions independently
  (`course-finder-app-zeta.vercel.app`), with CORS locked to the production Firebase
  Hosting origin (`vercel.json`).

Given the duplicated Yoco logic, deploying a change to the payment flow currently
means deciding whether to update the Vercel functions, the Firebase functions, or
both — see [Known issues](#known-issues-rough-edges--security-notes).

### Offline support

The app is installable (`public/site.webmanifest`, icons generated from
`public/app-icon.svg`) and works offline for pages a learner has already opened:

- **`public/sw.js`** — a small hand-written service worker, registered from
  `src/main.jsx` in production builds only. Page loads go network-first (so deploys
  show up immediately) and fall back to the cached app shell offline; hashed files
  under `/assets/` are cached as they're used. Nothing is downloaded ahead of time,
  and cross-origin requests (Firebase, Yoco, analytics) and Firebase's `/__/` paths
  are never intercepted.
- **Firestore offline cache** — `src/firebase.js` enables IndexedDB persistence, so
  marks, results and selections loaded once still show offline. Saving needs a
  connection; `OfflineBanner` tells learners when they're offline.

If the service worker ever misbehaves in production, replace `public/sw.js` with
this, remove the registration in `src/main.jsx`, and deploy — every browser
removes the worker the next time it checks for an update:

```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", async () => {
  for (const name of await caches.keys()) await caches.delete(name);
  await self.registration.unregister();
  for (const client of await self.clients.matchAll()) client.navigate(client.url);
});
```

## Known issues, rough edges & security notes

**Secrets in git history — action needed:**
- `functions/.env` (live `YOCO_SECRET_KEY` and `YOCO_WEBHOOK_SECRET`), a live Yoco
  key hardcoded in `register-webhook.js`, and a Firebase `serviceAccountKey.json`
  (removed in `3e605f8`) were all committed at some point. They're gone from the
  current tree and `.gitignore` now covers them, but deleting a file in a new commit
  does **not** remove it from earlier commits — they're still recoverable from the
  history of this public repository.
- **Recommended action**: rotate the Yoco secret key and webhook secret, generate
  a fresh Firebase service account key (and revoke the old one from the Firebase
  Console), and consider rewriting git history (e.g. with `git filter-repo` or the
  BFG Repo Cleaner) — rotation neutralizes the old keys; only a rewrite removes them.

**`firestore.rules` is missing from the repo**: `firebase.json` points at it, but
the live rules exist only in the Firebase Console. The browser writes to
`users/{uid}` directly (marks, selections), so the rules must stop users from
changing their own `plan`, `isAdmin` and `adminRole` fields — otherwise anyone can
grant themselves the paid plan or the admin panel from the browser console. Export
the live rules into the repo and check this.

**Payment webhooks skip verification when unconfigured**: both `api/yoco-webhook.js`
and `functions/index.js` accept events without checking the signature if
`YOCO_WEBHOOK_SECRET` isn't set, so a missing env var would let anyone post a fake
"payment succeeded" event. They should reject instead.

**Duplicated payment backend**: `api/` (Vercel) and `functions/` (Firebase) both
implement Yoco checkout creation and webhook handling independently, with slightly
different security models (the Firebase version adds an HMAC checksum bound to
`uid:planId` in the Yoco metadata; the Vercel version doesn't). Only one appears to
be actively wired up on the frontend (`PricingModal.jsx` calls the Vercel URL) — the
other may be dead code, or may be a second live integration point that's easy to
forget about when rotating keys or fixing bugs.

**Hardcoded configuration in source**: the Vercel API base URL in
`PricingModal.jsx`, the app URL in `api/create-checkout.js`/`functions/index.js`,
the sitemap's site URL, and the super-admin email in `adminConfig.js` are all
hardcoded strings rather than environment/config-driven values. Changing any of
these means editing source and redeploying, and the super-admin email in
particular is a single point of privileged access with no rotation mechanism
built into the UI.

**Leftover files**: `src/pages/Details.jsx` and `build-ewc-courses.mjs` are both
0 bytes, `y/` and `yes/` hold Firebase's default "Welcome to Firebase Hosting" page
(leftovers from `firebase init`), `src/pages/ExamNumberEntry.jsx` is no longer routed
(`/exam-number` redirects to `/enter-marks`), and `verify-college-matching.mjs` is
superseded by tests — all safe to delete.

**`/results` downloads the whole catalogue**: every visit reads every document in
the `courses` collection (~2,500), which is slow on mobile data and uses a lot of
Firestore reads (the free tier's 50k/day covers only ~20 visits).

**Admin "Delete user" leaves the Auth account**: deleting the Auth account is a
client-side REST call that needs admin credentials, so it always fails silently and
only the Firestore document is removed. Delete the account in the Firebase Console,
or move this into a Cloud Function.

**No `firestore.indexes.json`**: composite Firestore query indexes (if any are
needed as the `courses` collection grows) aren't captured in the repo; they'd need
to be recreated from the Firebase Console or added manually if you redeploy the
project's Firestore configuration from scratch.
