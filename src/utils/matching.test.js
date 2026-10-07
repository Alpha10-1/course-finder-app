import { describe, expect, it } from "vitest";
import {
  compareQualification,
  courseQualifies,
  findCoursesWithinReach,
  getCourseGaps,
  raiseMarks,
} from "./matching";

// Generic best-6 APS: 6 + 6 + 5 + 5 + 6 + 7 = 35
const MATRIC = [
  { subject: "English Home Language", mark: 75 },
  { subject: "Mathematics", mark: 70 },
  { subject: "Physical Sciences", mark: 65 },
  { subject: "Life Sciences", mark: 68 },
  { subject: "Geography", mark: 72 },
  { subject: "isiZulu First Additional Language", mark: 80 },
  { subject: "Life Orientation", mark: 95 },
];
const GRADE_12 = { grade: "Grade 12", gradeStatus: "completed" };

const uni = (id, extra) => ({ id, courseName: id, institution: "University of Johannesburg", institutionType: "university", keySubjects: [], ...extra });
const college = (id, extra) => ({ id, courseName: id, institution: "Some TVET College", institutionType: "college", keySubjects: [], ...extra });

describe("courseQualifies", () => {
  it("checks APS and subject minimums for universities", () => {
    expect(courseQualifies(uni("a", { minAPS: 35 }), MATRIC, GRADE_12)).toBe(true);
    expect(courseQualifies(uni("b", { minAPS: 36 }), MATRIC, GRADE_12)).toBe(false);
    expect(courseQualifies(uni("c", { minAPS: 30, keySubjects: [{ subject: "Mathematics", minMark: 75 }] }), MATRIC, GRADE_12)).toBe(false);
  });

  it("checks completed grade for colleges, not APS", () => {
    expect(courseQualifies(college("d", { minGrade: "Grade 12", minAPS: 99 }), MATRIC, GRADE_12)).toBe(true);
    expect(courseQualifies(college("e", { minGrade: "Grade 12" }), MATRIC, { grade: "Grade 12", gradeStatus: "current" })).toBe(false);
  });
});

describe("raiseMarks", () => {
  it("raises entered marks, caps at 100 and leaves blanks alone", () => {
    expect(raiseMarks([{ subject: "A", mark: 95 }, { subject: "B", mark: "60" }, { subject: "C", mark: "" }], 10))
      .toEqual([{ subject: "A", mark: 100 }, { subject: "B", mark: 70 }, { subject: "C", mark: "" }]);
  });
});

describe("getCourseGaps", () => {
  it("lists the APS shortfall and unmet subjects", () => {
    const course = uni("f", { minAPS: 37, keySubjects: [{ subject: "Mathematics", minMark: 75 }, { subject: "English", minMark: 60 }] });
    expect(getCourseGaps(course, MATRIC)).toEqual([
      { type: "aps", have: 35, need: 37 },
      { type: "subject", label: "Mathematics ≥75%", have: 70 },
    ]);
  });

  it("is empty when the learner qualifies", () => {
    expect(getCourseGaps(uni("g", { minAPS: 30 }), MATRIC)).toEqual([]);
  });
});

describe("findCoursesWithinReach", () => {
  const courses = [
    uni("qualifies", { minAPS: 30 }),
    uni("needs +5", { minAPS: 37, keySubjects: [{ subject: "Mathematics", minMark: 75 }] }),
    uni("needs +1", { minAPS: 30, keySubjects: [{ subject: "Mathematics", minMark: 71 }] }),
    uni("too far", { minAPS: 42 }),
    uni("missing subject", { minAPS: 30, keySubjects: [{ subject: "Accounting", minMark: 50 }] }),
    college("grade-gated", { minGrade: "Grade 12", keySubjects: [{ subject: "Mathematics", minMark: 75 }] }),
  ];

  it("finds courses a modest improvement would unlock, closest first", () => {
    const found = findCoursesWithinReach(courses, MATRIC, GRADE_12);
    expect(found.map((r) => [r.course.id, r.raiseNeeded])).toEqual([
      ["needs +1", 1],
      ["grade-gated", 5],
      ["needs +5", 5],
    ]);
  });

  it("never suggests courses that better marks can't unlock", () => {
    const found = findCoursesWithinReach(courses, MATRIC, { grade: "Grade 12", gradeStatus: "current" });
    expect(found.map((r) => r.course.id)).not.toContain("grade-gated");
    expect(found.map((r) => r.course.id)).not.toContain("missing subject");
  });
});

describe("compareQualification", () => {
  it("reports courses gained and lost", () => {
    const courses = [uni("a", { minAPS: 35 }), uni("b", { minAPS: 37 })];
    const better = raiseMarks(MATRIC, 5); // APS 38
    expect(compareQualification(courses, MATRIC, better, GRADE_12)).toMatchObject({ count: 2, gained: [courses[1]], lost: [] });
    expect(compareQualification(courses, better, MATRIC, GRADE_12)).toMatchObject({ count: 1, gained: [], lost: [courses[1]] });
  });
});
