# Course Finder roadmap

A running list of planned product work. Move items to **Done** (with the date)
as they ship, and add new ideas under **Later**.

## Done

**2026-10-16**
- **Bursary directory** (rest of funding). Admins add bursaries in a new
  Bursaries tab (name, provider, closing date, official link, fields of study);
  learners see the open ones that fund a field they qualify for, inside "Can I get
  funding to study?". Courses are mapped to ten broad study fields by keyword. The
  directory starts empty; nothing was invented.
- **Push reminders** (rest of deadline reminders). Learners turn reminders on per
  device (Home and the shortlist). A daily Vercel Cron job (`api/send-reminders.js`)
  notifies them when a shortlisted or chosen institution opens, closes in 7 days or
  closes tomorrow; Apply For Me learners are told when the team lodges each
  application (`api/notify-application.js`). Built on Vercel rather than Cloud
  Functions, so no Blaze plan is needed. Off until the setup below is done.
- **Android app groundwork.** Step-by-step guide (`docs/android-app.md`),
  `npm run assetlinks` to write a validated `assetlinks.json`, and keystores/APKs
  git-ignored.
- **Subject-choice advisor for Grade 9** (`/subject-choices`, public and
  prerendered). Pick maths, electives and languages, or a preset stream. It shows
  how many university and college courses the combination keeps open, what rules
  courses out, a per-field breakdown, and the single swaps that open the most
  courses. Linked from the landing page, the course directory and the marks page
  for Grade 9 learners. Shareable via its link and WhatsApp.
- **Subject matching fixes** found while building the advisor, which also change
  results-page matches:
  - Requirements written as "English Language", "Biology", "Agriculture",
    "African Languages" or "Any other subject" could never be met. About 30 courses
    were affected, e.g. Fort Hare's BCom.
  - "Maritime Economics" counted as Economics, and Design and Engineering Graphics
    and Design counted as each other.
  - Mathematics learners were held to the higher Technical Mathematics APS
    minimum on 38 courses, 34 of them at NMU.
  - Learners with two Home Languages failed about 80 courses that ask for a
    "First Additional Language". A second Home Language now counts.
- **Review fixes** (an independent six-area review of the push, bursary and
  advisor work, with every finding re-checked by a skeptic):
  - The advisor follows the DBE subject-combination rules.
  - Push tokens no longer outlive sign-out on a shared phone.
  - The daily reminder run recovers from failures.
  - The offline fallback page can no longer be replaced by a prerendered page.
  - Bursary admin fixes, contrast and keyboard fixes, and Android guide
    corrections.

**2026-10-07**
- **Admission notes on every course.** Wait-list rules (`additionalRequirements`),
  selection processes (`selectionProcess`), deadlines (`applicationDeadline`) and
  university `admissionRequirement` are now shown on the results card and the public
  course page, and admins can edit them. Deadlines from an earlier year are flagged
  instead of shown as current. Also fixed "any of" subject requirements, which showed
  up blank on 1,100+ public course pages.
- **Apply For Me progress for learners.** The results page shows which institutions
  the team has applied to (and when); Home shows a one-line status. Learners can no
  longer edit their choices once applications have been lodged.
- **Removed the "Use Examination Number" button.** It led to a "Coming Soon" page,
  and there's no public results API to build it on. `/exam-number` now redirects to
  the marks page.
- **"Within reach" list.** Courses the learner would qualify for with marks up to 10%
  higher, with exactly what's missing for each.
- **What-if simulator.** Try different marks and see which courses open up or close,
  without changing saved marks or using up mark edits.
- **Offline support / installable web app.** Hand-written service worker
  (`public/sw.js`, network-first pages, cached hashed assets, nothing downloaded up
  front), Firestore offline cache, an offline banner, a complete manifest, and a new
  app icon (`public/app-icon.svg`, matching the cap in `og-image.png`) replacing
  Vite's default logo in the favicons and iOS icon. Checked in Edge: installable,
  and visited pages load offline. `firebase.json` now deploys `.well-known/`.
- **Share or export results.** "Share on WhatsApp", the phone's share sheet, and
  "Save as PDF" (a print-only layout of marks and courses) — all based on exactly the
  courses on screen after search and filters.
- **Calendar reminders for deadlines** (first part of deadline reminders). Each course
  with an upcoming closing date offers an .ics download with reminders a week and a
  day before.
- **Shortlist for everyone.** Any learner can star courses; the shortlist is saved
  on their user doc (`shortlist`), can be shared on WhatsApp, and offers Apply For Me
  to free users.
- **NSFAS funding check** (first part of funding). A 3-question check against NSFAS's
  financial criteria (R350,000 household income, R600,000 with a disability, SASSA
  grant recipients qualify), pointing to nsfas.org.za for current rules and dates.
  No dates are hardcoded — two official 2027-cycle announcements gave different
  closing dates (31 October vs 18 November 2026).

## Next (suggested order)

1. **Switch on push reminders** — needs you, about 15 minutes: generate the web
   push key in the Firebase console and paste it into `src/pushConfig.js`, add
   `CRON_SECRET` in Vercel, deploy Vercel and hosting, and allow learners to write
   `reminders`/`pushTokens` in the Firestore rules. Steps in README → Push reminders.
2. **Fill the bursary directory** — needs a content owner: add bursaries from the
   providers' own sites in the admin Bursaries tab, and refresh the dates every
   year. The Firestore rules need a `bursaries` entry (README → Firestore rules).
3. **Build and publish the Android app** — needs you: follow `docs/android-app.md`
   (Bubblewrap or PWABuilder, back up the keystore, `npm run assetlinks`, deploy).
   Google Play also needs a privacy policy, so it depends on the POPIA item below.
4. **Compare courses side by side** — the next thing that can be built without
   outside input (see Later).

## Later

- **Career → course search** — "I want to be a pharmacist" → courses, institutions and
  marks needed. Needs a career-to-course mapping.
- **Teacher / school counsellor dashboard** — class code, matches for the whole class,
  who hasn't applied. Possible paid or sponsored product for schools and districts.
- **"Ask a parent to pay" link** — most learners are minors without bank cards.
- **Document upload for Apply For Me** — ID, results, proof of residence, with a
  checklist per institution, instead of collecting them over WhatsApp.
- **WhatsApp bot** — send your marks, get your courses back.
- **Zero-rating** — apply to mobile networks' education zero-rating so the site uses no
  data.
- **Compare courses side by side.**
- **Interface in other South African languages.**
- **Email or WhatsApp notifications** — for learners without push (e.g. "we've applied
  for you"), using the phone and email collected in the Apply For Me contact step.
- **Advisor: compare two subject combinations** side by side, and use it for career
  questions once the career → course mapping exists.
- **Bursaries on the public course pages** — the prerendered pages read the JSON
  catalogue, so this needs the bursary list at build time or a client-side fetch.

## Prerequisites and open issues

- **POPIA:** parent/guardian consent for learners under 18, plus a privacy policy.
  Required before the school dashboard or document upload.
- **Security (see README → Known issues):** commit `firestore.rules` and block users
  from setting their own `plan`/`isAdmin`/`adminRole`; make the payment webhooks reject
  requests when `YOCO_WEBHOOK_SECRET` is unset; rotate the keys that are in git history;
  keep only one payment backend.
- **Performance:** `/results` downloads the whole course catalogue on every visit;
  serve it as one cached file instead. Pick one source of truth for course data (the
  public pages use the JSON, matching uses Firestore).
- **Cleanup:** delete `y/`, `yes/`, `src/pages/Details.jsx`,
  `src/pages/ExamNumberEntry.jsx`, `build-ewc-courses.mjs` and
  `verify-college-matching.mjs`.
