import { describe, expect, it } from "vitest";
import { COURSES, getCourseBySlugs, getInstitutionBySlug, getInstitutions } from "./publicCourses";
import { slugify } from "./slug";
import { getPublicRouteData } from "../../scripts/routes.mjs";

describe("slugify", () => {
  it("produces lowercase, hyphenated, URL-safe slugs", () => {
    expect(slugify("BSc (Computer Science) & Maths")).toBe("bsc-computer-science-and-maths");
    expect(slugify("  University of KwaZulu-Natal ")).toBe("university-of-kwazulu-natal");
    expect(slugify(null)).toBe("");
  });
});

describe("public course pages", () => {
  it("gives every course a unique URL", () => {
    const urls = COURSES.map((c) => `${c.institutionSlug}/${c.courseSlug}`);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("looks courses and institutions up by slug", () => {
    const course = COURSES[0];
    expect(getCourseBySlugs(course.institutionSlug, course.courseSlug)).toBe(course);
    expect(getInstitutionBySlug(course.institutionSlug)?.name).toBe(course.institution);
    expect(getCourseBySlugs("no-such-place", "nothing")).toBeNull();
  });

  it("counts courses per institution", () => {
    const total = getInstitutions().reduce((n, i) => n + i.courseCount, 0);
    expect(total).toBe(COURSES.length);
  });

  // The sitemap and prerenderer (scripts/routes.mjs) derive URLs separately
  // from the app (publicCourses.js). If they ever disagree, prerendered pages
  // and sitemap entries point at URLs the app can't resolve.
  it("matches the URLs the sitemap and prerenderer generate", () => {
    const { courses, institutions } = getPublicRouteData();
    const routeUrls = new Set(courses.map((c) => `${c.institutionSlug}/${c.courseSlug}`));
    const appUrls = new Set(COURSES.map((c) => `${c.institutionSlug}/${c.courseSlug}`));
    expect(routeUrls).toEqual(appUrls);
    expect(new Set(institutions.map((i) => i.slug))).toEqual(new Set(getInstitutions().map((i) => i.slug)));
  });
});
