import { renderToString } from "react-dom/server";
import { StaticRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import CoursesDirectory from "./pages/public/CoursesDirectory.jsx";
import InstitutionCourses from "./pages/public/InstitutionCourses.jsx";
import CourseDetail from "./pages/public/CourseDetail.jsx";

// Only the public, data-driven course pages are rendered here. They don't
// touch Firebase auth or any browser-only APIs, so they're safe to render
// in Node at build time. Welcome/SignIn/SignUp are intentionally excluded —
// they depend on Firebase's auth listener, which assumes a browser.
//
// Note: with React 19, <title>/<meta>/<link>/<script> tags rendered via
// react-helmet-async's <Helmet> are hoisted natively by React itself during
// renderToString — they show up at the very start of the returned HTML
// string. There's no separate "helmet context" to extract in this React
// version, so the prerender script just parses the head tags back out of
// the rendered string (see scripts/prerender.mjs).
export function render(url) {
  const html = renderToString(
    <HelmetProvider>
      <StaticRouter location={url}>
        <Routes>
          <Route path="/courses" element={<CoursesDirectory />} />
          <Route path="/courses/:institutionSlug" element={<InstitutionCourses />} />
          <Route path="/courses/:institutionSlug/:courseSlug" element={<CourseDetail />} />
        </Routes>
      </StaticRouter>
    </HelmetProvider>
  );
  return { html };
}

