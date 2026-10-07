import { calculateAPSForCourse, getEffectiveMinAPS, meetsCollegeRequirement } from "./marksToAPS";
import { getKeySubjectStatus, meetsKeySubjects } from "./subjectMatch";

/**
 * Whether a learner qualifies for a course. Colleges gate on the highest
 * grade/NQF level completed, universities on the course's own APS model;
 * both then need the course's subject minimums. Shared by the results page,
 * the admin views and the what-if tools so they always agree.
 *
 * @param {object} course
 * @param {Array<{subject: string, mark: number|string}>} subjects
 * @param {{grade?: string, gradeStatus?: string}} profile
 */
export function courseQualifies(course, subjects, { grade, gradeStatus } = {}) {
  if (course.institutionType === "college") {
    if (!meetsCollegeRequirement(grade, gradeStatus, course)) return false;
  } else {
    const { score } = calculateAPSForCourse(course, subjects);
    if (score < getEffectiveMinAPS(course, subjects)) return false;
  }
  return meetsKeySubjects(subjects, course.keySubjects);
}

const hasMark = (s) => s.mark !== "" && s.mark !== null && s.mark !== undefined && Number.isFinite(Number(s.mark));

/** Every entered mark raised by `points` (capped at 100); blank marks stay blank. */
export function raiseMarks(subjects, points) {
  return subjects.map((s) => (hasMark(s) ? { ...s, mark: Math.min(100, Number(s.mark) + points) } : s));
}

/**
 * What currently stands between the learner and a course: an APS shortfall
 * (universities) and any subject minimums not met.
 *
 * @returns {Array<{type: "aps", have: number, need: number} | {type: "subject", label: string, have: number|null}>}
 */
export function getCourseGaps(course, subjects) {
  const gaps = [];
  if (course.institutionType !== "college") {
    const { score } = calculateAPSForCourse(course, subjects);
    const need = getEffectiveMinAPS(course, subjects);
    if (score < need) gaps.push({ type: "aps", have: score, need });
  }
  for (const req of getKeySubjectStatus(subjects, course.keySubjects)) {
    if (!req.met) gaps.push({ type: "subject", label: req.label, have: req.userMark ?? null });
  }
  return gaps;
}

export const WITHIN_REACH_MAX_RAISE = 10;

/**
 * Courses the learner doesn't qualify for yet but would if every mark were
 * up to `maxRaise` percentage points higher. A uniform raise is a rough guide,
 * so each result also lists the specific gaps. Courses needing a subject the
 * learner didn't take, or a higher completed grade, never show up here —
 * better marks alone can't fix those. Sorted by the smallest raise needed.
 */
export function findCoursesWithinReach(courses, subjects, profile, maxRaise = WITHIN_REACH_MAX_RAISE) {
  const raised = Array.from({ length: maxRaise + 1 }, (_, p) => raiseMarks(subjects, p));
  const results = [];
  for (const course of courses) {
    if (courseQualifies(course, subjects, profile)) continue;
    if (!courseQualifies(course, raised[maxRaise], profile)) continue;
    let raiseNeeded = maxRaise;
    for (let p = 1; p < maxRaise; p++) {
      if (courseQualifies(course, raised[p], profile)) { raiseNeeded = p; break; }
    }
    results.push({ course, raiseNeeded, gaps: getCourseGaps(course, subjects) });
  }
  return results.sort((a, b) =>
    a.raiseNeeded - b.raiseNeeded || String(a.course.courseName).localeCompare(String(b.course.courseName))
  );
}

/** Courses gained and lost when a learner's marks change from `before` to `after`. */
export function compareQualification(courses, before, after, profile) {
  const gained = [];
  const lost = [];
  let count = 0;
  for (const course of courses) {
    const was = courseQualifies(course, before, profile);
    const now = courseQualifies(course, after, profile);
    if (now) count++;
    if (now && !was) gained.push(course);
    if (was && !now) lost.push(course);
  }
  return { count, gained, lost };
}
