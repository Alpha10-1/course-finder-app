import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPublicRouteData } from "./routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SITE_URL = "https://mycoursefinder.web.app";

const { institutions, courses } = getPublicRouteData();

// Deliberately NOT listing every individual /courses/:institution/:course page
// here. With 1,800+ courses that would bloat the sitemap to ~1,900 URLs,
// which slows down how quickly Google can crawl and process it and dilutes
// crawl budget across mostly-similar pages.
//
// A sitemap only needs to help a crawler *discover* URLs it might otherwise
// miss — it doesn't need to be exhaustive. Every course page is still fully
// crawlable: it's a real prerendered static HTML file (see prerender.mjs)
// and it's linked directly from its institution's course-listing page, which
// IS in the sitemap. Google reliably follows on-page links from indexed hub
// pages, so course pages still get found and indexed — just via normal
// crawling rather than being force-fed through the sitemap.
//
// This keeps the sitemap to the pages that actually need Google's priority
// attention (home, signup, the course search, and each institution hub),
// while individual course pages are indexed at Google's own pace through
// links. Net effect: faster full processing of the sitemap itself, without
// losing any course page from eventual discovery/indexing.
const urls = [
  { loc: `${SITE_URL}/`, changefreq: "weekly", priority: "1.0" },
  { loc: `${SITE_URL}/signup`, changefreq: "monthly", priority: "0.8" },
  { loc: `${SITE_URL}/signin`, changefreq: "monthly", priority: "0.5" },
  { loc: `${SITE_URL}/courses`, changefreq: "weekly", priority: "0.9" },
];

for (const institution of institutions) {
  urls.push({
    loc: `${SITE_URL}/courses/${institution.slug}`,
    changefreq: "weekly",
    priority: "0.7",
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
console.log(
  `sitemap.xml generated with ${urls.length} URLs (4 static + ${institutions.length} institution hubs). ` +
  `${courses.length} individual course pages are intentionally omitted from the sitemap — ` +
  `they remain crawlable via links from their institution pages and via prerendered static HTML.`
);