import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPublicRouteData } from "./routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SITE_URL = "https://mycoursefinder.web.app";

const { institutions, courses } = getPublicRouteData();

const urls = [
  { loc: `${SITE_URL}/`, changefreq: "weekly", priority: "1.0" },
  { loc: `${SITE_URL}/signup`, changefreq: "monthly", priority: "0.8" },
  { loc: `${SITE_URL}/signin`, changefreq: "monthly", priority: "0.5" },
  { loc: `${SITE_URL}/courses`, changefreq: "weekly", priority: "0.9" },
];

for (const institution of institutions) {
  urls.push({
    loc: `${SITE_URL}/courses/${institution.slug}`,
    changefreq: "monthly",
    priority: "0.7",
  });
}

for (const course of courses) {
  urls.push({
    loc: `${SITE_URL}/courses/${course.institutionSlug}/${course.courseSlug}`,
    changefreq: "monthly",
    priority: "0.6",
  });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

fs.writeFileSync(path.join(root, "public/sitemap.xml"), xml);
console.log(`sitemap.xml generated with ${urls.length} URLs (${institutions.length} institutions, ${courses.length} courses)`);

