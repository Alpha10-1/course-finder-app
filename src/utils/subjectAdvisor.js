// Subject-choice advisor for Grade 9 learners choosing their Grade 10–12
// (FET phase) subjects: which university courses a subject combination keeps
// open, which it rules out and why, and which single change would open the
// most extra courses.
//
// It uses exactly the same matching as the results page (courseQualifies),
// with every subject at an assumed mark. At 100% the APS checks always pass,
// so only subject requirements can rule a course out. That's the question a
// Grade 9 learner is really asking ("does this subject close doors?"). Lower
// assumed marks add the APS and subject minimums back in.
import { NSC_SUBJECTS } from "./nscSubjects";
import { courseQualifies, getCourseGaps } from "./matching";
import { isAnotherLanguagePlaceholder, isGenericCreditSubject, subjectMatches } from "./subjectMatch";
import { STUDY_FIELDS, studyFieldsForCourse } from "./studyFields";

// Everyone in the FET phase takes Life Orientation, two official languages
// (one as Home Language, the other as Home or First Additional Language), one
// of the three maths subjects and three electives.
export const LIFE_ORIENTATION = "Life Orientation";
export const ELECTIVE_COUNT = 3;

export const MATHS_OPTIONS = [
  { subject: "Mathematics", hint: "Pure maths" },
  { subject: "Mathematical Literacy", hint: "Maths for everyday life" },
  { subject: "Technical Mathematics", hint: "Offered at technical schools" },
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

/**
 * Splits courses into the ones these subjects keep open and the ones they
 * rule out, with what's missing for each ruled-out course.
 */
export function evaluateCourses(courses, subjects) {
  const open = [];
  const closed = [];
  for (const course of courses) {
    if (courseQualifies(course, subjects, ADVISOR_PROFILE)) open.push(course);
    else closed.push({ course, gaps: getCourseGaps(course, subjects) });
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

// The official subject a requirement name means, when it means exactly one
// ("Physical Science" → "Physical Sciences"); otherwise the name as written
// ("English" could be Home or First Additional Language).
function canonicalSubject(name) {
  const matches = NSC_SUBJECTS.filter((s) => subjectMatches(s, name));
  return matches.length === 1 ? matches[0] : name;
}

/** "Physical Science ≥50% or Technical Sciences ≥50%" → "Physical Sciences or Technical Science" */
function blockerLabel(label) {
  const options = label.split(" or ").map((o) => canonicalSubject(o.replace(/\s*≥\s*\d+%/g, "").trim()));
  return [...new Set(options)].join(" or ");
}
export const APS_BLOCKER = "Higher marks (APS)";

/**
 * What most often rules courses out: one count per course for each missing
 * requirement, most common first.
 */
export function topBlockers(closed, limit = 5) {
  const counts = new Map();
  for (const { gaps } of closed) {
    const labels = new Set(gaps.map((g) => (g.type === "aps" ? APS_BLOCKER : blockerLabel(g.label))));
    for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts]
    .map(([label, count]) => ({ label, count }))
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

/** Every single change worth trying: another maths subject, or one elective swapped. */
export function swapCandidates(courses, choices) {
  const candidates = MATHS_SUBJECTS.filter((m) => m !== choices.maths)
    .map((to) => ({ type: "maths", from: choices.maths, to }));
  for (const to of requestedElectives(courses)) {
    if (choices.electives.includes(to)) continue;
    for (const from of choices.electives) candidates.push({ type: "elective", from, to });
  }
  return candidates;
}

/** Courses gained and lost by one change, against the current open set. */
export function evaluateChange(courses, choices, mark, change, openNow) {
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
