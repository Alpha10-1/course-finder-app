// Turning push reminders on and off for this device.
//
// The device's FCM token is stored on the learner's user doc (`pushTokens`,
// one per device) along with `reminders: true`; api/send-reminders.js reads
// them once a day. `pushTokenAddedAt` records when each token was added: if
// several accounts were used on one shared phone, the server only sends to
// the account that registered it last. Signing out removes this device's
// token (forgetThisDevice), so the next person on the phone doesn't get the
// previous learner's notifications. Notifications are shown by our own service worker
// (public/sw.js), so Firebase Messaging is only used here to get a token —
// and only loaded (dynamically) once a learner actually turns reminders on.
import { doc, getDoc, setDoc, arrayUnion, arrayRemove, deleteField } from "firebase/firestore";
import { app, db } from "../firebase";
import { FCM_VAPID_KEY } from "../pushConfig";

const TOKEN_KEY = "cf-push-token";
const WORKER_WAIT_MS = 4000;

export function readStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function storeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing etc. — the toggle will just show "off" next time.
  }
}

// iPhones and iPads (iOS 16.4 and later) only allow web push for sites added
// to the Home Screen. iPads report a Mac user agent, so they're recognised by
// touch support instead.
function iosVersion() {
  const ua = navigator.userAgent;
  const ipadAsMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (!/iphone|ipad|ipod/i.test(ua) && !ipadAsMac) return null;
  const m = /OS (\d+)_(\d+)/.exec(ua) || /Version\/(\d+)\.(\d+)/.exec(ua);
  return m ? Number(m[1]) + Number(m[2]) / 100 : 0;
}

function iosStatus() {
  const version = iosVersion();
  if (version === null) return null;
  const installed = navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  if (version < 16.04) return "unsupported";
  return installed ? null : "ios-install";
}

// The worker is registered on page load in production builds only, so in
// development (or if registration failed) this gives up after a moment.
function serviceWorkerReady() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), WORKER_WAIT_MS)),
  ]);
}

/**
 * Whether reminders can be offered on this device:
 * "unconfigured" (no VAPID key yet), "unsupported", "ios-install" (iPhone or
 * iPad on iOS 16.4+, not added to the Home Screen), or the notification permission:
 * "default" | "granted" | "denied".
 */
export async function getPushStatus() {
  if (!FCM_VAPID_KEY) return "unconfigured";
  if (typeof window === "undefined") return "unsupported";
  const hasApis = "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
  if (!hasApis) return iosStatus() || "unsupported";
  try {
    const { isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return "unsupported";
  } catch {
    return "unsupported";
  }
  if (!(await serviceWorkerReady())) return "unsupported";
  return Notification.permission;
}

async function getDeviceToken() {
  const registration = await serviceWorkerReady();
  if (!registration) throw new Error("Reminders need the installed app or a refresh of this page.");
  const { getMessaging, getToken } = await import("firebase/messaging");
  return getToken(getMessaging(app), { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: registration });
}

/**
 * Asks for notification permission and registers this device.
 * Returns the resulting permission ("granted", "denied" or "default").
 */
export async function enableReminders(uid) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  const token = await getDeviceToken();
  await setDoc(doc(db, "users", uid), {
    reminders: true,
    pushTokens: arrayUnion(token),
    pushTokenAddedAt: { [token]: new Date().toISOString() },
  }, { merge: true });
  storeToken(token);
  return permission;
}

// Takes this device's token off the learner's record and unsubscribes it.
async function removeThisDevice(uid) {
  const token = readStoredToken();
  if (token) {
    await setDoc(doc(db, "users", uid), {
      pushTokens: arrayRemove(token),
      pushTokenAddedAt: { [token]: deleteField() },
    }, { merge: true });
  }
  storeToken(null);
  // Unsubscribing makes the token unusable straight away, even if it's still
  // listed somewhere; the server drops dead tokens when it next sends.
  try {
    const registration = await serviceWorkerReady();
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {
    // Nothing more to do — the token is already off the learner's record.
  }
}

/**
 * Called on sign-out: this phone stops getting this learner's reminders
 * (their other devices keep theirs). Never throws.
 */
export async function forgetThisDevice(uid) {
  if (!uid || !readStoredToken()) return;
  try {
    await removeThisDevice(uid);
  } catch (err) {
    console.warn("Couldn't remove this device's reminders:", err);
  }
}

/** Stops reminders on this device (other devices keep theirs). */
export async function disableReminders(uid) {
  await removeThisDevice(uid);
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const remaining = snap.exists() ? snap.data().pushTokens || [] : [];
  if (remaining.length === 0) await setDoc(ref, { reminders: false }, { merge: true });
}

/**
 * FCM tokens can change over time. Called when reminders are on, so the
 * learner's record always has this device's current token.
 */
export async function refreshReminderToken(uid) {
  const previous = readStoredToken();
  const token = await getDeviceToken();
  if (token === previous) return;
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    reminders: true,
    pushTokens: arrayUnion(token),
    pushTokenAddedAt: { [token]: new Date().toISOString() },
  }, { merge: true });
  if (previous) {
    await setDoc(ref, { pushTokens: arrayRemove(previous), pushTokenAddedAt: { [previous]: deleteField() } }, { merge: true });
  }
  storeToken(token);
}
