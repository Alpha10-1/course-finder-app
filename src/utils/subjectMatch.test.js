import { describe, expect, it } from "vitest";
import universityCourses from "../data/courses.json";
import {
  getKeySubjectStatus,
  isAnotherLanguagePlaceholder,
  isGenericCreditSubject,
  meetsKeySubjects,
  subjectMatches,
} from "./subjectMatch";

describe("subjectMatches", () => {
  it("matches exact names case-insensitively", () => {
    expect(subjectMatches("Mathematics", "mathematics")).toBe(true);
  });

  it("matches a short requirement against the full NSC name", () => {
    expect(subjectMatches("English Home Language", "English")).toBe(true);
    expect(subjectMatches("English First Additional Language", "English")).toBe(true);
    expect(subjectMatches("Afrikaans Home Language", "English")).toBe(false);
  });

  it("keeps Mathematics and Mathematical Literacy apart", () => {
    expect(subjectMatches("Mathematical Literacy", "Mathematics")).toBe(false);
    expect(subjectMatches("Mathematics", "Mathematical Literacy")).toBe(false);
  });

  it("doesn't accept Technical Mathematics for a Mathematics requirement", () => {
    expect(subjectMatches("Technical Mathematics", "Mathematics")).toBe(false);
  });

  it("does accept Mathematics for a Technical Mathematics requirement", () => {
    expect(subjectMatches("Mathematics", "Technical Mathematics")).toBe(true);
  });

  it("treats known synonym pairs as equivalent", () => {
    expect(subjectMatches("CAT (Computer Applications Technology)", "Computer Literacy")).toBe(true);
    expect(subjectMatches("Computer Literacy", "CAT")).toBe(true);
    expect(subjectMatches("IT (Information Technology)", "Information Technology")).toBe(true);
  });

  it("matches an abbreviation contained in a longer requirement", () => {
    expect(subjectMatches("CAT", "CAT (Computer Applications Technology)")).toBe(true);
  });
});

describe("placeholder requirements", () => {
  it.each(["20 Credit Subject", "20-credit subject 2", "Other Subject", "Other Subjects (2)", "Other Subjects 3"])(
    "%s is a generic credit subject", (name) => expect(isGenericCreditSubject(name)).toBe(true)
  );

  it("named subjects are not generic credit subjects", () => {
    expect(isGenericCreditSubject("Mathematics")).toBe(false);
  });

  it.each(["Another Language", "Another Official Language", "Second Language", "Additional Language"])(
    "%s is an 'another language' placeholder", (name) => expect(isAnotherLanguagePlaceholder(name)).toBe(true)
  );

  it("named languages are not placeholders", () => {
    expect(isAnotherLanguagePlaceholder("English")).toBe(false);
  });
});

describe("meetsKeySubjects", () => {
  const learner = [
    { subject: "English Home Language", mark: 72 },
    { subject: "isiZulu First Additional Language", mark: 55 },
    { subject: "Mathematical Literacy", mark: "68" },
    { subject: "History", mark: 48 },
    { subject: "Life Orientation", mark: 90 },
    { subject: "Geography", mark: "" },
  ];

  it("passes when there are no requirements", () => {
    expect(meetsKeySubjects(learner, [])).toBe(true);
    expect(meetsKeySubjects(learner, undefined)).toBe(true);
  });

  it("checks single subject requirements against the minimum mark", () => {
    expect(meetsKeySubjects(learner, [{ subject: "English", minMark: 70 }])).toBe(true);
    expect(meetsKeySubjects(learner, [{ subject: "English", minMark: 75 }])).toBe(false);
  });

  it("requires every listed requirement", () => {
    expect(meetsKeySubjects(learner, [
      { subject: "English", minMark: 50 },
      { subject: "Mathematics", minMark: 50 },
    ])).toBe(false);
  });

  it("accepts any option in a subject group", () => {
    const mathsOrLit = { subjectGroup: [{ subject: "Mathematics", minMark: 50 }, { subject: "Mathematical Literacy", minMark: 65 }] };
    expect(meetsKeySubjects(learner, [mathsOrLit])).toBe(true);
    const tooHigh = { subjectGroup: [{ subject: "Mathematics", minMark: 50 }, { subject: "Mathematical Literacy", minMark: 70 }] };
    expect(meetsKeySubjects(learner, [tooHigh])).toBe(false);
  });

  it("generic credit subjects accept anything except Life Orientation", () => {
    expect(meetsKeySubjects(learner, [{ subject: "20 Credit Subject", minMark: 70 }])).toBe(true);
    expect(meetsKeySubjects(learner, [{ subject: "20 Credit Subject", minMark: 80 }])).toBe(false); // only LO is 80+
  });

  it("'another language' accepts a non-English language subject", () => {
    expect(meetsKeySubjects(learner, [{ subject: "Another Language", minMark: 50 }])).toBe(true);
    expect(meetsKeySubjects(learner, [{ subject: "Another Language", minMark: 60 }])).toBe(false); // English doesn't count
  });

  it("treats a blank mark as not meeting any minimum", () => {
    expect(meetsKeySubjects(learner, [{ subject: "Geography", minMark: 0 }])).toBe(false);
  });
});

describe("getKeySubjectStatus", () => {
  const learner = [
    { subject: "English First Additional Language", mark: 58 },
    { subject: "Mathematics", mark: 45 },
    { subject: "isiXhosa Home Language", mark: 77 },
    { subject: "Life Orientation", mark: 88 },
  ];

  it("labels each requirement and reports the learner's mark", () => {
    expect(getKeySubjectStatus(learner, [
      { subject: "Mathematics", minMark: 50 },
      { subject: "English", minMark: 50 },
      { subject: "Physical Sciences", minMark: 50 },
    ])).toEqual([
      { label: "Mathematics ≥50%", met: false, userMark: 45 },
      { label: "English ≥50%", met: true, userMark: 58 },
      { label: "Physical Sciences ≥50%", met: false, userMark: null },
    ]);
  });

  it("joins subject-group options with 'or'", () => {
    const [status] = getKeySubjectStatus(learner, [
      { subjectGroup: [{ subject: "Mathematics", minMark: 50 }, { subject: "Mathematical Literacy", minMark: 60 }] },
    ]);
    expect(status).toEqual({ label: "Mathematics ≥50% or Mathematical Literacy ≥60%", met: false });
  });

  it("resolves placeholders the same way meetsKeySubjects does", () => {
    expect(getKeySubjectStatus(learner, [{ subject: "Another Language", minMark: 70 }])[0])
      .toMatchObject({ met: true, userMark: 77 });
    expect(getKeySubjectStatus(learner, [{ subject: "20 Credit Subject", minMark: 80 }])[0])
      .toMatchObject({ met: false, userMark: null }); // LO doesn't count
  });

  // The detail view's ✓/✗ list must never contradict whether the course was
  // matched. Check every real requirement against a spread of learners.
  it("agrees with meetsKeySubjects for every requirement in courses.json", () => {
    const learners = [40, 55, 70, 85].map((mark) => [
      "English Home Language", "isiZulu First Additional Language", "Mathematics", "Physical Sciences",
      "Life Sciences", "Accounting", "Geography", "Life Orientation",
    ].map((subject) => ({ subject, mark })));
    const disagreements = [];
    for (const course of universityCourses) {
      for (const req of course.keySubjects || []) {
        for (const subjects of learners) {
          const [status] = getKeySubjectStatus(subjects, [req]);
          if (status.met !== meetsKeySubjects(subjects, [req])) disagreements.push(`${course.courseName}: ${status.label}`);
        }
      }
    }
    expect(disagreements).toEqual([]);
  });
});
