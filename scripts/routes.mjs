import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slugify } from "../src/utils/slug.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/**
 * Returns { institutions: [{slug, name}], courses: [{institutionSlug, courseSlug}] }
 * built from the same JSON data the app uses, so the sitemap, the
 * prerenderer, and the app itself can never disagree on what a "course" URL
 * looks like.
 */
export function getPublicRouteData() {
  const universityCourses = JSON.parse(
    fs.readFileSync(path.join(root, "src/data/courses.json"), "utf-8")
  );
  const collegeCourses = JSON.parse(
    fs.readFileSync(path.join(root, "src/data/college-courses.json"), "utf-8")
  );
  const allCourses = [...universityCourses, ...collegeCourses];

  const institutionSlugs = new Map(); // slug -> name
  const courseSlugsByInstitution = new Map(); // institutionSlug -> Set of slugs

  for (const course of allCourses) {
    const institutionSlug = slugify(course.institution);
    institutionSlugs.set(institutionSlug, course.institution);

    const used = courseSlugsByInstitution.get(institutionSlug) || new Set();
    let candidate = slugify(course.courseName);
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${slugify(course.courseName)}-${n}`;
      n += 1;
    }
    used.add(candidate);
    courseSlugsByInstitution.set(institutionSlug, used);
  }

  const institutions = Array.from(institutionSlugs, ([slug, name]) => ({ slug, name }));
  const courses = [];
  for (const [institutionSlug, slugs] of courseSlugsByInstitution) {
    for (const courseSlug of slugs) {
      courses.push({ institutionSlug, courseSlug });
    }
  }

  return { institutions, courses };
}
