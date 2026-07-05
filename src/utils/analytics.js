// gtag.js is loaded in index.html with send_page_view disabled — this is
// the only place page_view events get sent, called once per client-side
// route change (see AnalyticsListener in App.jsx).
export function trackPageview(path) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}