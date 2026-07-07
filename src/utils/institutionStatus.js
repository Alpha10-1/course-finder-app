// Shared logic for per-institution "application window" (open/closed) status.
// Used by both the Admin page (to set dates and show status) and the Results
// page (to lock closed institutions during selection and let users filter to
// open institutions only).
//
// Settings are stored in Firestore at institutionSettings/{institutionName}:
//   { openDate: "YYYY-MM-DD" | null, closeDate: "YYYY-MM-DD" | null }
//
// Design choice: an institution with NO dates configured is treated as OPEN
// by default. This means adding this feature doesn't silently lock out every
// existing institution the moment it ships — admins opt individual
// institutions into a window by setting dates for them.

import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/**
 * @param {{openDate?: string|null, closeDate?: string|null}|undefined} settings
 * @param {Date} [now]
 * @returns {"open"|"closed"}
 */
export function getInstitutionApplicationStatus(settings, now = new Date()) {
  if (!settings) return "open";
  const { openDate, closeDate } = settings;
  if (!openDate && !closeDate) return "open";

  if (openDate) {
    const opensAt = new Date(openDate);
    if (!Number.isNaN(opensAt.getTime()) && now < opensAt) return "closed";
  }
  if (closeDate) {
    const closesAt = new Date(closeDate);
    if (!Number.isNaN(closesAt.getTime())) {
      // Treat the close date as inclusive — closed at the END of that day.
      closesAt.setHours(23, 59, 59, 999);
      if (now > closesAt) return "closed";
    }
  }
  return "open";
}

export function isInstitutionOpen(settings, now = new Date()) {
  return getInstitutionApplicationStatus(settings, now) === "open";
}

/** Fetch every institution's settings as a { [institutionName]: settings } map. */
export async function fetchInstitutionSettingsMap() {
  const snap = await getDocs(collection(db, "institutionSettings"));
  const map = {};
  snap.docs.forEach((d) => { map[d.id] = d.data(); });
  return map;
}

export async function saveInstitutionSettings(institution, { openDate, closeDate }, updatedBy) {
  await setDoc(
    doc(db, "institutionSettings", institution),
    {
      openDate: openDate || null,
      closeDate: closeDate || null,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || "unknown",
    },
    { merge: true }
  );
}