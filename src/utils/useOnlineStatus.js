import { useSyncExternalStore } from "react";

function subscribe(onChange) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const isOnline = () => navigator.onLine;
const isOnlineOnServer = () => true;

/** Whether the browser says it's online; always true during prerendering. */
export default function useOnlineStatus() {
  return useSyncExternalStore(subscribe, isOnline, isOnlineOnServer);
}
