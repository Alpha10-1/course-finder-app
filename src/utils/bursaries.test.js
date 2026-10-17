import { describe, expect, it } from "vitest";
import universityCourses from "../data/courses.json";
import collegeCourses from "../data/college-courses.json";
import {
  ANY_FIELD,
  bursariesForLearner,
  saToday,
  studyFieldsForCourse,
  studyFieldsForCourses,
  validateBursary,
} from "./bursaries";

const fieldsOf = (courseName, faculty = "") => studyFieldsForCourse({ courseName, faculty }).sort();

describe("studyFieldsForCourse", () => {
  it("uses the course name when it says what the course is", () => {
    expect(fieldsOf("Bachelor of Commerce (General)", "Faculty of Commerce, Law & Management")).toEqual(["commerce"]);
    expect(fieldsOf("Bachelor of Laws (LLB)", "Faculty of Commerce, Law & Management")).toEqual(["law"]);
    expect(fieldsOf("BSc Computer Science", "Faculty of Science")).toEqual(["it", "science"]);
    expect(fieldsOf("Bachelor of Education (Foundation Phase)", "Faculty of Education")).toEqual(["education"]);
    expect(fieldsOf("Bachelor of Nursing", "Faculty of Health Sciences")).toEqual(["health"]);
    expect(fieldsOf("MBChB", "School of Medicine")).toEqual(["health"]);
    expect(fieldsOf("Diploma in Civil Engineering", "Engineering and the Built Environment")).toEqual(["engineering"]);
    // Abbreviated engineering degrees (UCT, Wits) are engineering too.
    expect(fieldsOf("BEng (Chemical)", "Faculty of Engineering")).toContain("engineering");
    expect(fieldsOf("B Sc Eng: Computer", "Faculty of Engineering and the Built Environment")).toEqual(["engineering", "it"]);
  });

  it("doesn't treat health, social or management 'sciences' as natural science", () => {
    expect(fieldsOf("Bachelor of Social Science", "Faculty of Humanities")).toEqual(["humanities"]);
    expect(fieldsOf("Higher Certificate", "Faculty of Health Sciences")).toEqual(["health"]);
    expect(fieldsOf("Higher Certificate", "Faculty of Economic and Management Sciences")).toEqual(["commerce"]);
    expect(fieldsOf("Higher Certificate", "Faculty of Natural and Agricultural Sciences")).toEqual(["agriculture", "science"]);
  });

  it("falls back to the faculty, and returns nothing for general programmes", () => {
    expect(fieldsOf("Higher Certificate", "Faculty of Science, Agriculture and Engineering")).toEqual(["agriculture", "engineering", "science"]);
    expect(fieldsOf("Bridging course", "Bridging Programme")).toEqual([]);
  });

  it("places most real courses in at least one field", () => {
    const all = [...universityCourses, ...collegeCourses];
    const unplaced = all.filter((c) => studyFieldsForCourse(c).length === 0);
    // General / utility / bridging programmes legitimately have no field;
    // they still see "any field" bursaries.
    expect(unplaced.length / all.length).toBeLessThan(0.05);
  });
});

describe("studyFieldsForCourses", () => {
  it("collects the fields of every course", () => {
    const fields = studyFieldsForCourses([
      { courseName: "Bachelor of Laws", faculty: "Law" },
      { courseName: "Bachelor of Education", faculty: "Education" },
    ]);
    expect([...fields].sort()).toEqual(["education", "law"]);
  });
});

describe("saToday", () => {
  it("uses South African time", () => {
    // 23:30 UTC is already the next day in South Africa (UTC+2).
    expect(saToday(new Date("2026-10-16T23:30:00Z"))).toBe("2026-10-17");
    expect(saToday(new Date("2026-10-16T08:00:00Z"))).toBe("2026-10-16");
  });
});

describe("bursariesForLearner", () => {
  const now = new Date("2026-10-16T08:00:00Z");
  const bursaries = [
    { id: "eng", name: "Engineering bursary", fields: ["engineering"], closeDate: "2026-11-30" },
    { id: "any", name: "Open bursary", fields: [ANY_FIELD], closeDate: null },
    { id: "edu", name: "Teaching bursary", fields: ["education"], closeDate: "2026-10-31" },
    { id: "past", name: "Closed bursary", fields: ["engineering"], closeDate: "2026-10-15" },
    { id: "today", name: "Closes today", fields: ["engineering", "science"], closeDate: "2026-10-16" },
    { id: "law", name: "Law bursary", fields: ["law"], closeDate: "2026-12-01" },
  ];

  it("shows open bursaries for the learner's fields, soonest closing first", () => {
    const shown = bursariesForLearner(bursaries, new Set(["engineering", "education"]), now);
    expect(shown.map((b) => b.id)).toEqual(["today", "edu", "eng", "any"]);
    expect(shown[0].matchedFields).toEqual(["engineering"]);
    expect(shown.find((b) => b.id === "any").anyField).toBe(true);
  });

  it("still shows any-field bursaries when no field matches", () => {
    expect(bursariesForLearner(bursaries, new Set(), now).map((b) => b.id)).toEqual(["any"]);
  });
});

describe("validateBursary", () => {
  const valid = {
    name: " Funza Lushaka ", provider: "Department of Basic Education", fields: ["education", "nonsense"],
    closeDate: "2027-01-15", applyUrl: "https://www.funzalushaka.doe.gov.za", description: "", covers: "", academicYear: "2027",
  };

  it("cleans up a valid form", () => {
    const { errors, bursary } = validateBursary(valid);
    expect(errors).toEqual([]);
    expect(bursary.name).toBe("Funza Lushaka");
    expect(bursary.fields).toEqual(["education"]);
  });

  it("reports what's missing or malformed", () => {
    const { errors } = validateBursary({ ...valid, name: "", fields: [], closeDate: "15/01/2027", applyUrl: "javascript:alert(1)" });
    expect(errors).toHaveLength(4);
  });

  it("allows a bursary without a closing date", () => {
    const { errors, bursary } = validateBursary({ ...valid, closeDate: "" });
    expect(errors).toEqual([]);
    expect(bursary.closeDate).toBeNull();
  });
});
