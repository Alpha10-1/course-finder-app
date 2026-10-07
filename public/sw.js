// Course Finder service worker: lets pages a learner has already opened keep
// working offline, without downloading anything extra up front.
//
// - Page loads go to the network first, so a new deploy shows up straight
//   away; the last copy of the app shell is used only when offline.
// - Files under /assets/ have content hashes in their names and never change,
//   so once fetched they're served from the cache.
// - Firebase, Yoco, analytics and other cross-origin requests aren't touched.
//
// Bump VERSION to throw away everything cached by an earlier version.
// To switch the worker off entirely, see "Offline support" in the README.

const VERSION = "v1";
const SHELL_CACHE = `course-finder-shell-${VERSION}`;
const ASSET_CACHE = `course-finder-assets-${VERSION}`;
const SHELL_URL = "/index.html";
// Hashed builds leave old files behind after each deploy; keep the newest.
const MAX_ASSETS = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(cacheShell().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith("course-finder-") && !keep.has(n)).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Firebase Hosting's reserved paths (e.g. the auth handler) must always hit the network.
  if (url.pathname.startsWith("/__/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request, url));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirstAsset(request));
  }
});

// Caches the app shell plus the script and stylesheet it loads. Those are
// normally already in the browser's HTTP cache from the page that registered
// this worker, so this rarely costs any data.
async function cacheShell() {
  const response = await fetch(SHELL_URL, { cache: "no-cache" });
  if (!response.ok) return;
  await storeShell(response.clone());
  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  const cache = await caches.open(ASSET_CACHE);
  await Promise.all(assets.map((asset) => cache.add(asset).catch(() => {})));
}

async function storeShell(response) {
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(SHELL_URL, response);
}

async function networkFirstPage(request, url) {
  try {
    const response = await fetch(request);
    // Every route except the prerendered /courses pages is served the SPA
    // shell, so keep the newest copy for offline use.
    if (response.ok && !url.pathname.startsWith("/courses")) {
      storeShell(response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const shell = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE });
    if (shell) return shell;
    throw err;
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  // Asset URLs are content-hashed, so the URL alone identifies the file.
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trimCache(cache).catch(() => {});
  }
  return response;
}

async function trimCache(cache) {
  const keys = await cache.keys(); // oldest first
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)));
}
