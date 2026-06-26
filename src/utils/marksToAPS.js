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
 * APS_NSC_42 — best 6 NSC levels, Life Orientation excluded.
 * Used by: UJ, UFS, NWU, UKZN, UL, UZ, WSU, TUT, UNISA, DUT, CUT, CPUT,
 *          NMU, RU, SMU, SPU, UFH, MUT, UMP, UWC, UNIVEN, VUT, UP, UKZN
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
  "University of Venda":                             "APS_NSC_42",
  "University of Fort Hare":                         "APS_NSC_42",
  "University of Mpumalanga":                        "APS_NSC_42",
  "University of South Africa":                      "APS_NSC_42",
  "University of the Western Cape":                  "APS_NSC_42",
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
    default:                score = aps_nsc_42(subjects);
  }

  const labels = {
    APS_NSC_42:       "APS (best 6 levels, LO excluded)",
    APS_NSC_49:       "APS (best 7 levels, LO included)",
    APS_WITS:         "Wits APS (weighted + Maths/English bonus)",
    UCT_FPS_600:      "UCT Faculty Points Score (out of 600)",
    STELLIES_NSC_AVG: "Stellenbosch NSC average (%)",
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