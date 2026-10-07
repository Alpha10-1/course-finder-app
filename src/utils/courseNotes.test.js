import { describe, expect, it } from "vitest";
import { describeDeadline, describeKeySubject, getAdmissionNotes } from "./courseNotes";

const NOW = new Date(2026, 9, 7);

describe("getAdmissionNotes", () => {
  it("returns nothing for a course without extra admission info", () => {
    expect(getAdmissionNotes({ courseName: "BSc" }, NOW)).toEqual([]);
  });

  it("lists every kind of note in display order", () => {
    const notes = getAdmissionNotes({
      admissionRequirement: "Accounting not required with Maths 5.",
      additionalRequirements: "APS 35-37 may be wait-listed.",
      selectionProcess: true,
      applicationDeadline: "31 July",
    }, NOW);
    expect(notes.map((n) => n.kind)).toEqual(["requirement", "additional", "selection", "deadline"]);
    expect(notes[3].text).toBe("Applications close 31 July.");
  });
});

describe("describeDeadline", () => {
  it("flags deadlines from an earlier year", () => {
    expect(describeDeadline("31 July 2025", NOW)).toMatch(/Last published deadline: 31 July 2025 \(an earlier year\)/);
  });

  it("shows current-year and undated deadlines as-is", () => {
    expect(describeDeadline("30 September 2026", NOW)).toBe("Applications close 30 September 2026.");
    expect(describeDeadline("15 June", NOW)).toBe("Applications close 15 June.");
  });
});

describe("describeKeySubject", () => {
  it("describes single and any-of requirements", () => {
    expect(describeKeySubject({ subject: "Mathematics", minMark: 50 })).toBe("Mathematics 50%+");
    expect(describeKeySubject({
      subjectGroup: [{ subject: "Mathematics", minMark: 50 }, { subject: "Mathematical Literacy", minMark: 60 }],
    })).toBe("Mathematics 50%+ or Mathematical Literacy 60%+");
  });
});
