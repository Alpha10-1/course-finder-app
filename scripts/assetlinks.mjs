// Builds public/.well-known/assetlinks.json, which proves to Android that
// the Course Finder app (a Trusted Web Activity) and mycoursefinder.web.app
// belong together. Without it, the app still opens but shows a browser
// address bar at the top. See docs/android-app.md.

export const DEFAULT_PACKAGE = "app.web.mycoursefinder.twa";

const PACKAGE_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
const FINGERPRINT_PATTERN = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/** "aa:bb…" or "AABB…" (as keytool and Play Console show it) → "AA:BB:…". */
export function normalizeFingerprint(raw) {
  const hex = String(raw).replace(/^SHA-?256:?\s*/i, "").replace(/[\s:]/g, "").toUpperCase();
  const formatted = hex.match(/.{1,2}/g)?.join(":") ?? "";
  if (!FINGERPRINT_PATTERN.test(formatted)) {
    throw new Error(`"${raw}" isn't a SHA-256 certificate fingerprint (32 bytes, e.g. 14:6D:E9:…:83).`);
  }
  return formatted;
}

export function buildAssetLinks(packageName, fingerprints) {
  if (!PACKAGE_PATTERN.test(packageName)) {
    throw new Error(`"${packageName}" isn't a valid Android package name (e.g. ${DEFAULT_PACKAGE}).`);
  }
  if (!fingerprints.length) throw new Error("Give at least one --fingerprint.");
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: Array.from(new Set(fingerprints.map(normalizeFingerprint))),
      },
    },
  ];
}
