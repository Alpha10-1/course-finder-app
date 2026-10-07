import { courseQualifies } from "../../utils/matching";

// Given a learner's saved subjects/grade and the full course catalog, returns
// every course they currently qualify for — the same check the learner-facing
// Results page uses, so the admin view always agrees with what they see.
export function getQualifiedCourses(user, allCourses) {
  if (!user?.subjects?.length || !allCourses?.length) return [];
  const { subjects, grade, gradeStatus } = user;
  return allCourses.filter((course) => courseQualifies(course, subjects, { grade, gradeStatus }));
}

// qualificationCode is included when present so that distinct qualification
// variants that otherwise share the same name/institution/campus/faculty
// (e.g. two different UP "BSc (Biochemistry)" streams with different
// qualificationCode values) are treated as separate courses rather than
// collapsing into one. This matters more now that a dedupe-key match causes
// seeding to OVERWRITE the existing doc (see handleSeedCourses) rather than
// just skip it — an incorrect match here would silently destroy real data.
export function courseDedupeKey(c) {
  return [
    (c.courseName       || "").trim().toLowerCase(),
    (c.institution       || "").trim().toLowerCase(),
    (c.campus            || "").trim().toLowerCase(),
    (c.faculty            || "").trim().toLowerCase(),
    (c.qualificationCode || "").trim().toLowerCase(),
  ].join("|||");
}

// Build a diff between the old course doc and the new edited data
export function buildCourseDiff(oldData, newData) {
  const diff = {};
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  allKeys.forEach((key) => {
    if (key === "id") return;
    const oldVal = JSON.stringify(oldData[key] ?? null);
    const newVal = JSON.stringify(newData[key] ?? null);
    if (oldVal !== newVal) {
      diff[key] = { from: oldData[key] ?? null, to: newData[key] ?? null };
    }
  });
  return diff;
}
