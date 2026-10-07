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

## Next (suggested order)

1. **Offline support / installable web app.** Add a service worker (e.g.
   `vite-plugin-pwa`) and complete the manifest (`id`, `scope`, maskable icon).
   Helps learners with limited data, and is needed for the Android app and push
   notifications.
2. **Android app (Trusted Web Activity).** Wrap the live site with Bubblewrap or
   PWABuilder. Checklist: fix `firebase.json`'s `"**/.*"` ignore so `.well-known/`
   deploys; publish `public/.well-known/assetlinks.json` with the signing key's SHA-256
   (and Play's, if published there); keep the keystore backed up outside git.
3. **Deadline reminders.** Push notifications when an institution's application window
   opens or is about to close (the dates are already in Firestore), plus email/calendar
   (.ics) for learners without push. Also notify Apply For Me learners when the team
   lodges an application.
4. **Share or export results.** Let learners send their qualifying courses over
   WhatsApp or download them as a PDF.
5. **Funding: bursaries and NSFAS.** Show bursary and NSFAS information next to the
   matched courses: an NSFAS eligibility check and a bursary directory by field of study.
6. **Shortlist for everyone.** Free users can star courses; a full shortlist is a
   natural point to offer Apply For Me.

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
