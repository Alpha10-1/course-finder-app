import { subjectMatches } from "./subjectMatch.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function normalizeName(name = "") {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isLifeOrientation(name) {
  const n = normalizeName(name);
  return n === "life orientation" || n.includes("life orientation");
}

function isEnglish(name) {
  return normalizeName(name).includes("english");
}

function isAfrikaans(name) {
  return normalizeName(name).includes("afrikaans");
}

function isMaths(name) {
  const n = normalizeName(name);
  return n.includes("mathematics") || n === "maths" || n.includes("math ");
}

function bestN(items, n, scoreFn) {
  return [...items].sort((a, b) => scoreFn(b) - scoreFn(a)).slice(0, n);
}

// ─── Conversion tables ────────────────────────────────────────────────────────

/**
 * Standard NSC percent → level (1–7). Used by most universities.
 */
export function convertMarkToAPS(mark) {
  const p = clamp(Number(mark));
  if (p >= 80) return 7;
  if (p >= 70) return 6;
  if (p >= 60) return 5;
  if (p >= 50) return 4;
  if (p >= 40) return 3;
  if (p >= 30) return 2;
  return 1;
}

// ─── NSC achievement level ↔ percentage ────────────────────────────────────
//
// The NSC reports subject results as an achievement level (1–7), each
// corresponding to a percentage band. Admins author subject requirements as
// a level (matching how requirements are actually published, e.g. "Level 4
// for Mathematics"); the app converts that to the minimum percentage under
// the hood and matches it against the learner's entered percentage mark.

export const NSC_LEVEL_OPTIONS = [
  { level: 7, minMark: 80, label: "Level 7 (80–100%)" },
  { level: 6, minMark: 70, label: "Level 6 (70–79%)" },
  { level: 5, minMark: 60, label: "Level 5 (60–69%)" },
  { level: 4, minMark: 50, label: "Level 4 (50–59%)" },
  { level: 3, minMark: 40, label: "Level 3 (40–49%)" },
  { level: 2, minMark: 30, label: "Level 2 (30–39%)" },
  { level: 1, minMark: 0,  label: "Level 1 (0–29%)"  },
];

/**
 * Minimum percentage mark represented by an NSC achievement level (1–7).
 * e.g. levelToMinMark(4) === 50
 */
export function levelToMinMark(level) {
  const match = NSC_LEVEL_OPTIONS.find((o) => o.level === Number(level));
  return match ? match.minMark : 0;
}

/**
 * The NSC achievement level a given percentage mark falls into (1–7).
 * Alias of convertMarkToAPS, exposed under a clearer name for level-based UI.
 */
export function markToLevel(mark) {
  return convertMarkToAPS(mark);
}

// Wits-specific band table for non-LO subjects (0–8) + bonus for Maths/English
function witsBandOther(percent) {
  const p = clamp(Number(percent));
  if (p >= 90) return 8;
  if (p >= 80) return 7;
  if (p >= 70) return 6;
  if (p >= 60) return 5;
  if (p >= 50) return 4;
  if (p >= 40) return 3;
  return 0;
}

// Wits-specific band table for Life Orientation (0–4)
function witsBandLO(percent) {
  const p = clamp(Number(percent));
  if (p >= 90) return 4;
  if (p >= 80) return 3;
  if (p >= 70) return 2;
  if (p >= 60) return 1;
  return 0;
}

// ─── University models ────────────────────────────────────────────────────────

/**
 * APS_UNIVEN — University of Venda's own points scale (2027 prospectus).
 * Each subject's score is its percentage mark divided by 10 (e.g. 82% = 8.2,
 * 95% = 9.5), NOT the standard 1–7 NSC achievement level. Subjects below 40%
 * score 0 and are excluded entirely from the calculation. Life Orientation is
 * always excluded. If a learner has more than 7 qualifying subjects, only the
 * best 7 (by mark) are used.
 * Used by: University of Venda (UNIVEN)
 */
function aps_univen(subjects) {
  const pool = subjects.filter((s) =>
    !isLifeOrientation(s.subject) &&
    s.mark !== null && s.mark !== undefined && s.mark !== "" &&
    Number.isFinite(Number(s.mark)) &&
    Number(s.mark) >= 40
  );
  const chosen = bestN(pool, 7, (s) => Number(s.mark));
  const total = chosen.reduce((sum, s) => sum + Number(s.mark) / 10, 0);
  return Math.round(total * 10) / 10;
}

/**
 * APS_NSC_42 — best 6 NSC levels, Life Orientation excluded.
 * Used by: UJ, UFS, NWU, UKZN, UL, UZ, WSU, TUT, UNISA, DUT, CUT, CPUT,
 *          NMU, RU, SMU, SPU, UFH, MUT, UMP, UWC, VUT, UP, UKZN
 */
function aps_nsc_42(subjects) {
  const pool = subjects.filter((s) =>
    !isLifeOrientation(s.subject) &&
    s.mark !== null && s.mark !== undefined && s.mark !== "" &&
    Number.isFinite(Number(s.mark))
  );
  const chosen = bestN(pool, 6, (s) => convertMarkToAPS(s.mark));
  return chosen.reduce((sum, s) => sum + convertMarkToAPS(s.mark), 0);
}

/**
 * APS_NSC_49 — best 7 NSC levels, LO included if it's in the best 7.
 * Used by: Some institutions that include LO in the 7-subject count.
 */
function aps_nsc_49(subjects) {
  const chosen = bestN(subjects, 7, (s) => convertMarkToAPS(s.mark));
  return chosen.reduce((sum, s) => sum + convertMarkToAPS(s.mark), 0);
}

/**
 * APS_WITS — Wits own weighted table + +2 bonus for Maths & English.
 * LO uses a separate 0–4 table. Best 7 subjects (including 1 LO).
 * Used by: University of the Witwatersrand
 */
function aps_wits(subjects) {
  const scored = subjects.map((s) => {
    let pts = 0;
    if (isLifeOrientation(s.subject)) {
      pts = witsBandLO(s.mark);
    } else {
      pts = witsBandOther(s.mark);
      if (isMaths(s.subject) || isEnglish(s.subject)) pts += 2;
    }
    return { ...s, pts };
  });

  const loSubjects = scored.filter((s) => isLifeOrientation(s.subject));
  const nonLo = scored.filter((s) => !isLifeOrientation(s.subject));

  const chosen = [];
  if (loSubjects.length) chosen.push(...bestN(loSubjects, 1, (s) => s.pts));
  chosen.push(...bestN(nonLo, 7 - chosen.length, (s) => s.pts));

  return chosen.reduce((sum, s) => sum + s.pts, 0);
}

/**
 * UCT_FPS_600 — Faculty Points Score: sum of 6 best subject percentages (LO excluded).
 * Out of 600.
 * Used by: University of Cape Town
 */
function uct_fps_600(subjects) {
  const pool = subjects.filter((s) => !isLifeOrientation(s.subject));
  const chosen = bestN(pool, 6, (s) => Number(s.mark));
  return Math.round(chosen.reduce((sum, s) => sum + Number(s.mark), 0));
}

/**
 * STELLIES_NSC_AVG — Best LoLT (English or Afrikaans) + best 5 other 20-credit subjects
 * (LO excluded), divided by 6. Returns a percentage average.
 * Used by: Stellenbosch University
 */
function stellies_nsc_avg(subjects) {
  const loltPool = subjects.filter(
    (s) => isEnglish(s.subject) || isAfrikaans(s.subject)
  );
  const bestLoLT = bestN(loltPool, 1, (s) => Number(s.mark))[0];

  const pool = subjects.filter((s) => !isLifeOrientation(s.subject));
  const poolWithoutLoLT = bestLoLT
    ? pool.filter((s) => s.subject !== bestLoLT.subject)
    : pool;
  const bestFive = bestN(poolWithoutLoLT, 5, (s) => Number(s.mark));

  const parts = [bestLoLT, ...bestFive].filter(Boolean);
  const sum = parts.reduce((a, s) => a + Number(s.mark), 0);
  const avg = parts.length ? sum / 6 : 0;
  return Math.round(avg * 10) / 10;
}

/**
 * APS_UWC — University of the Western Cape's own weighted "UWC Points" table
 * (2027 Admissions Criteria brochure). Unlike the generic best-6 NSC model,
 * UWC scores English, Mathematics, Life Orientation, and "All Other Subjects"
 * on FOUR DIFFERENT scales, and extends the top percentage band (90–100%) as
 * its own tier above the standard NSC level 7 (80–100%):
 *
 *   %        | NSC lvl | English | Maths | Life Orient. | All Other Subjects
 *   90–100   |   7     |   15    |  15   |      3       |         8
 *   80–89    |   7     |   13    |  13   |      3       |         7
 *   70–79    |   6     |   11    |  11   |      2       |         6
 *   60–69    |   5     |    9    |   9   |      2       |         5
 *   50–59    |   4     |    7    |   5   |      1       |         4
 *   40–49    |   3     |    5    |   3   |      1       |         3
 *   30–39    |   2     |    3    |   2   |      1       |         2
 *   20–29    |   1     |    1    |   1   |      0       |         1
 *   <20      |   0     |    0    |   0   |      0       |         0
 *
 * All of a learner's subjects are summed (the brochure does not describe a
 * "best N" reduction the way the generic APS model does). English is scored
 * on the English column; Mathematics is scored on the Maths column; Life
 * Orientation is capped via its own column; every other subject (including,
 * as a documented assumption, Mathematical Literacy — the source brochure
 * flags that "Mathematics or Mathematics Literacy... have different point
 * scores" but does not print a separate Maths Literacy scale on this page)
 * uses the "All Other Subjects" column.
 *
 * NOTE on Mathematical Literacy: the shared isMaths() helper only matches
 * "Mathematics" (and near-variants), not "Mathematical Literacy" — so Maths
 * Literacy is scored on the "All Other Subjects" column here, not the Maths
 * column. This is a deliberate, documented assumption filling a gap in the
 * source brochure (which flags that Maths and Maths Literacy score
 * differently but only prints one "Mathematics" column on this page, with no
 * separate Maths Literacy scale given). Verify against UWC's full published
 * prospectus if precision here matters for a specific learner.
 *
 * NOTE: this "UWC points" total is a different number from the per-subject
 * NSC achievement level (1–7) used elsewhere for course subject requirements
 * like "Maths Code 4" — those still convert via convertMarkToAPS/levelToMinMark
 * as usual. Only the *summed total* compared against a course's minAPS (e.g.
 * "Minimum of 30 UWC points") uses this weighted scale.
 */
const UWC_BANDS = [
  { min: 90, english: 15, maths: 15, lo: 3, other: 8 },
  { min: 80, english: 13, maths: 13, lo: 3, other: 7 },
  { min: 70, english: 11, maths: 11, lo: 2, other: 6 },
  { min: 60, english: 9,  maths: 9,  lo: 2, other: 5 },
  { min: 50, english: 7,  maths: 5,  lo: 1, other: 4 },
  { min: 40, english: 5,  maths: 3,  lo: 1, other: 3 },
  { min: 30, english: 3,  maths: 2,  lo: 1, other: 2 },
  { min: 20, english: 1,  maths: 1,  lo: 0, other: 1 },
  { min: 0,  english: 0,  maths: 0,  lo: 0, other: 0 },
];

function uwcBandFor(percent) {
  const p = clamp(Number(percent));
  return UWC_BANDS.find((b) => p >= b.min) || UWC_BANDS[UWC_BANDS.length - 1];
}

function aps_uwc(subjects) {
  let total = 0;
  subjects.forEach((s) => {
    const band = uwcBandFor(s.mark);
    let category;
    if (isLifeOrientation(s.subject)) category = "lo";
    else if (isEnglish(s.subject)) category = "english";
    else if (isMaths(s.subject)) category = "maths"; // includes Mathematical Literacy — see note above
    else category = "other";
    total += band[category];
  });
  return total;
}

/**
 * CPUT (Cape Peninsula University of Technology) uses THREE different APS
 * methods depending on the qualification (2027 Prospectus, "Calculating the
 * APS Score"). Crucially, all three methods sum raw NSC PERCENTAGES (not the
 * 1–7 achievement level used by aps_nsc_42) and divide by 10 — a materially
 * different, higher-ceilinged scale (roughly 0–70) from the generic
 * level-based APS_NSC_42 scale (0–42). CPUT was previously mapped to
 * APS_NSC_42 by mistake; that model would silently under- or over-score
 * every CPUT applicant against thresholds like "30.4" or "45.8" that only
 * make sense on the percent-sum scale.
 *
 * Because the method varies PER QUALIFICATION rather than per institution,
 * these are selected via an optional `apsMethod` field on the course record
 * ("method1" | "method2" | "method3"), resolved by calculateAPSForCourse()
 * below — NOT via the institution-wide UNIVERSITY_MODELS map.
 */

// METHOD 1: Best of six subjects (excluding Life Orientation), raw % summed ÷ 10.
function cput_method1(subjects) {
  const pool = subjects.filter((s) =>
    !isLifeOrientation(s.subject) &&
    s.mark !== null && s.mark !== undefined && s.mark !== "" &&
    Number.isFinite(Number(s.mark))
  );
  const chosen = bestN(pool, 6, (s) => clamp(Number(s.mark)));
  const total = chosen.reduce((sum, s) => sum + clamp(Number(s.mark)), 0);
  return Math.round((total / 10) * 10) / 10;
}

// METHOD 2: Mathematics and Physical Science doubled, plus English and the
// next-best remaining subject (excluding LO), raw % summed ÷ 10.
function cput_method2(subjects) {
  const pool = subjects.filter((s) =>
    s.mark !== null && s.mark !== undefined && s.mark !== "" &&
    Number.isFinite(Number(s.mark)) && !isLifeOrientation(s.subject)
  );
  const english = pool.find((s) => isEnglish(s.subject));
  const maths = pool.find((s) => isMaths(s.subject) && !normalizeName(s.subject).includes("literacy"));
  const physSci = pool.find((s) => normalizeName(s.subject).includes("physical science"));
  const used = new Set([english, maths, physSci].filter(Boolean));
  const rest = pool.filter((s) => !used.has(s));
  const next = bestN(rest, 1, (s) => clamp(Number(s.mark)))[0];

  let total = 0;
  if (english) total += clamp(Number(english.mark));
  if (maths) total += clamp(Number(maths.mark)) * 2;
  if (physSci) total += clamp(Number(physSci.mark)) * 2;
  if (next) total += clamp(Number(next.mark));
  return Math.round((total / 10) * 10) / 10;
}

// METHOD 3: Mathematics and Accounting doubled, plus English and the 3
// next-best remaining subjects (excluding LO), raw % summed ÷ 10.
function cput_method3(subjects) {
  const pool = subjects.filter((s) =>
    s.mark !== null && s.mark !== undefined && s.mark !== "" &&
    Number.isFinite(Number(s.mark)) && !isLifeOrientation(s.subject)
  );
  const english = pool.find((s) => isEnglish(s.subject));
  const maths = pool.find((s) => isMaths(s.subject) && !normalizeName(s.subject).includes("literacy"));
  const accounting = pool.find((s) => normalizeName(s.subject).includes("accounting"));
  const used = new Set([english, maths, accounting].filter(Boolean));
  const rest = pool.filter((s) => !used.has(s));
  const nextThree = bestN(rest, 3, (s) => clamp(Number(s.mark)));

  let total = 0;
  if (english) total += clamp(Number(english.mark));
  if (maths) total += clamp(Number(maths.mark)) * 2;
  if (accounting) total += clamp(Number(accounting.mark)) * 2;
  total += nextThree.reduce((sum, s) => sum + clamp(Number(s.mark)), 0);
  return Math.round((total / 10) * 10) / 10;
}

const CPUT_METHOD_LABELS = {
  method1: "CPUT APS Method 1 (best 6 subjects, % ÷ 10)",
  method2: "CPUT APS Method 2 (Maths + Physical Science doubled, % ÷ 10)",
  method3: "CPUT APS Method 3 (Maths + Accounting doubled, % ÷ 10)",
};

/**
 * Resolve the correct APS score for a specific COURSE, not just its
 * institution. Most institutions use one fixed model, so this simply
 * delegates to calculateAPSForUniversity — except when the course itself
 * declares an `apsMethod` (currently only CPUT courses do), in which case
 * that per-qualification method takes priority over the institution default.
 */
export function calculateAPSForCourse(course, subjects) {
  const method = course?.apsMethod;
  if (method === "method1") return { score: cput_method1(subjects), model: "CPUT_METHOD1", label: CPUT_METHOD_LABELS.method1 };
  if (method === "method2") return { score: cput_method2(subjects), model: "CPUT_METHOD2", label: CPUT_METHOD_LABELS.method2 };
  if (method === "method3") return { score: cput_method3(subjects), model: "CPUT_METHOD3", label: CPUT_METHOD_LABELS.method3 };
  return calculateAPSForUniversity(course?.institution, subjects);
}

// ─── University → model map ────────────────────────────────────────────────────

const UNIVERSITY_MODELS = {
  // Verified
  "University of Johannesburg":       "APS_NSC_42",
  "University of the Witwatersrand":  "APS_WITS",
  "University of Cape Town":          "UCT_FPS_600",
  "Stellenbosch University":          "STELLIES_NSC_AVG",
  "North-West University":            "APS_NSC_42",

  // Standard NSC best-6 (provisional / verified)
  "University of Pretoria":                          "APS_NSC_42",
  "University of KwaZulu-Natal":                     "APS_NSC_42",
  "University of the Free State":                    "APS_NSC_42",
  "University of Limpopo":                           "APS_NSC_42",
  "University of Zululand":                          "APS_NSC_42",
  "University of Venda":                             "APS_UNIVEN",
  "University of Fort Hare":                         "APS_NSC_42",
  "University of Mpumalanga":                        "APS_NSC_42",
  "University of South Africa":                      "APS_NSC_42",
  "University of the Western Cape":                  "APS_UWC",
  "Nelson Mandela University":                       "APS_NSC_42",
  "Rhodes University":                               "APS_NSC_42",
  "Walter Sisulu University":                        "APS_NSC_42",
  "Tshwane University of Technology":                "APS_NSC_42",
  "Durban University of Technology":                 "APS_NSC_42",
  "Central University of Technology":                "APS_NSC_42",
  "Cape Peninsula University of Technology":         "APS_NSC_42",
  "Mangosuthu University of Technology":             "APS_NSC_42",
  "Vaal University of Technology":                   "APS_NSC_42",
  "Sefako Makgatho Health Sciences University":      "APS_NSC_42",
  "Sol Plaatje University":                          "APS_NSC_42",
};

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Calculate APS for a specific university using its correct scoring model.
 *
 * @param {string} universityName - Name of the university
 * @param {Array<{subject: string, mark: number|string}>} subjects - Array of subject/mark pairs
 * @returns {{ score: number, model: string, label: string }}
 */
export function calculateAPSForUniversity(universityName, subjects) {
  const model = UNIVERSITY_MODELS[universityName] ?? "APS_NSC_42";

  let score;
  switch (model) {
    case "APS_NSC_42":      score = aps_nsc_42(subjects);     break;
    case "APS_NSC_49":      score = aps_nsc_49(subjects);     break;
    case "APS_WITS":        score = aps_wits(subjects);       break;
    case "UCT_FPS_600":     score = uct_fps_600(subjects);    break;
    case "STELLIES_NSC_AVG": score = stellies_nsc_avg(subjects); break;
    case "APS_UNIVEN":      score = aps_univen(subjects);     break;
    case "APS_UWC":         score = aps_uwc(subjects);        break;
    default:                score = aps_nsc_42(subjects);
  }

  const labels = {
    APS_NSC_42:       "APS (best 6 levels, LO excluded)",
    APS_NSC_49:       "APS (best 7 levels, LO included)",
    APS_WITS:         "Wits APS (weighted + Maths/English bonus)",
    UCT_FPS_600:      "UCT Faculty Points Score (out of 600)",
    STELLIES_NSC_AVG: "Stellenbosch NSC average (%)",
    APS_UNIVEN:       "UNIVEN APS (% ÷ 10 per subject, best 7, LO excluded)",
    APS_UWC:          "UWC Points (weighted English/Maths/LO/Other scale, all subjects summed)",
  };

  return { score, model, label: labels[model] };
}

/**
 * Calculate a general-purpose APS using NSC best-6 (LO excluded).
 * Used on the EnterMarks page before a university is selected.
 */
export function calculateGeneralAPS(subjects) {
  return aps_nsc_42(subjects);
}

// ─── Alternate APS (subject-dependent minimum) ─────────────────────────────────
//
// Some courses set a different minimum APS depending on which "track" subject
// the learner took — most commonly Mathematics vs Mathematical Literacy, e.g.
// "APS 30 with Mathematics, but APS 34 with Mathematical Literacy".
//
// This is stored on the course document as:
//   minAPS:          30                                      // default / base
//   apsAlternatives: [{ subject: "Mathematical Literacy", minAPS: 34 }]
//
// A learner only ever "has" one of the alternative subjects (they can't have
// taken both Mathematics and Mathematical Literacy), so the first matching
// alternative found is used. If none of the learner's subjects match any
// listed alternative, the course's base minAPS applies.

/**
 * Work out the minimum APS that actually applies to this learner for this
 * course, taking any subject-dependent alternatives into account.
 *
 * @param {object} course - course doc, may have minAPS and apsAlternatives
 * @param {Array<{subject: string, mark: number|string}>} userSubjects
 * @returns {number}
 */
export function getEffectiveMinAPS(course, userSubjects) {
  const base = Number(course?.minAPS) || 0;
  const alternatives = course?.apsAlternatives;
  if (!alternatives || alternatives.length === 0) return base;

  const subjects = userSubjects || [];
  for (const alt of alternatives) {
    if (!alt?.subject) continue;
    const hasSubject = subjects.some(
      (s) =>
        subjectMatches(s.subject, alt.subject) &&
        s.mark !== null && s.mark !== undefined && s.mark !== "" &&
        Number.isFinite(Number(s.mark))
    );
    if (hasSubject) return Number(alt.minAPS);
  }
  return base;
}

// ─── College / NQF eligibility ─────────────────────────────────────────────────
//
// TVET and private colleges in South Africa typically do NOT use APS at all.
// Instead, admission is based on:
//   1. The highest school grade completed (Grade 9 minimum), and/or
//   2. An NQF level (1–4) the learner has demonstrated competency in.
//
// NQF levels map roughly to grades like this for school-going learners:
//   NQF Level 1 ≈ Grade 9
//   NQF Level 2 ≈ Grade 10
//   NQF Level 3 ≈ Grade 11
//   NQF Level 4 ≈ Grade 12 (NSC / matric)
//
// A course's minimum requirement is stored on the course document as:
//   minGrade:    "Grade 9" | "Grade 10" | "Grade 11" | "Grade 12" | null
//   minNQFLevel: 1 | 2 | 3 | 4 | null
// At least one of these should be set for a college course; if both are set,
// the learner must satisfy BOTH (rare, but some advanced NCV programmes do this).

const GRADE_TO_NUM = { "Grade 9": 9, "Grade 10": 10, "Grade 11": 11, "Grade 12": 12 };
const GRADE_TO_NQF = { "Grade 9": 1, "Grade 10": 2, "Grade 11": 3, "Grade 12": 4 };

/**
 * Convert a user's grade + status into:
 *   - highestGradeCompleted (label, e.g. "Grade 11")
 *   - highestGradeNum       (number, e.g. 9–12)
 *   - highestNQFCompleted   (number, e.g. 1–4)
 *
 * Status "current" means the user is currently IN the stated grade, so the
 * highest COMPLETED grade is one below it (e.g. currently in Grade 12 →
 * only Grade 11 counts as completed). Status "completed" means the stated
 * grade itself has been completed.
 */
export function getHighestCompletedLevel(grade, gradeStatus) {
  if (!grade || !GRADE_TO_NUM[grade]) {
    return { highestGradeCompleted: null, highestGradeNum: 0, highestNQFCompleted: 0 };
  }

  const gradeNum = GRADE_TO_NUM[grade];
  const completedNum = gradeStatus === "current" ? Math.max(gradeNum - 1, 0) : gradeNum;
  const completedLabel = Object.keys(GRADE_TO_NUM).find((g) => GRADE_TO_NUM[g] === completedNum) || null;
  const nqf = completedLabel ? GRADE_TO_NQF[completedLabel] : 0;

  return {
    highestGradeCompleted: completedLabel,
    highestGradeNum: completedNum,
    highestNQFCompleted: nqf,
  };
}

/**
 * Check whether a user meets a college course's grade/NQF requirement.
 *
 * @param {string} grade        - e.g. "Grade 11"
 * @param {string} gradeStatus  - "current" | "completed"
 * @param {object} course       - course doc with optional minGrade / minNQFLevel
 * @returns {boolean}
 */
export function meetsCollegeRequirement(grade, gradeStatus, course) {
  const { highestGradeNum, highestNQFCompleted } = getHighestCompletedLevel(grade, gradeStatus);

  // Nothing required on the course → always eligible (open enrolment)
  if (!course.minGrade && !course.minNQFLevel) return true;

  let gradeOk = true;
  let nqfOk = true;

  if (course.minGrade && GRADE_TO_NUM[course.minGrade]) {
    gradeOk = highestGradeNum >= GRADE_TO_NUM[course.minGrade];
  }
  if (course.minNQFLevel) {
    nqfOk = highestNQFCompleted >= Number(course.minNQFLevel);
  }

  if (course.minGrade && !course.minNQFLevel) return gradeOk;
  if (course.minNQFLevel && !course.minGrade) return nqfOk;
  return gradeOk && nqfOk; // both set → must satisfy both
}

/**
 * Human-readable label for what a user has completed, used in the UI.
 */
export function getCompletionLabel(grade, gradeStatus) {
  const { highestGradeCompleted, highestNQFCompleted } = getHighestCompletedLevel(grade, gradeStatus);
  if (!highestGradeCompleted) return "No completed grade on record";
  return `${highestGradeCompleted} completed (NQF Level ${highestNQFCompleted})`;
}