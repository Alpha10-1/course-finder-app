// Subject-choice advisor for Grade 9 learners choosing their Grade 10–12
// (FET phase) subjects: which university courses a subject combination keeps
// open, which it rules out and why, and which single change would open the
// most extra courses.
//
// It uses exactly the same matching as the results page (courseQualifies),
// with every subject at an assumed mark. At 100% nearly every APS check
// passes, so subject requirements are what rule courses out. That's the
// question a Grade 9 learner is really asking ("does this subject close
// doors?"). A few APS formulas only count certain subjects (e.g. CPUT's
// methods skip Mathematical Literacy), so a course can still fail on APS at
// 100%; it then also has a subject gap, which is shown as the reason. Lower
// assumed marks add the APS and subject minimums back in.
//
// It also knows the Department of Basic Education's subject-combination
// rules (National Policy on Programme and Promotion Requirements, para 28(A)),
// so it never suggests a combination a school can't register.
import { NSC_SUBJECTS } from "./nscSubjects";
import { courseQualifies, getCourseGaps } from "./matching";
import {
  isAnotherLanguagePlaceholder, isBareFirstAdditionalLanguage, isGenericCreditSubject, subjectMatches,
} from "./subjectMatch";
import { STUDY_FIELDS, studyFieldsForCourse } from "./studyFields";

// Everyone in the FET phase takes Life Orientation, two official languages
// (one as Home Language, the other as Home or First Additional Language), one
// of the three maths subjects and three electives.
export const LIFE_ORIENTATION = "Life Orientation";
export const ELECTIVE_COUNT = 3;

export const MATHS_OPTIONS = [
  { subject: "Mathematics", hint: "Pure maths" },
  { subject: "Mathematical Literacy", hint: "Maths for everyday life" },
  { subject: "Technical Mathematics", hint: "Technical pathway only" },
];
const MATHS_SUBJECTS = MATHS_OPTIONS.map((m) => m.subject);

const HL_SUFFIX = " Home Language";
const FAL_SUFFIX = " First Additional Language";
export const HOME_LANGUAGES = NSC_SUBJECTS.filter((s) => s.endsWith(HL_SUFFIX));
// First Additional Language is the usual second language; a second Home
// Language is also allowed.
export const SECOND_LANGUAGES = [
  ...NSC_SUBJECTS.filter((s) => s.endsWith(FAL_SUFFIX)),
  ...HOME_LANGUAGES,
];
export const ELECTIVES = NSC_SUBJECTS.filter(
  (s) => !s.endsWith(HL_SUFFIX) && !s.endsWith(FAL_SUFFIX) && s !== LIFE_ORIENTATION && !MATHS_SUBJECTS.includes(s)
);

export const languageOf = (subject) => subject.replace(HL_SUFFIX, "").replace(FAL_SUFFIX, "");

export const DEFAULT_CHOICES = {
  homeLanguage: "English Home Language",
  additionalLanguage: "isiZulu First Additional Language",
  maths: "Mathematics",
  electives: ["Physical Sciences", "Life Sciences", "Geography"],
};

// Common subject "streams" schools offer, as starting points.
export const PRESETS = [
  { key: "science", label: "Science", maths: "Mathematics", electives: ["Physical Sciences", "Life Sciences", "Geography"] },
  { key: "commerce", label: "Commerce", maths: "Mathematics", electives: ["Accounting", "Business Studies", "Economics"] },
  { key: "humanities", label: "Humanities", maths: "Mathematical Literacy", electives: ["History", "Geography", "Life Sciences"] },
  { key: "technical", label: "Technical", maths: "Technical Mathematics", electives: ["Technical Science", "Engineering Graphics and Design", "Electrical Technology"] },
  { key: "agriculture", label: "Agriculture", maths: "Mathematics", electives: ["Agricultural Sciences", "Life Sciences", "Geography"] },
  { key: "arts", label: "Arts", maths: "Mathematical Literacy", electives: ["Visual Arts", "Dramatic Arts", "History"] },
];

export const MARK_LEVELS = [
  { value: 100, label: "Any marks — just check my subjects" },
  { value: 80, label: "About 80% in every subject" },
  { value: 70, label: "About 70% in every subject" },
  { value: 60, label: "About 60% in every subject" },
  { value: 50, label: "About 50% in every subject" },
];
export const DEFAULT_MARK = 100;

// The learner has finished matric for matching purposes: college courses
// gate on the highest grade completed.
export const ADVISOR_PROFILE = { grade: "Grade 12", gradeStatus: "completed" };

/**
 * Makes any (possibly hand-edited or outdated) set of choices valid: known
 * subjects only, two different languages, and exactly three different
 * electives — filling gaps from the defaults.
 */
export function normalizeChoices(raw = {}) {
  const homeLanguage = HOME_LANGUAGES.includes(raw.homeLanguage) ? raw.homeLanguage : DEFAULT_CHOICES.homeLanguage;
  let additionalLanguage = SECOND_LANGUAGES.includes(raw.additionalLanguage)
    ? raw.additionalLanguage
    : DEFAULT_CHOICES.additionalLanguage;
  if (languageOf(additionalLanguage) === languageOf(homeLanguage)) {
    additionalLanguage = languageOf(homeLanguage) === "English"
      ? DEFAULT_CHOICES.additionalLanguage
      : "English First Additional Language";
  }
  const maths = MATHS_SUBJECTS.includes(raw.maths) ? raw.maths : DEFAULT_CHOICES.maths;

  const electives = [];
  for (const s of Array.isArray(raw.electives) ? raw.electives : []) {
    if (ELECTIVES.includes(s) && !electives.includes(s) && electives.length < ELECTIVE_COUNT) electives.push(s);
  }
  for (const s of [...DEFAULT_CHOICES.electives, ...ELECTIVES]) {
    if (electives.length >= ELECTIVE_COUNT) break;
    if (!electives.includes(s)) electives.push(s);
  }
  return { homeLanguage, additionalLanguage, maths, electives };
}

export function normalizeMark(raw) {
  const n = Number(raw);
  return MARK_LEVELS.some((m) => m.value === n) ? n : DEFAULT_MARK;
}

/** Reads choices from the page's query string (so a combination can be shared). */
export function parseAdvisorParams(params) {
  const get = (k) => params.get(k) || undefined;
  return {
    choices: normalizeChoices({
      homeLanguage: get("hl"),
      additionalLanguage: get("fal"),
      maths: get("maths"),
      electives: (get("e") || "").split(",").filter(Boolean),
    }),
    mark: normalizeMark(get("mark")),
  };
}

export function advisorParams(choices, mark) {
  const params = new URLSearchParams({
    hl: choices.homeLanguage,
    fal: choices.additionalLanguage,
    maths: choices.maths,
    e: choices.electives.join(","),
  });
  if (mark !== DEFAULT_MARK) params.set("mark", String(mark));
  return params;
}

/** The learner's seven subjects, all at the assumed mark. */
export function buildSubjects(choices, mark = DEFAULT_MARK) {
  return [choices.homeLanguage, choices.additionalLanguage, choices.maths, LIFE_ORIENTATION, ...choices.electives]
    .map((subject) => ({ subject, mark }));
}

// ── Subject-combination rules ───────────────────────────────────────────────
// Learners follow the Academic (General) or the Technical pathway. The
// technical pathway is one of Civil, Electrical or Mechanical Technology,
// plus Engineering Graphics and Design, plus Mathematics or Technical
// Mathematics, plus Physical Sciences or Technical Sciences. Technical
// Mathematics is for the technical pathway only, which may not take
// Mathematical Literacy; Physical Sciences must be taken with Mathematics.
// Learners who break these rules can't be certified. Sources: DBE Circular
// E22 of 2022, restated in Eastern Cape Assessment Instruction 05 of 2026.
export const TECHNOLOGY_SUBJECTS = ["Civil Technology", "Electrical Technology", "Mechanical Technology"];
const EGD = "Engineering Graphics and Design";
const TECHNICAL_SCIENCE = "Technical Science";

export function isTechnicalPathway(choices) {
  return choices.maths === "Technical Mathematics" || choices.electives.some((e) => TECHNOLOGY_SUBJECTS.includes(e));
}

/**
 * What's wrong with a combination under the DBE rules, each with a one-click
 * fix: [{ key, text, fixLabel, fix }] where `fix` is a full set of choices.
 */
export function combinationProblems(choices) {
  const problems = [];
  const has = (s) => choices.electives.includes(s);

  if (has("Physical Sciences") && choices.maths === "Mathematical Literacy") {
    problems.push({
      key: "physical-sciences-maths-lit",
      text: "Physical Sciences has to be taken with Mathematics, not Mathematical Literacy.",
      fixLabel: "Switch to Mathematics",
      fix: { ...choices, maths: "Mathematics" },
    });
  }

  if (isTechnicalPathway(choices)) {
    const technology = choices.electives.find((e) => TECHNOLOGY_SUBJECTS.includes(e));
    if (technology && choices.maths === "Mathematical Literacy") {
      problems.push({
        key: "technical-maths-lit",
        text: `${technology} is a technical-pathway subject, which can't be taken with Mathematical Literacy.`,
        fixLabel: "Switch to Mathematics",
        fix: { ...choices, maths: "Mathematics" },
      });
    }
    const missing = [];
    if (!technology) missing.push("Civil, Electrical or Mechanical Technology");
    if (!has(EGD)) missing.push(EGD);
    if (!has("Physical Sciences") && !has(TECHNICAL_SCIENCE)) missing.push("Physical Sciences or Technical Sciences");
    if (missing.length) {
      const science = has("Physical Sciences") ? "Physical Sciences" : TECHNICAL_SCIENCE;
      problems.push({
        key: "technical-missing",
        text: `${choices.maths === "Technical Mathematics" && !technology ? "Technical Mathematics is only for the technical pathway, which" : "The technical pathway"} also needs: ${missing.join("; ")}.`,
        fixLabel: "Use the technical pathway subjects",
        fix: {
          ...choices,
          maths: choices.maths === "Mathematical Literacy" ? "Technical Mathematics" : choices.maths,
          electives: [technology || "Electrical Technology", EGD, science],
        },
      });
    }
  }
  return problems;
}

/**
 * Splits courses into the ones these subjects keep open and the ones they
 * rule out, with what's missing for each ruled-out course. At the default
 * mark (100%), an APS gap on a course that also lacks a subject is left out:
 * the missing subject is the real reason (see the note at the top).
 */
export function evaluateCourses(courses, subjects, mark = DEFAULT_MARK) {
  const open = [];
  const closed = [];
  for (const course of courses) {
    if (courseQualifies(course, subjects, ADVISOR_PROFILE)) {
      open.push(course);
      continue;
    }
    let gaps = getCourseGaps(course, subjects);
    if (mark === DEFAULT_MARK && gaps.some((g) => g.type === "subject")) gaps = gaps.filter((g) => g.type !== "aps");
    closed.push({ course, gaps });
  }
  return { open, closed };
}

const OTHER_FIELD = { key: "other", label: "General & other programmes" };

/** Open/total course counts per broad field of study, plus the ruled-out courses in each. */
export function summarizeByField({ open, closed }) {
  const fields = [...STUDY_FIELDS.filter((f) => f.key !== "any"), OTHER_FIELD]
    .map((f) => ({ ...f, open: 0, total: 0, closed: [] }));
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const keysFor = (course) => {
    const keys = studyFieldsForCourse(course);
    return keys.length ? keys : [OTHER_FIELD.key];
  };
  for (const course of open) {
    for (const key of keysFor(course)) { byKey[key].open += 1; byKey[key].total += 1; }
  }
  for (const entry of closed) {
    for (const key of keysFor(entry.course)) { byKey[key].total += 1; byKey[key].closed.push(entry); }
  }
  return fields.filter((f) => f.total > 0);
}

export const MARKS_BLOCKER = "Higher marks";

const stripMarks = (option) => option.replace(/\s*≥\s*\d+%/g, "").trim();
const isLanguage = (name) => / (home|first additional) language$/i.test(name);
const NSC_ORDER = new Map(NSC_SUBJECTS.map((s, i) => [s, i]));

// Whether the learner takes something that could satisfy a requirement
// option — if so, a gap on it is about marks, not about the subject.
function learnerTakes(subjects, option) {
  const taken = subjects.filter((s) => s.subject !== LIFE_ORIENTATION);
  if (isGenericCreditSubject(option)) return taken.length > 0;
  if (isAnotherLanguagePlaceholder(option)) return taken.some((s) => isLanguage(s.subject) && !s.subject.startsWith("English "));
  if (isBareFirstAdditionalLanguage(option)) {
    return taken.some((s) => / first additional language$/i.test(s.subject))
      || taken.filter((s) => / home language$/i.test(s.subject)).length >= 2;
  }
  return taken.some((s) => subjectMatches(s.subject, option));
}

// A requirement row, keyed by the set of official subjects that would meet
// it, so "English", "English Language" and "English Home Language or English
// First Additional Language" count as one blocker.
function blockerFor(options) {
  const accepted = new Set();
  for (const option of options) {
    const matches = NSC_SUBJECTS.filter((s) => subjectMatches(s, option));
    for (const m of matches.length ? matches : [option]) accepted.add(m);
  }
  const subjects = [...accepted].sort((a, b) => (NSC_ORDER.get(a) ?? 1e9) - (NSC_ORDER.get(b) ?? 1e9) || a.localeCompare(b));
  const key = subjects.join("|");
  if (subjects.length > 4) return { key, label: [...new Set(options)].join(" or ") };
  const names = [];
  for (const s of subjects) {
    const language = isLanguage(s) ? s.replace(/ (Home|First Additional) Language$/, "") : null;
    const bothLevels = language && accepted.has(`${language} Home Language`) && accepted.has(`${language} First Additional Language`);
    const name = bothLevels ? language : s;
    if (!names.includes(name)) names.push(name);
  }
  return { key, label: names.join(" or ") };
}

/**
 * What most often rules courses out: one count per course for each missing
 * subject requirement, most common first. Gaps that are only about marks
 * (the learner takes the subject, or the APS is short) count as "Higher marks".
 */
export function topBlockers(closed, subjects = [], limit = 5) {
  const counts = new Map();
  for (const { gaps } of closed) {
    const seen = new Map();
    for (const g of gaps) {
      const options = g.type === "aps" ? [] : g.label.split(" or ").map(stripMarks);
      if (g.type === "aps" || options.some((o) => learnerTakes(subjects, o))) {
        seen.set(MARKS_BLOCKER, MARKS_BLOCKER);
      } else {
        const { key, label } = blockerFor(options);
        seen.set(key, label);
      }
    }
    for (const [key, label] of seen) {
      const entry = counts.get(key) || { label, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

// Electives that some course actually asks for by name. Swapping in any
// other elective can't open a course (generic "any 20-credit subject" rows
// accept every subject), so only these are worth suggesting.
const requestedElectivesCache = new WeakMap();
export function requestedElectives(courses) {
  if (requestedElectivesCache.has(courses)) return requestedElectivesCache.get(courses);
  const names = new Set();
  for (const course of courses) {
    for (const req of course.keySubjects || []) {
      for (const opt of req.subjectGroup || [req]) {
        if (opt.subject && !isGenericCreditSubject(opt.subject) && !isAnotherLanguagePlaceholder(opt.subject)) {
          names.add(opt.subject);
        }
      }
    }
  }
  const result = ELECTIVES.filter((e) => [...names].some((n) => subjectMatches(e, n)));
  requestedElectivesCache.set(courses, result);
  return result;
}

export function applyChange(choices, change) {
  if (change.type === "maths") return { ...choices, maths: change.to };
  return { ...choices, electives: choices.electives.map((e) => (e === change.from ? change.to : e)) };
}

/**
 * Every single change worth trying: another maths subject, or one elective
 * swapped. Changes that would break a DBE combination rule the current
 * choices don't already break are left out, and Technical Science is only
 * suggested on the technical pathway.
 */
export function swapCandidates(courses, choices) {
  const problemsNow = new Set(combinationProblems(choices).map((p) => p.key));
  const allowed = (change) => {
    const after = applyChange(choices, change);
    if (change.to === TECHNICAL_SCIENCE && !isTechnicalPathway(after)) return false;
    return combinationProblems(after).every((p) => problemsNow.has(p.key));
  };
  const candidates = MATHS_SUBJECTS.filter((m) => m !== choices.maths)
    .map((to) => ({ type: "maths", from: choices.maths, to }));
  for (const to of requestedElectives(courses)) {
    if (choices.electives.includes(to)) continue;
    for (const from of choices.electives) candidates.push({ type: "elective", from, to });
  }
  return candidates.filter(allowed);
}

/** Courses gained and lost by one change, against the current open set. */
export function evaluateChange(courses, choices, mark, change, openNow) {
  // Same matching as evaluateCourses; only the open/closed split matters here.
  const subjects = buildSubjects(applyChange(choices, change), mark);
  const gained = [];
  const lost = [];
  for (const course of courses) {
    const nowOpen = courseQualifies(course, subjects, ADVISOR_PROFILE);
    if (nowOpen && !openNow.has(course)) gained.push(course);
    else if (!nowOpen && openNow.has(course)) lost.push(course);
  }
  return { ...change, gained, lost, net: gained.length - lost.length };
}

/**
 * The few changes that open the most courses: positive net gain only, one
 * suggestion per subject to take up (the swap that loses least), biggest first.
 */
export function rankChanges(results, limit = 4) {
  const best = new Map();
  for (const r of results) {
    if (r.net <= 0) continue;
    const key = `${r.type}:${r.to}`;
    if (!best.has(key) || r.net > best.get(key).net) best.set(key, r);
  }
  return [...best.values()]
    .sort((a, b) => b.net - a.net || a.to.localeCompare(b.to))
    .slice(0, limit);
}

/** A few short, different course names to illustrate a change. */
export function exampleCourses(courses, count = 3) {
  const names = [];
  for (const c of [...courses].sort((a, b) => a.courseName.length - b.courseName.length)) {
    if (!names.includes(c.courseName)) names.push(c.courseName);
    if (names.length === count) break;
  }
  return names;
}
