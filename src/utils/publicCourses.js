import universityCoursesRaw from "../data/courses.json";
import collegeCoursesRaw from "../data/college-courses.json";
import { slugify } from "./slug";

// College entries can list multiple campuses; for the public marketing
// pages we don't want a separate URL per campus (duplicate-content risk,
// and not what anyone searches for) — instead we collapse campuses into a
// single course entry with a `campuses` list.
function normalizeCollegeCourse(entry) {
  const { campuses, ...rest } = entry;
  return {
    ...rest,
    institutionType: "college",
    campuses: (campuses || []).map((c) => c.campus).filter(Boolean),
  };
}

function normalizeUniversityCourse(entry) {
  return {
    ...entry,
    institutionType: "university",
    campuses: [],
  };
}

const allCourses = [
  ...universityCoursesRaw.map(normalizeUniversityCourse),
  ...collegeCoursesRaw.map(normalizeCollegeCourse),
];

// Assign stable, unique slugs: institution slug + course slug (deduped with
// a numeric suffix if two courses at the same institution would collide).
const institutionSlugSeen = new Map(); // slug -> canonical institution name
const courseSlugsByInstitution = new Map(); // institutionSlug -> Set of used course slugs

export const COURSES = allCourses.map((course) => {
  const institutionSlug = slugify(course.institution);
  if (!institutionSlugSeen.has(institutionSlug)) {
    institutionSlugSeen.set(institutionSlug, course.institution);
  }

  let courseSlug = slugify(course.courseName);
  const used = courseSlugsByInstitution.get(institutionSlug) || new Set();
  let n = 2;
  let candidate = courseSlug;
  while (used.has(candidate)) {
    candidate = `${courseSlug}-${n}`;
    n += 1;
  }
  used.add(candidate);
  courseSlugsByInstitution.set(institutionSlug, used);

  return { ...course, institutionSlug, courseSlug: candidate };
});

export function getInstitutions() {
  const map = new Map();
  for (const c of COURSES) {
    if (!map.has(c.institutionSlug)) {
      map.set(c.institutionSlug, {
        slug: c.institutionSlug,
        name: c.institution,
        type: c.institutionType,
        courseCount: 0,
        faculties: new Set(),
      });
    }
    const entry = map.get(c.institutionSlug);
    entry.courseCount += 1;
    if (c.faculty) entry.faculties.add(c.faculty);
  }
  return Array.from(map.values())
    .map((e) => ({ ...e, faculties: Array.from(e.faculties).sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getInstitutionBySlug(slug) {
  return getInstitutions().find((i) => i.slug === slug) || null;
}

export function getCoursesByInstitution(slug) {
  return COURSES.filter((c) => c.institutionSlug === slug).sort((a, b) =>
    a.courseName.localeCompare(b.courseName)
  );
}

export function getCourseBySlugs(institutionSlug, courseSlug) {
  return (
    COURSES.find(
      (c) => c.institutionSlug === institutionSlug && c.courseSlug === courseSlug
    ) || null
  );
}
