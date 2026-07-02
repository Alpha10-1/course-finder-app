import { readFileSync } from "fs";
import { meetsKeySubjects } from "./src/utils/subjectMatch.js";
import { meetsCollegeRequirement, getEffectiveMinAPS } from "./src/utils/marksToAPS.js";

const collegeCourses = JSON.parse(readFileSync("./src/data/college-courses.json", "utf8"));

function expandCollegeCourse(entry) {
  const { campuses, curriculum, _comment, ...base } = entry;
  if (!campuses || campuses.length === 0) {
    return [{ institutionType: "college", keySubjects: [], faculty: "", ...base, curriculum: curriculum || null }];
  }
  return campuses.map((campus) => {
    const exclude = new Set((campus.excludeVocational || []).map((s) => s.trim().toLowerCase()));
    const vocationalSubjects = (curriculum?.vocationalSubjects || []).filter(
      (v) => !exclude.has((v.subject || "").trim().toLowerCase())
    );
    return {
      institutionType: "college", keySubjects: [], faculty: "", ...base,
      institution: campus.institution,
      curriculum: curriculum ? { ...curriculum, vocationalSubjects } : null,
    };
  });
}

const expanded = collegeCourses.flatMap(expandCollegeCourse);
console.log(`Expanded ${collegeCourses.length} source entries -> ${expanded.length} course docs\n`);

function check(course, grade, gradeStatus, subjects, label) {
  const gradeOk = meetsCollegeRequirement(grade, gradeStatus, course);
  const subjOk = meetsKeySubjects(subjects, course.keySubjects);
  const qualifies = gradeOk && subjOk;
  console.log(
    `[${qualifies ? "PASS" : "FAIL"}] ${label} — grade/NQF: ${gradeOk ? "OK" : "NO"}, subjects: ${subjOk ? "OK" : "NO"} -> ${course.courseName} @ ${course.institution}`
  );
}

// ── N4 Certificate: Electrical Engineering (requires Grade 11, Maths L3 (40%+), Physics L3 (40%+)) ──
const n4 = expanded.find((c) => c.courseName.includes("N4 Certificate"));
console.log("--- N4 Certificate: Electrical Engineering ---");
check(n4, "Grade 11", "completed", [
  { subject: "Mathematics", mark: 45 },
  { subject: "Physical Sciences", mark: 42 },
], "Grade 11 completed, Maths 45%, Phys Sci 42% (should qualify)");

check(n4, "Grade 11", "completed", [
  { subject: "Mathematics", mark: 35 }, // below level 3 (40%)
  { subject: "Physical Sciences", mark: 42 },
], "Grade 11 completed, Maths 35% -- below required level 3 (should FAIL subjects)");

check(n4, "Grade 10", "completed", [
  { subject: "Mathematics", mark: 45 },
  { subject: "Physical Sciences", mark: 42 },
], "Only Grade 10 completed -- below required Grade 11 (should FAIL grade)");

check(n4, "Grade 11", "current", [ // currently IN grade 11 -> highest completed = Grade 10
  { subject: "Mathematics", mark: 45 },
  { subject: "Physical Sciences", mark: 42 },
], "Currently in Grade 11 (only Grade 10 completed) (should FAIL grade)");

// ── NC(V) Electrical Infrastructure Construction (requires Grade 9 only, no subject prereqs) ──
console.log("\n--- NC(V) Electrical Infrastructure Construction (5 campuses) ---");
const ncvCourses = expanded.filter((c) => c.courseName.includes("NC (V)"));
ncvCourses.forEach((c) => {
  check(c, "Grade 9", "completed", [], `Grade 9 completed, no subjects entered (${c.institution})`);
});
check(ncvCourses[0], "Grade 9", "current", [], "Currently in Grade 9 (0 completed) -- below Grade 9 (should FAIL grade)");
check(ncvCourses[0], "Grade 12", "completed", [], "Grade 12 completed -- well above Grade 9 (should qualify)");

// Confirm Physical Science curriculum only appears at Kempton Park
console.log("\n--- Curriculum campus-specific subject check ---");
ncvCourses.forEach((c) => {
  const hasPhysSci = (c.curriculum?.vocationalSubjects || []).some((v) => v.subject === "Physical Science");
  console.log(`${c.institution}: Physical Science offered = ${hasPhysSci}`);
});
