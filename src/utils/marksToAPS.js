import { subjectMatches, isGenericCreditSubject, isAnotherLanguagePlaceholder } from "./subjectMatch.js";

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
  if (course?.institution === "Nelson Mandela University") {
    return {
      score: aps_nmu_for_course(course, subjects),
      model: "APS_NMU",
      label: "NMU Applicant Score (fundamentals + course-required subjects locked in, best-of-rest fills remaining slots, out of 600)",
    };
  }
  return calculateAPSForUniversity(course?.institution, subjects);
}

/**
 * APS_UNIZULU — University of Zululand's own points system (2026 Undergraduate
 * Programmes brochure). Two things make it different from the generic
 * APS_NSC_42 model it was previously (incorrectly) mapped to:
 *
 * 1. It sums ALL subjects the learner took (not just the best 6) — though for
 *    a standard 7-subject NSC certificate (6 non-LO + LO) this is usually
 *    equivalent in practice, since there's nothing to drop.
 * 2. It awards an extra "bonus" 8th point for any subject scored at 90–100%,
 *    one band above the normal level-7 ceiling (80–100%). This is not stated
 *    in UNIZULU's own conversion table (which only lists levels 1–7), but is
 *    directly demonstrated by the brochure's own worked example: IsiZulu at
 *    90% is awarded 8 points, while Mathematics at 80% (also nominally
 *    "band 7") is awarded only 7 — confirmed by reproducing their example
 *    exactly (English 75%→6, IsiZulu FAL 90%→8, Maths 80%→7, Life Science
 *    62%→5, Physical Sciences 72%→6, Life Orientation 68%→0, total 32).
 *
 * Life Orientation always contributes 0 and is excluded from the sum
 * entirely (matching the brochure's example, where it's listed but
 * contributes nothing to the total).
 */
function aps_unizulu(subjects) {
  let total = 0;
  subjects.forEach((s) => {
    if (isLifeOrientation(s.subject)) return;
    const mark = clamp(Number(s.mark));
    total += mark >= 90 ? 8 : convertMarkToAPS(mark);
  });
  return total;
}

/**
 * APS_RHODES — Rhodes University's own points scale (RU Ready! Undergraduate
 * Prospectus, "How to Calculate your Admission Point Score"). Each subject's
 * score is its raw percentage mark divided by 10 (e.g. 78% = 7.8), NOT the
 * standard 1–7 NSC achievement level — confirmed by reproducing the
 * brochure's own worked example exactly (English HL 78%→7.8, isiXhosa 74%→7.4,
 * Maths 65%→6.5, Life Sciences 75%→7.5, Accounting 72%→7.2, History 69%→6.9,
 * total 43.3). Life Orientation is excluded from the total entirely (shown in
 * the example with a "-" in the Points column) but a learner must still score
 * at least Level 4 (50%) in it to be considered. Unlike APS_UNIVEN, there's no
 * stated minimum-mark cutoff for inclusion and no "best 7" reduction — the
 * brochure's instructions and example both use exactly 6 non-LO subjects (a
 * standard NSC certificate has 6 non-LO subjects + LO), so all non-LO
 * subjects are summed.
 */
function aps_rhodes(subjects) {
  const pool = subjects.filter((s) =>
    !isLifeOrientation(s.subject) &&
    s.mark !== null && s.mark !== undefined && s.mark !== "" &&
    Number.isFinite(Number(s.mark))
  );
  const chosen = bestN(pool, 6, (s) => Number(s.mark));
  const total = chosen.reduce((sum, s) => sum + Number(s.mark) / 10, 0);
  return Math.round(total * 10) / 10;
}

/**
 * APS_SPU — Sol Plaatje University's own points scale (2027 Undergraduate
 * Prospectus, "How to Calculate the SPU Admission Point Score (APS)"). This
 * is NOT the generic best-6/LO-excluded model it was previously (incorrectly)
 * mapped to. Differences, taken directly from the brochure's table:
 *
 * 1. Each subject's own score tops out at 8 (for 90–100%), not 7 — the top
 *    NSC achievement level (7) is split into two SPU bands: 90–100% → 8
 *    points, 80–89% → 7 points. Bands below that match the standard NSC
 *    achievement levels 1–6.
 * 2. Mathematics AND whichever official language a learner takes as Home
 *    Language earn extra "Additional Points" — the brochure states these
 *    apply "to any of the official languages taken as HL", not just English.
 *    The bonus itself is banded, not a flat amount: +2 for 60%+, +1 for
 *    40–59%, +0 below 40%.
 * 3. Life Orientation is NOT excluded the way it is at most universities —
 *    it contributes to the total via its own separate, much lower-ceilinged
 *    scale (max 4 points at 90–100%, 0 below 60%), rather than the main
 *    subject scale and rather than being dropped entirely.
 * 4. The brochure gives no "best N subjects" instruction (unlike the
 *    generic APS_NSC_42 model's "best 6"), so all of a learner's subjects
 *    are summed — consistent with how a standard 7-subject NSC certificate
 *    (6 subjects + Life Orientation) is used at face value elsewhere in this
 *    codebase (e.g. APS_UNIZULU, APS_UWC) when a source doesn't state a
 *    reduction.
 */
function spuMainBand(percent) {
  const p = clamp(Number(percent));
  if (p >= 90) return 8;
  if (p >= 80) return 7;
  if (p >= 70) return 6;
  if (p >= 60) return 5;
  if (p >= 50) return 4;
  if (p >= 40) return 3;
  if (p >= 30) return 2;
  return 1;
}

function spuBonusBand(percent) {
  const p = clamp(Number(percent));
  if (p >= 60) return 2;
  if (p >= 40) return 1;
  return 0;
}

function spuLOBand(percent) {
  const p = clamp(Number(percent));
  if (p >= 90) return 4;
  if (p >= 80) return 3;
  if (p >= 70) return 2;
  if (p >= 60) return 1;
  return 0;
}

function isHomeLanguage(name) {
  return normalizeName(name).endsWith("home language");
}

function aps_spu(subjects) {
  let total = 0;
  subjects.forEach((s) => {
    if (s.mark === null || s.mark === undefined || s.mark === "" || !Number.isFinite(Number(s.mark))) return;
    if (isLifeOrientation(s.subject)) {
      total += spuLOBand(s.mark);
      return;
    }
    let pts = spuMainBand(s.mark);
    if (isMaths(s.subject) || isHomeLanguage(s.subject)) {
      pts += spuBonusBand(s.mark);
    }
    total += pts;
  });
  return total;
}

/**
 * APS_MUT — Mangosuthu University of Technology's own points scale (MUT
 * Undergraduate Prospectus, "Admission Points Calculation Guide"). This is
 * NOT identical to the generic APS_NSC_42 model it was previously mapped to.
 * The brochure's own NSC-to-points table matches the standard 1–7 NSC
 * achievement level for every band EXCEPT the top one, which it splits in
 * two: 90–100% earns 8 points (one point above the standard Level 7 ceiling
 * of 7), while 80–89% still earns 7 — the same split used by APS_UNIZULU and
 * APS_SPU above. MUT's general admission requirements state the aggregate is
 * "calculated from the best six subjects presented by the prospective
 * student", so — unlike APS_UNIZULU, which sums all subjects — this keeps
 * the "best 6" reduction from the generic model. Life Orientation is not
 * mentioned in the brochure's calculation guide at all; it is excluded here
 * as a documented assumption, consistent with how LO is excluded from the
 * "best 6" at every other South African university in this codebase that
 * uses a best-6 model.
 */
function mutBand(percent) {
  const p = clamp(Number(percent));
  if (p >= 90) return 8;
  return convertMarkToAPS(p);
}

function aps_mut(subjects) {
  const pool = subjects.filter((s) =>
    !isLifeOrientation(s.subject) &&
    s.mark !== null && s.mark !== undefined && s.mark !== "" &&
    Number.isFinite(Number(s.mark))
  );
  const chosen = bestN(pool, 6, (s) => mutBand(s.mark));
  return chosen.reduce((sum, s) => sum + mutBand(s.mark), 0);
}

/**
 * APS_NMU — Nelson Mandela University's own "Applicant Score" (AS) (NMU
 * Undergraduate Guide, "Admission Requirements" / "How to calculate your
 * Applicant Score (AS)"). This is NOT the generic level-based APS_NSC_42
 * model it was previously (incorrectly) mapped to — NMU sums raw NSC
 * PERCENTAGES, not 1–7 achievement levels, giving a score out of 600 rather
 * than 42. Confirmed by reproducing the guide's own worked examples exactly:
 *
 *   Applicant 1 (7 subjects): isiXhosa HL 78, English FAL 60, Maths 65,
 *   Life Science 62, Physical Science 50, Geography 55, LO 88 (excluded)
 *   → 78+60+65+62+50+55 = 370.
 *
 *   Applicant 2 (8 subjects, i.e. 7 non-LO subjects incl. both History 60
 *   and Geography 55): best 6 of the 7 non-LO subjects are used (History
 *   beats Geography) → 78+60+65+62+50+60 = 375.
 *
 * So far this matches a simple "best 6 non-LO subjects by percentage,
 * summed" model (no conversion to achievement level) — that's what
 * aps_nmu_generic() below does, used only as a fallback when no specific
 * course/qualification is known (see calculateAPSForUniversity).
 *
 * BUT a second worked example in the same guide (an 8-subject applicant
 * applying to a programme that requires Life Science AND Physical Science)
 * shows the selection is NOT simply "top 6 by mark": that applicant's
 * subjects were isiXhosa HL 78, English FAL 60, Maths 65, Life Science 62,
 * Physical Science 50, History 60, Geography 55, LO 88. A pure top-6-by-value
 * selection would drop Physical Science (the lowest, 50) in favour of
 * Geography (55) — but the guide's total (375) only works if Geography is
 * dropped and Physical Science is KEPT, even though it scores lower. The
 * only way that's consistent is if the three fundamental subjects (Home
 * Language, First Additional Language, Maths/Technical Maths/Maths Literacy)
 * PLUS whichever subjects the target programme specifically requires
 * (Life Science and Physical Science, for that example) are locked in
 * regardless of rank, and only the remaining slots (to reach 6 total) are
 * filled by best-of-the-rest:
 *   locked = {isiXhosa 78, English 60, Maths 65, Life Science 62, Physical
 *             Science 50} (5 locked: 3 fundamentals + 2 programme-required)
 *   1 slot left, filled by the better of {History 60, Geography 55} → History
 *   total = 78+60+65+62+50+60 = 375 ✓ (reproduces the guide exactly)
 * This is why aps_nmu_for_course() below takes the COURSE's keySubjects into
 * account, not just the raw subject list — the correct AS is qualification-
 * dependent, similar to how CPUT's method varies per qualification.
 *
 * KNOWN GAP — quintile bonus not applied: the guide also states that
 * applicants from quintile 1–3 (no-fee) schools who score 50%+ in Life
 * Orientation get +7 added to this total (a third worked example: 370 + 7 =
 * 377). This app does not currently capture a learner's school quintile
 * anywhere in the marks-entry flow, so that bonus cannot be applied
 * automatically yet — both functions below return the un-bonused base score
 * out of 600. If quintile capture is added to EnterMarks.jsx, these should
 * take that as a parameter and add the +7 when eligible.
 *
 * Per-programme "AS for Maths" / "AS for Technical Maths" / "AS for Maths
 * Literacy" columns in the guide map directly onto this app's existing
 * minAPS + apsAlternatives mechanism: minAPS = AS for Mathematics (Technical
 * Mathematics uses the same figure in every programme observed in the
 * guide, so it doesn't need its own alternative entry unless a specific
 * programme differs), apsAlternatives = [{ subject: "Mathematical Literacy",
 * minAPS: <AS for Maths Literacy> }].
 *
 * Used by: Nelson Mandela University
 */
function isNmuHomeLanguage(name) {
  return normalizeName(name).endsWith("home language");
}
function isNmuFirstAddLanguage(name) {
  return normalizeName(name).endsWith("first additional language");
}
function isNmuMathsTrack(name) {
  const n = normalizeName(name);
  return n.includes("mathematics") || n.includes("mathematical literacy") || n === "maths";
}

// Generic fallback (no course context available): best 6 non-LO subjects by
// raw percentage, summed. Used only when just an institution name is known
// (e.g. displaying an approximate AS before a specific course is picked).
function aps_nmu_generic(subjects) {
  const pool = subjects.filter((s) =>
    !isLifeOrientation(s.subject) &&
    s.mark !== null && s.mark !== undefined && s.mark !== "" &&
    Number.isFinite(Number(s.mark))
  );
  const chosen = bestN(pool, 6, (s) => Number(s.mark));
  return Math.round(chosen.reduce((sum, s) => sum + Number(s.mark), 0) * 10) / 10;
}

// Course-aware version: locks in the 3 fundamental subjects plus whichever
// subjects the specific course requires (via keySubjects), then fills any
// remaining slots (up to 6 total) with the best-of-the-rest by percentage.
function aps_nmu_for_course(course, subjects) {
  const pool = subjects.filter((s) =>
    !isLifeOrientation(s.subject) &&
    s.mark !== null && s.mark !== undefined && s.mark !== "" &&
    Number.isFinite(Number(s.mark))
  );

  const locked = [];
  const lockedSet = new Set();
  const lock = (s) => {
    if (s && !lockedSet.has(s)) {
      lockedSet.add(s);
      locked.push(s);
    }
  };

  // 3 fundamentals: Home Language, First Additional Language, Maths track
  lock(pool.find((s) => isNmuHomeLanguage(s.subject)));
  lock(pool.find((s) => isNmuFirstAddLanguage(s.subject)));
  lock(pool.find((s) => isNmuMathsTrack(s.subject)));

  // Course-required subjects (skip generic placeholders and LO)
  (course?.keySubjects || []).forEach((req) => {
    if (req.subjectGroup) {
      for (const opt of req.subjectGroup) {
        if (isGenericCreditSubject(opt.subject) || isAnotherLanguagePlaceholder(opt.subject)) continue;
        if (isLifeOrientation(opt.subject)) continue;
        const match = pool.find((s) => subjectMatches(s.subject, opt.subject));
        if (match) { lock(match); break; }
      }
    } else if (
      req.subject &&
      !isGenericCreditSubject(req.subject) &&
      !isAnotherLanguagePlaceholder(req.subject) &&
      !isLifeOrientation(req.subject)
    ) {
      lock(pool.find((s) => subjectMatches(s.subject, req.subject)));
    }
  });

  const remaining = pool.filter((s) => !lockedSet.has(s));
  const slotsLeft = Math.max(0, 6 - locked.length);
  const filler = bestN(remaining, slotsLeft, (s) => Number(s.mark));
  const chosen = [...locked, ...filler].slice(0, 6);

  return Math.round(chosen.reduce((sum, s) => sum + Number(s.mark), 0) * 10) / 10;
}

/**
 * APS_UKZN — UKZN's own "Composite Academic Performance Score (NSC-Deg)".
 * Confirmed from the 2027 Undergraduate Prospectus (p.17): each subject's
 * NSC achievement level (1–7, same %-bands as the standard NSC scale) IS its
 * points value directly — there is no 8-point bonus for 90–100% the way
 * Wits/UWC award one. Life Orientation always scores 0 points regardless of
 * its level (shown explicitly in the prospectus's worked example: LO at
 * level 4 contributes 0, not 4).
 *
 * For a standard NSC candidate (exactly 6 non-LO subjects, i.e. 7 total incl.
 * LO), the total is simply the sum of all 6 non-LO subjects' levels — the
 * example in the prospectus (Home Language 5, FAL 6, LO 4→0, Maths 5,
 * Accounting 6, Business Studies 6, CAT 7) sums to 5+6+5+6+6+7 = 35.
 *
 * For a learner with MORE than 7 subjects total (i.e. more than 6 non-LO
 * subjects), the prospectus specifies a different, narrower rule: "the APS
 * is calculated by adding the performance ratings of English (HL or FAL)
 * plus Mathematics or Mathematical Literacy plus the best ratings of four
 * other subjects (excluding LO or Maths Paper 3). No bonus points are
 * awarded for additional subjects." That is: English and Maths/Maths Literacy
 * are locked in regardless of rank, then the best 4 of whatever remains
 * (excluding LO and Maths Paper 3) fill the rest — this can differ from a
 * naive "best 6 of everything" if a learner's English or Maths mark isn't
 * among their strongest subjects.
 *
 * This function applies that "locked English + locked Maths/Maths Literacy +
 * best 4 of the rest" rule uniformly (it also reproduces the same 35-point
 * result for the standard 6-non-LO-subject example above, since with only 6
 * non-LO subjects "best 4 of the rest" is just "the remaining 4", so no
 * separate branch is needed for the ≤7-subject case).
 *
 * Used by: University of KwaZulu-Natal
 */
function isUkznMathsTrack(name) {
  const n = normalizeName(name);
  return n.includes("mathematics") || n.includes("mathematical literacy") || n === "maths";
}
function isMathsPaper3(name) {
  return normalizeName(name).includes("paper 3");
}

function aps_ukzn(subjects) {
  const pool = subjects.filter((s) =>
    !isLifeOrientation(s.subject) &&
    !isMathsPaper3(s.subject) &&
    s.mark !== null && s.mark !== undefined && s.mark !== "" &&
    Number.isFinite(Number(s.mark))
  );

  const locked = [];
  const lockedSet = new Set();
  const lock = (s) => {
    if (s && !lockedSet.has(s)) {
      lockedSet.add(s);
      locked.push(s);
    }
  };

  // English (Home or First Additional Language) — best-scoring if more than one
  lock(bestN(pool.filter((s) => isEnglish(s.subject)), 1, (s) => Number(s.mark))[0]);
  // Mathematics or Mathematical Literacy — best-scoring if more than one
  lock(bestN(pool.filter((s) => isUkznMathsTrack(s.subject)), 1, (s) => Number(s.mark))[0]);

  const remaining = pool.filter((s) => !lockedSet.has(s));
  const slotsLeft = Math.max(0, 6 - locked.length);
  const filler = bestN(remaining, slotsLeft, (s) => convertMarkToAPS(s.mark));
  const chosen = [...locked, ...filler].slice(0, 6);

  return chosen.reduce((sum, s) => sum + convertMarkToAPS(s.mark), 0);
}

// ─── University → model map ────────────────────────────────────────────────────

const UNIVERSITY_MODELS = {
  // Verified
  "University of Johannesburg":       "APS_NSC_42",
  "University of the Witwatersrand":  "APS_WITS",
  "University of Cape Town":          "UCT_FPS_600",
  "Stellenbosch University":          "STELLIES_NSC_AVG",
  "North-West University":            "APS_NSC_42",
  "University of KwaZulu-Natal":      "APS_UKZN",

  // Standard NSC best-6 (provisional / verified)
  "University of Pretoria":                          "APS_NSC_42",
  "University of the Free State":                    "APS_NSC_42",
  "University of Limpopo":                           "APS_NSC_42",
  "University of Zululand":                          "APS_UNIZULU",
  "University of Venda":                             "APS_UNIVEN",
  "University of Fort Hare":                         "APS_NSC_42",
  "University of Mpumalanga":                        "APS_NSC_42",
  "University of South Africa":                      "APS_NSC_42",
  "University of the Western Cape":                  "APS_UWC",
  "Nelson Mandela University":                       "APS_NMU",
  "Rhodes University":                               "APS_RHODES",
  "Walter Sisulu University":                        "APS_NSC_42",
  "Tshwane University of Technology":                "APS_NSC_42",
  "Durban University of Technology":                 "APS_NSC_42",
  "Central University of Technology":                "APS_NSC_42",
  "Cape Peninsula University of Technology":         "APS_NSC_42",
  "Mangosuthu University of Technology":             "APS_MUT",
  "Vaal University of Technology":                   "APS_NSC_42",
  "Sefako Makgatho Health Sciences University":      "APS_NSC_49",
  "Sol Plaatje University":                          "APS_SPU",
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
    case "APS_UNIZULU":     score = aps_unizulu(subjects);    break;
    case "APS_RHODES":      score = aps_rhodes(subjects);     break;
    case "APS_SPU":         score = aps_spu(subjects);        break;
    case "APS_MUT":         score = aps_mut(subjects);        break;
    case "APS_NMU":         score = aps_nmu_generic(subjects); break;
    case "APS_UKZN":        score = aps_ukzn(subjects);        break;
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
    APS_UNIZULU:      "UNIZULU Points (all subjects summed, LO excluded, 90%+ bonus point)",
    APS_RHODES:       "Rhodes APS (% ÷ 10 per subject, best 6, LO excluded)",
    APS_SPU:          "SPU Points (own 1–8 scale, Maths/Home Language bonus, LO included on reduced scale)",
    APS_MUT:          "MUT Points (best 6 subjects, LO excluded, 90%+ earns 8 points)",
    APS_NMU:          "NMU Applicant Score (% sum, best 6 subjects, LO excluded, out of 600)",
    APS_UKZN:         "UKZN Composite APS (English + Maths/Maths Lit locked, best 4 of rest, LO excluded, out of 42)",
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