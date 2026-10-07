import { describe, expect, it } from "vitest";
import collegeCourses from "../data/college-courses.json";
import { expandCollegeCourse } from "./collegeCourses";
import { meetsCollegeRequirement } from "./marksToAPS";

const CURRICULUM = {
  fundamentalSubjects: ["English First Additional Language", "Mathematics", "Life Orientation"],
  vocationalSubjects: [{ subject: "Electrical Principles" }, { subject: "Physical Science" }],
};

describe("expandCollegeCourse", () => {
  it("returns a single course doc when no campuses are listed", () => {
    const [doc, ...rest] = expandCollegeCourse({
      courseName: "Office Admin", institution: "Some TVET College", _comment: "authoring note",
    });
    expect(rest).toHaveLength(0);
    expect(doc).toMatchObject({ institutionType: "college", keySubjects: [], faculty: "", curriculum: null });
    expect(doc).not.toHaveProperty("_comment");
  });

  it("clones the course once per campus, keeping the shared institution", () => {
    const docs = expandCollegeCourse({
      courseName: "NC(V) Electrical", institution: "Some TVET College", curriculum: CURRICULUM,
      campuses: [{ campus: "North" }, { campus: "South", excludeVocational: ["physical science"] }],
    });
    expect(docs.map((d) => d.campus)).toEqual(["North", "South"]);
    expect(new Set(docs.map((d) => d.institution))).toEqual(new Set(["Some TVET College"]));
    expect(docs.every((d) => !("campuses" in d))).toBe(true);
  });

  it("drops vocational subjects a campus excludes (case-insensitively)", () => {
    const [north, south] = expandCollegeCourse({
      courseName: "NC(V) Electrical", institution: "Some TVET College", curriculum: CURRICULUM,
      campuses: [{ campus: "North" }, { campus: "South", excludeVocational: [" Physical Science "] }],
    });
    expect(north.curriculum.vocationalSubjects.map((v) => v.subject)).toEqual(["Electrical Principles", "Physical Science"]);
    expect(south.curriculum.vocationalSubjects.map((v) => v.subject)).toEqual(["Electrical Principles"]);
    expect(south.curriculum.fundamentalSubjects).toEqual(CURRICULUM.fundamentalSubjects);
  });
});

describe("college-courses.json", () => {
  const expanded = collegeCourses.flatMap(expandCollegeCourse);

  it("expands to one doc per campus", () => {
    const expected = collegeCourses.reduce((n, c) => n + Math.max(1, c.campuses?.length || 0), 0);
    expect(expanded).toHaveLength(expected);
  });

  it("every entry has an institution and course name", () => {
    const broken = collegeCourses.filter((c) => !c.institution?.trim() || !c.courseName?.trim());
    expect(broken).toEqual([]);
  });

  it("every campus entry names its campus", () => {
    const unnamed = collegeCourses.filter((c) => c.campuses?.some((k) => !k.campus?.trim()));
    expect(unnamed.map((c) => c.courseName)).toEqual([]);
  });

  it("every campus exclusion refers to a vocational subject the course actually has", () => {
    const typos = [];
    for (const c of collegeCourses) {
      const offered = new Set((c.curriculum?.vocationalSubjects || []).map((v) => v.subject.trim().toLowerCase()));
      for (const campus of c.campuses || []) {
        for (const ex of campus.excludeVocational || []) {
          if (!offered.has(ex.trim().toLowerCase())) typos.push(`${c.courseName} @ ${campus.campus}: ${ex}`);
        }
      }
    }
    expect(typos).toEqual([]);
  });

  it("Grade 12 completers qualify for every course with a known grade gate", () => {
    const gated = expanded.filter((c) => ["Grade 9", "Grade 10", "Grade 11", "Grade 12"].includes(c.minGrade));
    expect(gated.length).toBeGreaterThan(0);
    expect(gated.filter((c) => !meetsCollegeRequirement("Grade 12", "completed", c))).toEqual([]);
  });
});
