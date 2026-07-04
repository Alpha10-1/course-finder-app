// Runs AFTER both `vite build` (client) and `vite build --ssr src/entry-server.jsx`
// (server bundle) have completed. For every known /courses/* URL, it renders
// real HTML via React's server renderer and writes it into dist/<path>/index.html.
//
// Why: Firebase Hosting serves an exact static file at a path before falling
// back to the SPA rewrite. So a crawler (or a share-link unfurler that never
// runs JS at all — WhatsApp, Slack, X, LinkedIn) hitting /courses/wits/bcom
// gets real, page-specific HTML with the correct <title>, description, OG
// image, and JSON-LD already in the document — not just the generic
// index.html shell waiting on JavaScript.
//
// The client JS bundle is still referenced in every generated file, so once
// it loads, React takes over as a normal SPA for interactivity — this only
// changes what's in the document on first byte.
//
// React 19 natively hoists <title>/<meta>/<link>/<script> tags rendered
// anywhere in the tree (that's how react-helmet-async's <Helmet> works under
// React 19 — see src/entry-server.jsx) to the very front of the string
// renderToString() returns. So rather than pulling metadata out of a helmet
// context object (the old react-helmet-async API, which isn't used in React
// 19 mode), we parse those hoisted tags off the front of the output here.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPublicRouteData } from "./routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const ssrEntryPath = path.join(root, "dist-ssr/entry-server.js");

if (!fs.existsSync(ssrEntryPath)) {
  console.error("Missing dist-ssr/entry-server.js — run the ssr build step first.");
  process.exit(1);
}

const { render } = await import("file://" + ssrEntryPath);

const template = fs.readFileSync(path.join(distDir, "index.html"), "utf-8");

// Matches one hoistable head tag at the very start of the remaining string:
// <title>...</title>, self-closing <meta .../>, <link .../>, or
// <script ...>...</script>.
const LEADING_HEAD_TAG =
  /^(<title>.*?<\/title>|<meta\b[^>]*\/>|<link\b[^>]*\/>|<script\b[^>]*>.*?<\/script>)/s;

function splitHeadFromBody(html) {
  let head = "";
  let rest = html;
  let match;
  while ((match = rest.match(LEADING_HEAD_TAG))) {
    head += match[0];
    rest = rest.slice(match[0].length);
  }
  return { head, body: rest };
}

// Strip the static default SEO tags from the template before injecting the
// per-page ones, so we don't end up with two <title>s, two og:title metas,
// etc. in the same document.
const STRIP_PATTERNS = [
  /<title>.*?<\/title>\s*/s,
  /<meta name="description"[^>]*>\s*/,
  /<link rel="canonical"[^>]*>\s*/,
  /<meta property="og:[^>]*>\s*/g,
  /<meta name="twitter:[^>]*>\s*/g,
  /<script type="application\/ld\+json">.*?<\/script>\s*/s,
];

function stripDefaultSeo(html) {
  let out = html;
  for (const pattern of STRIP_PATTERNS) {
    out = out.replace(pattern, "");
  }
  return out;
}

function renderPage(routePath) {
  const { html } = render(routePath);
  const { head, body } = splitHeadFromBody(html);

  let doc = stripDefaultSeo(template);
  doc = doc.replace("</head>", `    ${head}\n  </head>`);
  doc = doc.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return doc;
}

function writePage(routePath, doc) {
  const outDir = path.join(distDir, routePath.replace(/^\//, ""));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), doc);
}

const { institutions, courses } = getPublicRouteData();

const routes = [
  "/courses",
  ...institutions.map((i) => `/courses/${i.slug}`),
  ...courses.map((c) => `/courses/${c.institutionSlug}/${c.courseSlug}`),
];

let count = 0;
for (const routePath of routes) {
  const doc = renderPage(routePath);
  writePage(routePath, doc);
  count += 1;
}

console.log(`Prerendered ${count} static course pages into dist/`);

