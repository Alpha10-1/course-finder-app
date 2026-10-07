# Course Finder roadmap

A running list of planned product work. Move items to **Done** (with the date)
as they ship, and add new ideas under **Later**.

## Done

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

1. **Android app (Trusted Web Activity)** — needs you: run Bubblewrap or PWABuilder
   against the live site, keep the generated keystore backed up outside git, then
   publish `public/.well-known/assetlinks.json` with the key's SHA-256 (plus Play's,
   if published there). The hosting config for `.well-known/` is already done.
2. **Push reminders** (rest of deadline reminders) — needs decisions: web push via
   Firebase Cloud Messaging needs a VAPID key from the Firebase console and a scheduled
   job to send notifications when windows open/close (Cloud Functions on the Blaze plan,
   or a Vercel cron). Also notify Apply For Me learners when the team lodges an
   application (push, email or WhatsApp).
3. **Bursary directory** (rest of funding) — needs a content owner: a list of bursaries
   by field of study with closing dates, kept up to date each year (an admin-editable
   Firestore collection would fit the existing admin panel).

## Later

- **Subject-choice advisor for Grade 9** — what choosing Maths Literacy over Maths rules
  out (e.g. engineering, medicine), using the course subject requirements.
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
