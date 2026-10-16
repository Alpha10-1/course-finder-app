import { describe, expect, it } from "vitest";
import { COURSES } from "./publicCourses";
import {
  APS_BLOCKER, DEFAULT_CHOICES, ELECTIVES, PRESETS, advisorParams, applyChange, buildSubjects, evaluateChange,
  evaluateCourses, exampleCourses, normalizeChoices, parseAdvisorParams, rankChanges, requestedElectives,
  summarizeByField, swapCandidates, topBlockers,
} from "./subjectAdvisor";

const uni = (courseName, keySubjects, extra = {}) => ({
  courseName, institution: "Test University", institutionType: "university", faculty: "Faculty of Science",
  qualificationType: "Bachelor", minAPS: 20, keySubjects, ...extra,
});

const ENGINEERING = uni("BSc Engineering", [{ subject: "Mathematics", minMark: 60 }, { subject: "Physical Sciences", minMark: 60 }]);
const NURSING = uni("Bachelor of Nursing", [{ subject: "Life Sciences", minMark: 50 }], { faculty: "Faculty of Health Sciences" });
const BCOM = uni("Bachelor of Commerce", [{ subject: "Mathematics", minMark: 50 }], { faculty: "Faculty of Commerce" });
const BA = uni("Bachelor of Arts", [], { faculty: "Faculty of Humanities" });
const ACCOUNTING = uni("Diploma in Accounting", [{ subject: "Accounting", minMark: 50 }], { faculty: "Faculty of Commerce" });
const CATALOGUE = [ENGINEERING, NURSING, BCOM, BA, ACCOUNTING];

const choices = (maths, electives) => normalizeChoices({ ...DEFAULT_CHOICES, maths, electives });

describe("normalizeChoices", () => {
  it("keeps a valid combination as it is", () => {
    expect(normalizeChoices(DEFAULT_CHOICES)).toEqual(DEFAULT_CHOICES);
  });

  it("repairs unknown, repeated and missing subjects", () => {
    const fixed = normalizeChoices({ maths: "Algebra", electives: ["History", "History", "Underwater Basket Weaving"] });
    expect(fixed.maths).toBe("Mathematics");
    expect(fixed.electives).toHaveLength(3);
    expect(new Set(fixed.electives).size).toBe(3);
    expect(fixed.electives[0]).toBe("History");
    expect(fixed.electives.every((e) => ELECTIVES.includes(e))).toBe(true);
  });

  it("never offers the same language twice", () => {
    expect(normalizeChoices({ homeLanguage: "English Home Language", additionalLanguage: "English First Additional Language" }).additionalLanguage)
      .toBe("isiZulu First Additional Language");
    expect(normalizeChoices({ homeLanguage: "Sepedi Home Language", additionalLanguage: "Sepedi First Additional Language" }).additionalLanguage)
      .toBe("English First Additional Language");
  });

  it("allows a second Home Language", () => {
    expect(normalizeChoices({ homeLanguage: "isiXhosa Home Language", additionalLanguage: "English Home Language" }).additionalLanguage)
      .toBe("English Home Language");
  });

  it("builds a valid combination for every preset", () => {
    for (const p of PRESETS) expect(choices(p.maths, p.electives).electives).toEqual(p.electives);
  });
});

describe("query string", () => {
  it("round-trips choices and mark", () => {
    const c = choices("Mathematical Literacy", ["History", "Tourism", "Geography"]);
    const parsed = parseAdvisorParams(advisorParams(c, 70));
    expect(parsed).toEqual({ choices: c, mark: 70 });
  });

  it("falls back to defaults for an empty or invalid query", () => {
    expect(parseAdvisorParams(new URLSearchParams(""))).toEqual({ choices: DEFAULT_CHOICES, mark: 100 });
    expect(parseAdvisorParams(new URLSearchParams("mark=42")).mark).toBe(100);
  });

  it("leaves the default mark out of shared links", () => {
    expect(advisorParams(DEFAULT_CHOICES, 100).has("mark")).toBe(false);
  });
});

describe("evaluateCourses", () => {
  it("rules out courses needing subjects the learner doesn't take", () => {
    const { open, closed } = evaluateCourses(CATALOGUE, buildSubjects(choices("Mathematical Literacy", ["History", "Geography", "Tourism"])));
    expect(open.map((c) => c.courseName)).toEqual(["Bachelor of Arts"]);
    const engineering = closed.find((e) => e.course === ENGINEERING);
    expect(engineering.gaps.map((g) => g.label)).toEqual(["Mathematics ≥60%", "Physical Sciences ≥60%"]);
  });

  it("ignores marks at the default, and checks them when a mark is assumed", () => {
    const science = choices("Mathematics", ["Physical Sciences", "Life Sciences", "Geography"]);
    expect(evaluateCourses([ENGINEERING], buildSubjects(science)).open).toHaveLength(1);
    expect(evaluateCourses([ENGINEERING], buildSubjects(science, 50)).open).toHaveLength(0);
  });
});

describe("summaries", () => {
  const result = evaluateCourses(CATALOGUE, buildSubjects(choices("Mathematical Literacy", ["History", "Geography", "Tourism"])));

  it("counts open and total courses per field", () => {
    const byKey = Object.fromEntries(summarizeByField(result).map((f) => [f.key, f]));
    expect(byKey.health).toMatchObject({ open: 0, total: 1 });
    expect(byKey.humanities).toMatchObject({ open: 1, total: 1 });
    expect(byKey.commerce.closed.map((e) => e.course.courseName).sort()).toEqual(["Bachelor of Commerce", "Diploma in Accounting"]);
  });

  it("ranks the most common missing subjects", () => {
    expect(topBlockers(result.closed)).toEqual([
      { label: "Mathematics", count: 2 },
      { label: "Accounting", count: 1 },
      { label: "Life Sciences", count: 1 },
      { label: "Physical Sciences", count: 1 },
    ]);
  });

  it("merges spellings of the same subject and labels APS gaps", () => {
    const closed = [
      { gaps: [{ type: "subject", label: "Physical Science ≥50%" }] },
      { gaps: [{ type: "subject", label: "Physical Sciences ≥60%" }, { type: "aps", have: 20, need: 30 }] },
      { gaps: [{ type: "subject", label: "Physical Science ≥50% or Technical Sciences ≥50%" }] },
    ];
    expect(topBlockers(closed)).toEqual([
      { label: "Physical Sciences", count: 2 },
      { label: APS_BLOCKER, count: 1 },
      { label: "Physical Sciences or Technical Science", count: 1 },
    ]);
  });
});

describe("suggested changes", () => {
  const current = choices("Mathematical Literacy", ["History", "Geography", "Tourism"]);
  const openNow = new Set(evaluateCourses(CATALOGUE, buildSubjects(current)).open);

  it("only suggests electives some course asks for", () => {
    expect(requestedElectives(CATALOGUE).sort()).toEqual(["Accounting", "Life Sciences", "Physical Sciences"]);
    const candidates = swapCandidates(CATALOGUE, current);
    expect(candidates.filter((c) => c.type === "maths").map((c) => c.to)).toEqual(["Mathematics", "Technical Mathematics"]);
    expect(candidates.filter((c) => c.type === "elective")).toHaveLength(9); // 3 requested × 3 current electives
  });

  it("measures what a change gains and loses", () => {
    const change = evaluateChange(CATALOGUE, current, 100, { type: "maths", from: "Mathematical Literacy", to: "Mathematics" }, openNow);
    expect(change.gained.map((c) => c.courseName)).toEqual(["Bachelor of Commerce"]);
    expect(change.net).toBe(1);
    expect(applyChange(current, change).maths).toBe("Mathematics");
  });

  it("ranks positive changes, one per subject taken up", () => {
    const results = swapCandidates(CATALOGUE, current).map((c) => evaluateChange(CATALOGUE, current, 100, c, openNow));
    const ranked = rankChanges(results);
    expect(ranked.every((r) => r.net > 0)).toBe(true);
    expect(new Set(ranked.map((r) => `${r.type}:${r.to}`)).size).toBe(ranked.length);
    expect(ranked.map((r) => r.to)).toEqual(expect.arrayContaining(["Mathematics", "Accounting", "Life Sciences"]));
  });

  it("picks short, distinct example names", () => {
    expect(exampleCourses([ENGINEERING, BA, { ...BA }, NURSING], 2)).toEqual(["BSc Engineering", "Bachelor of Arts"]);
  });
});

describe("with the real catalogue", () => {
  const universities = COURSES.filter((c) => c.institutionType === "university");
  const count = (maths, electives) => evaluateCourses(universities, buildSubjects(choices(maths, electives))).open.length;

  it("shows Maths Literacy closing far more courses than Mathematics", () => {
    const withMaths = count("Mathematics", ["History", "Geography", "Life Sciences"]);
    const withMathsLit = count("Mathematical Literacy", ["History", "Geography", "Life Sciences"]);
    expect(withMathsLit).toBeLessThan(withMaths * 0.75);
  });

  it("keeps most courses open for the science combination", () => {
    expect(count("Mathematics", ["Physical Sciences", "Life Sciences", "Geography"])).toBeGreaterThan(universities.length * 0.9);
  });
});
