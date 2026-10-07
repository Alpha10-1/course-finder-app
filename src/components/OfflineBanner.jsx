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

// Shown while the device is offline. Pages the learner has opened before keep
// working (see public/sw.js and the Firestore offline cache in firebase.js),
// but anything that saves or pays needs a connection.
export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, isOnline, isOnlineOnServer);
  if (online) return null;
  return (
    <div role="status" className="fixed top-0 inset-x-0 z-[60] print:hidden bg-gray-900 text-white text-xs sm:text-sm text-center px-4 py-2 shadow">
      You're offline. Pages you've opened before still work, but saving changes needs a connection.
    </div>
  );
}
