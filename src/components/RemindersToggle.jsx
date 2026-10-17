import { useEffect, useRef, useState } from "react";
import {
  getPushStatus, enableReminders, disableReminders, refreshReminderToken, readStoredToken,
} from "../utils/pushReminders";

// "Remind me when applications open or close" — turns push reminders on or
// off for this device. Renders nothing until push is configured
// (src/pushConfig.js) and on browsers that can't receive web push.
//
// `pushTokens` is the learner's saved device list, used to tell whether this
// device is already registered.
//
// Accessibility: the outcome of each click is announced through one status
// region that stays mounted, and keyboard focus moves to the control that
// replaces the one just pressed.
export default function RemindersToggle({ uid, pushTokens = [], compact = false }) {
  const [status, setStatus] = useState(null); // see getPushStatus
  const [localOn, setLocalOn] = useState(null); // overrides the saved state after a click
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [storedToken] = useState(readStoredToken);
  const turnOnRef = useRef(null);
  const turnOffRef = useRef(null);
  const blockedRef = useRef(null);
  const justToggled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getPushStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus("unsupported"); });
    return () => { cancelled = true; };
  }, []);

  const savedOn = status === "granted" && !!storedToken && pushTokens.includes(storedToken);
  const on = localOn ?? savedOn;

  // Keep this device's token current while reminders are on.
  useEffect(() => {
    if (uid && savedOn) refreshReminderToken(uid).catch((err) => console.warn("Couldn't refresh reminder token:", err));
  }, [uid, savedOn]);

  // After a click swaps the controls, put focus on whatever replaced them.
  useEffect(() => {
    if (!justToggled.current) return;
    justToggled.current = false;
    const target = status === "denied" ? blockedRef.current : on ? turnOffRef.current : turnOnRef.current;
    target?.focus();
  }, [on, status]);

  if (!uid || !status || status === "unconfigured" || status === "unsupported") return null;

  const box = compact ? "mt-3 text-sm" : "mt-5 border-t pt-4 text-left";
  const liveRegion = <p role="status" className="sr-only">{announcement}</p>;

  if (status === "ios-install") {
    return (
      <div className={box}>
        <p className="text-xs text-gray-600">
          🔔 To get reminders when applications open and close, add Course Finder to your Home Screen
          (Share → Add to Home Screen) and open it from there.
        </p>
      </div>
    );
  }

  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const permission = await enableReminders(uid);
      justToggled.current = true;
      if (permission === "granted") {
        setLocalOn(true);
        setAnnouncement("Reminders are on for this device.");
      } else {
        setStatus(permission);
        if (permission === "denied") setAnnouncement("Notifications are blocked for Course Finder.");
      }
    } catch (err) {
      console.error("Enabling reminders failed:", err);
      setError("Couldn't turn on reminders. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await disableReminders(uid);
      justToggled.current = true;
      setLocalOn(false);
      setAnnouncement("Reminders are off for this device.");
    } catch (err) {
      console.error("Disabling reminders failed:", err);
      setError("Couldn't turn off reminders. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (status === "denied") {
    body = (
      <p ref={blockedRef} tabIndex={-1} className="text-xs text-gray-600 focus:outline-none">
        🔔 Notifications are blocked for Course Finder. Allow them in your browser's site settings to get reminders
        when applications open and close.
      </p>
    );
  } else if (on) {
    body = (
      <p className="text-xs text-gray-600">
        🔔 Reminders are on for this device.{" "}
        <button
          ref={turnOffRef}
          onClick={turnOff}
          aria-disabled={busy}
          className="font-medium text-purple-700 hover:underline aria-disabled:opacity-50"
        >
          Turn off
        </button>
      </p>
    );
  } else {
    body = (
      <>
        <button
          ref={turnOnRef}
          onClick={turnOn}
          aria-disabled={busy}
          className="text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-4 py-2 rounded-xl transition aria-disabled:opacity-50"
        >
          {busy ? "Turning on…" : "🔔 Remind me when applications open or close"}
        </button>
        <p className="text-xs text-gray-600 mt-1.5">
          For the institutions on your shortlist and in your Apply For Me choices: when applications open, a week
          before they close, and the day before.
        </p>
      </>
    );
  }

  return (
    <div className={box}>
      {body}
      {liveRegion}
      {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
