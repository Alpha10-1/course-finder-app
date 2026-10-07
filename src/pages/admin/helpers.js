import { calculateAPSForCourse, getEffectiveMinAPS, meetsCollegeRequirement } from "../../utils/marksToAPS";
import { meetsKeySubjects } from "../../utils/subjectMatch";

// Given a learner's saved subjects/grade and the full course catalog, returns
// every course they currently qualify for — mirrors the matching logic used
// on the learner-facing Results page (see src/pages/Results.jsx) so the admin
// view always agrees with what the learner themselves would see.
export function getQualifiedCourses(user, allCourses) {
  if (!user?.subjects?.length || !allCourses?.length) return [];
  const { subjects, grade, gradeStatus } = user;
  return allCourses.filter((course) => {
    if (course.institutionType === "college") {
      if (!meetsCollegeRequirement(grade, gradeStatus, course)) return false;
    } else {
      const { score: uniAps } = calculateAPSForCourse(course, subjects);
      const requiredAPS = getEffectiveMinAPS(course, subjects);
      if (uniAps < requiredAPS) return false;
    }
    return meetsKeySubjects(subjects, course.keySubjects);
  });
}

// Derives per-institution + overall "Apply For Me" application progress from
// a user's saved course selections and the admin-maintained applicationProgress
// map (which institutions an admin has actually submitted the application for).
export function getApplicationProgress(user) {
  const institutions = Object.keys(user?.applySelections || {});
  if (institutions.length === 0) return { status: null, appliedCount: 0, total: 0 };
  const progress = user.applicationProgress || {};
  const appliedCount = institutions.filter((inst) => progress[inst]?.applied).length;
  const status = appliedCount === 0 ? "not_started" : appliedCount === institutions.length ? "complete" : "in_progress";
  return { status, appliedCount, total: institutions.length };
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
