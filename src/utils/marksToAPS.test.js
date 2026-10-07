import { describe, expect, it } from "vitest";
import {
  calculateAPSForCourse,
  calculateAPSForUniversity,
  calculateGeneralAPS,
  convertMarkToAPS,
  getCompletionLabel,
  getEffectiveMinAPS,
  getHighestCompletedLevel,
  levelToMinMark,
  markToLevel,
  meetsCollegeRequirement,
} from "./marksToAPS";

// A typical 7-subject NSC certificate (6 subjects + Life Orientation).
// Levels: 6, 6, 5, 5, 6, 7 (+ LO 7) → generic best-6 APS = 35.
const MATRIC = [
  { subject: "English Home Language", mark: 75 },
  { subject: "Mathematics", mark: 70 },
  { subject: "Physical Sciences", mark: 65 },
  { subject: "Life Sciences", mark: 68 },
  { subject: "Geography", mark: 72 },
  { subject: "isiZulu First Additional Language", mark: 80 },
  { subject: "Life Orientation", mark: 95 },
];

const apsAt = (institution, subjects = MATRIC) => calculateAPSForUniversity(institution, subjects).score;

describe("convertMarkToAPS / markToLevel", () => {
  it.each([
    [100, 7], [80, 7], [79.9, 6], [70, 6], [69, 5], [60, 5], [50, 4], [40, 3], [30, 2], [29, 1], [0, 1],
  ])("%s%% → level %s", (mark, level) => {
    expect(convertMarkToAPS(mark)).toBe(level);
    expect(markToLevel(mark)).toBe(level);
  });

  it("clamps out-of-range and non-numeric marks", () => {
    expect(convertMarkToAPS(150)).toBe(7);
    expect(convertMarkToAPS(-5)).toBe(1);
    expect(convertMarkToAPS("abc")).toBe(1);
    expect(convertMarkToAPS("75")).toBe(6);
  });
});

describe("levelToMinMark", () => {
  it("maps NSC levels to the bottom of their percentage band", () => {
    expect(levelToMinMark(7)).toBe(80);
    expect(levelToMinMark(4)).toBe(50);
    expect(levelToMinMark("5")).toBe(60);
    expect(levelToMinMark(1)).toBe(0);
  });

  it("returns 0 for unknown levels", () => {
    expect(levelToMinMark(9)).toBe(0);
  });
});

describe("calculateGeneralAPS (best 6, LO excluded)", () => {
  it("sums the best six non-LO levels", () => {
    expect(calculateGeneralAPS(MATRIC)).toBe(35);
  });

  it("drops the weakest subject when more than six are offered", () => {
    expect(calculateGeneralAPS([...MATRIC, { subject: "History", mark: 45 }])).toBe(35);
  });

  it("ignores subjects with no mark entered", () => {
    expect(calculateGeneralAPS([...MATRIC, { subject: "Accounting", mark: "" }])).toBe(35);
  });
});

describe("calculateAPSForUniversity", () => {
  it("defaults unknown institutions to the generic best-6 model", () => {
    const result = calculateAPSForUniversity("Some New University", MATRIC);
    expect(result).toMatchObject({ score: 35, model: "APS_NSC_42" });
  });

  it("University of Johannesburg uses best 6, LO excluded", () => {
    expect(apsAt("University of Johannesburg")).toBe(35);
  });

  it("Wits: own bands, +2 for Maths and English, LO on its own 0–4 scale", () => {
    // LO 95 → 4; English 75 → 6+2; Maths 70 → 6+2; isiZulu 80 → 7; Geo 72 → 6; LS 68 → 5; PS 65 → 5
    expect(apsAt("University of the Witwatersrand")).toBe(43);
  });

  it("UCT: sum of the best six percentages (out of 600)", () => {
    expect(apsAt("University of Cape Town")).toBe(430);
  });

  it("Stellenbosch: best LoLT plus best five others, averaged over six", () => {
    // English 75 + (80 + 72 + 70 + 68 + 65) = 430 / 6
    expect(apsAt("Stellenbosch University")).toBe(71.7);
  });

  it("UNIVEN: percentage ÷ 10 for subjects at 40%+, LO excluded", () => {
    expect(apsAt("University of Venda")).toBe(43);
    expect(apsAt("University of Venda", [...MATRIC, { subject: "History", mark: 35 }])).toBe(43);
  });

  it("UWC: weighted English/Maths/LO/other columns, all subjects summed", () => {
    // English 75 → 11, Maths 70 → 11, PS 65 → 5, LS 68 → 5, Geo 72 → 6, isiZulu 80 → 7, LO 95 → 3
    expect(apsAt("University of the Western Cape")).toBe(48);
  });

  it("UWC scores Mathematical Literacy on the 'other' column, not the Maths column", () => {
    const withMathsLit = MATRIC.map((s) => (s.subject === "Mathematics" ? { subject: "Mathematical Literacy", mark: 70 } : s));
    expect(apsAt("University of the Western Cape", withMathsLit)).toBe(48 - 11 + 6);
  });

  it("UNIZULU reproduces the brochure's worked example (32 points)", () => {
    const example = [
      { subject: "English First Additional Language", mark: 75 },
      { subject: "isiZulu Home Language", mark: 90 },
      { subject: "Mathematics", mark: 80 },
      { subject: "Life Sciences", mark: 62 },
      { subject: "Physical Sciences", mark: 72 },
      { subject: "Life Orientation", mark: 68 },
    ];
    expect(apsAt("University of Zululand", example)).toBe(32);
  });

  it("Rhodes reproduces the prospectus's worked example (43.3)", () => {
    const example = [
      { subject: "English Home Language", mark: 78 },
      { subject: "isiXhosa First Additional Language", mark: 74 },
      { subject: "Mathematics", mark: 65 },
      { subject: "Life Sciences", mark: 75 },
      { subject: "Accounting", mark: 72 },
      { subject: "History", mark: 69 },
      { subject: "Life Orientation", mark: 60 },
    ];
    expect(apsAt("Rhodes University", example)).toBe(43.3);
  });

  it("Sol Plaatje: 1–8 scale, banded bonus for Maths and Home Language, LO on its own scale", () => {
    // English HL 75 → 6+2, Maths 70 → 6+2, isiZulu FAL 80 → 7, PS 5, LS 5, Geo 6, LO 95 → 4
    expect(apsAt("Sol Plaatje University")).toBe(43);
    // Maths at 45% earns the smaller +1 bonus: 3 + 1
    expect(apsAt("Sol Plaatje University", [{ subject: "Mathematics", mark: 45 }])).toBe(4);
  });

  it("MUT: best 6, with 90%+ earning 8 points", () => {
    const strongMaths = MATRIC.map((s) => (s.subject === "Mathematics" ? { ...s, mark: 92 } : s));
    expect(apsAt("Mangosuthu University of Technology", strongMaths)).toBe(37);
  });

  it("Sefako Makgatho: best 7 levels with LO included", () => {
    expect(apsAt("Sefako Makgatho Health Sciences University")).toBe(42);
  });

  it("NMU (no course context) reproduces Applicant 1 from the guide (370)", () => {
    const applicant1 = [
      { subject: "isiXhosa Home Language", mark: 78 },
      { subject: "English First Additional Language", mark: 60 },
      { subject: "Mathematics", mark: 65 },
      { subject: "Life Sciences", mark: 62 },
      { subject: "Physical Sciences", mark: 50 },
      { subject: "Geography", mark: 55 },
      { subject: "Life Orientation", mark: 88 },
    ];
    expect(apsAt("Nelson Mandela University", applicant1)).toBe(370);
  });

  it("UKZN reproduces the prospectus's worked example (35)", () => {
    const example = [
      { subject: "isiZulu Home Language", mark: 65 },
      { subject: "English First Additional Language", mark: 75 },
      { subject: "Life Orientation", mark: 55 },
      { subject: "Mathematics", mark: 65 },
      { subject: "Accounting", mark: 75 },
      { subject: "Business Studies", mark: 75 },
      { subject: "CAT (Computer Applications Technology)", mark: 85 },
    ];
    expect(apsAt("University of KwaZulu-Natal", example)).toBe(35);
  });

  it("UKZN locks in English and Maths/Maths Lit even when they aren't the learner's best", () => {
    const subjects = [
      { subject: "English First Additional Language", mark: 45 }, // 3, locked
      { subject: "Mathematical Literacy", mark: 55 },             // 4, locked
      { subject: "isiZulu Home Language", mark: 85 },
      { subject: "History", mark: 85 },
      { subject: "Geography", mark: 85 },
      { subject: "Tourism", mark: 85 },
      { subject: "Life Sciences", mark: 85 },
      { subject: "Life Orientation", mark: 90 },
    ];
    // 3 + 4 + best four 7s — a naive best-6 would give 39
    expect(apsAt("University of KwaZulu-Natal", subjects)).toBe(35);
  });
});

describe("calculateAPSForCourse", () => {
  const ACCOUNTING_MATRIC = MATRIC.map((s) => (s.subject === "Geography" ? { subject: "Accounting", mark: 72 } : s));
  const cput = (apsMethod) => ({ institution: "Cape Peninsula University of Technology", apsMethod });

  it("CPUT method 1: best six percentages ÷ 10", () => {
    expect(calculateAPSForCourse(cput("method1"), MATRIC)).toMatchObject({ score: 43, model: "CPUT_METHOD1" });
  });

  it("CPUT method 2: Maths and Physical Science doubled, plus English and the next best", () => {
    // 75 + 70×2 + 65×2 + 80 = 425
    expect(calculateAPSForCourse(cput("method2"), MATRIC).score).toBe(42.5);
  });

  it("CPUT method 3: Maths and Accounting doubled, plus English and the next three", () => {
    // 75 + 70×2 + 72×2 + (80 + 68 + 65) = 572
    expect(calculateAPSForCourse(cput("method3"), ACCOUNTING_MATRIC).score).toBe(57.2);
  });

  it("CPUT courses without an apsMethod fall back to the institution model", () => {
    expect(calculateAPSForCourse(cput(undefined), MATRIC)).toMatchObject({ score: 35, model: "APS_NSC_42" });
  });

  it("NMU locks in course-required subjects (Applicant 2 from the guide, 375)", () => {
    const applicant2 = [
      { subject: "isiXhosa Home Language", mark: 78 },
      { subject: "English First Additional Language", mark: 60 },
      { subject: "Mathematics", mark: 65 },
      { subject: "Life Sciences", mark: 62 },
      { subject: "Physical Sciences", mark: 50 },
      { subject: "History", mark: 60 },
      { subject: "Geography", mark: 55 },
      { subject: "Life Orientation", mark: 88 },
    ];
    const course = {
      institution: "Nelson Mandela University",
      keySubjects: [{ subject: "Life Sciences", minMark: 50 }, { subject: "Physical Sciences", minMark: 50 }],
    };
    expect(calculateAPSForCourse(course, applicant2)).toMatchObject({ score: 375, model: "APS_NMU" });
    // Without course context the generic best-6 keeps Geography over Physical Sciences
    expect(apsAt("Nelson Mandela University", applicant2)).toBe(380);
  });

  it("delegates to the institution model for everything else", () => {
    expect(calculateAPSForCourse({ institution: "University of Cape Town" }, MATRIC).score).toBe(430);
  });
});

describe("getEffectiveMinAPS", () => {
  const course = { minAPS: 30, apsAlternatives: [{ subject: "Mathematical Literacy", minAPS: 34 }] };

  it("uses the base minimum for learners with Mathematics", () => {
    expect(getEffectiveMinAPS(course, [{ subject: "Mathematics", mark: 60 }])).toBe(30);
  });

  it("uses the alternative minimum when the learner took that subject", () => {
    expect(getEffectiveMinAPS(course, [{ subject: "Mathematical Literacy", mark: 60 }])).toBe(34);
  });

  it("ignores an alternative subject with no mark entered", () => {
    expect(getEffectiveMinAPS(course, [{ subject: "Mathematical Literacy", mark: "" }])).toBe(30);
  });

  it("handles courses without a minimum or alternatives", () => {
    expect(getEffectiveMinAPS({ minAPS: 26 }, [])).toBe(26);
    expect(getEffectiveMinAPS({}, [])).toBe(0);
  });
});

describe("college eligibility", () => {
  it("treats 'current' as having completed the grade below", () => {
    expect(getHighestCompletedLevel("Grade 12", "current")).toEqual({
      highestGradeCompleted: "Grade 11", highestGradeNum: 11, highestNQFCompleted: 3,
    });
    expect(getHighestCompletedLevel("Grade 12", "completed").highestNQFCompleted).toBe(4);
  });

  it("returns nothing completed for unknown grades", () => {
    expect(getHighestCompletedLevel(undefined, "completed")).toEqual({
      highestGradeCompleted: null, highestGradeNum: 0, highestNQFCompleted: 0,
    });
  });

  it("courses without a grade or NQF requirement are open to everyone", () => {
    expect(meetsCollegeRequirement(undefined, undefined, {})).toBe(true);
  });

  it("gates on minimum grade completed", () => {
    const course = { minGrade: "Grade 11" };
    expect(meetsCollegeRequirement("Grade 11", "completed", course)).toBe(true);
    expect(meetsCollegeRequirement("Grade 11", "current", course)).toBe(false);
    expect(meetsCollegeRequirement("Grade 12", "current", course)).toBe(true);
  });

  it("gates on NQF level, and on both when both are set", () => {
    expect(meetsCollegeRequirement("Grade 11", "completed", { minNQFLevel: 3 })).toBe(true);
    expect(meetsCollegeRequirement("Grade 11", "completed", { minNQFLevel: 4 })).toBe(false);
    expect(meetsCollegeRequirement("Grade 11", "completed", { minGrade: "Grade 10", minNQFLevel: 4 })).toBe(false);
  });

  it("labels what the learner has completed", () => {
    expect(getCompletionLabel("Grade 12", "completed")).toBe("Grade 12 completed (NQF Level 4)");
    expect(getCompletionLabel(null, null)).toBe("No completed grade on record");
  });
});
