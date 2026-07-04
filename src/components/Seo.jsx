import { Helmet } from "react-helmet-async";

const SITE_NAME = "Course Finder";
const SITE_URL = "https://mycoursefinder.web.app";
const DEFAULT_DESCRIPTION =
  "Find the South African university and college courses you qualify for. Enter your Grade 11 or 12 marks and instantly see matching courses, APS scores, and admission requirements.";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

/**
 * Drop this in any page to control that route's <title>, meta description,
 * canonical URL, Open Graph / Twitter tags, and indexability.
 *
 * `noindex` should be true for any page that requires auth or is a dead end
 * for a logged-out crawler (e.g. app screens behind sign-in) — there's no
 * point letting Google index a page that just redirects visitors to /signin.
 */
export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  image = DEFAULT_IMAGE,
  noindex = false,
  jsonLd = null,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Find Courses You Qualify For`;
  const url = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_ZA" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
