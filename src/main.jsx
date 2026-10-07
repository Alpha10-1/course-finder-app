import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import "./index.css";

// If a dynamic import (e.g. lazy-loaded route or data chunk) 404s because a
// new deploy went out while this tab was open, the old chunk hash no longer
// exists on the server. Reload once to pick up the fresh index.html/assets
// instead of surfacing a confusing "failed to fetch module" error.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const key = "vite-preload-reload-once";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }
});

// Offline support (public/sw.js). Production only — in dev the worker would
// cache Vite's dev-server modules and get in the way of hot reloading.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);