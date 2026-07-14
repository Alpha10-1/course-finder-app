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

// ─────────────────────────────────────────────────────────────────────────
// Faculty-level application windows.
//
// A faculty can optionally have its OWN open/close dates, stored in
// Firestore at facultySettings/{institution}|||{faculty}. If a faculty has
// no dates configured, it simply inherits the institution's window — so
// admins only need to set a faculty date when that faculty genuinely closes
// on a different schedule from the rest of the institution.
// ─────────────────────────────────────────────────────────────────────────

export function facultySettingsKey(institution, faculty) {
  return `${institution}|||${faculty}`;
}

/** Fetch every faculty's settings as a { "institution|||faculty": settings } map. */
export async function fetchFacultySettingsMap() {
  const snap = await getDocs(collection(db, "facultySettings"));
  const map = {};
  snap.docs.forEach((d) => { map[d.id] = d.data(); });
  return map;
}

export async function saveFacultySettings(institution, faculty, { openDate, closeDate }, updatedBy) {
  await setDoc(
    doc(db, "facultySettings", facultySettingsKey(institution, faculty)),
    {
      institution,
      faculty,
      openDate: openDate || null,
      closeDate: closeDate || null,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || "unknown",
    },
    { merge: true }
  );
}

/** Convenience: fetch institution + faculty settings maps together. */
export async function fetchApplicationWindowSettings() {
  const [institutionSettings, facultySettings] = await Promise.all([
    fetchInstitutionSettingsMap(),
    fetchFacultySettingsMap(),
  ]);
  return { institutionSettings, facultySettings };
}

/**
 * The dates that actually govern a course: its faculty's own dates if any
 * are set, otherwise its institution's dates.
 */
export function getEffectiveDatesForCourse(course, institutionSettings = {}, facultySettings = {}) {
  const facultySetting = course?.faculty
    ? facultySettings[facultySettingsKey(course.institution, course.faculty)]
    : null;
  if (facultySetting && (facultySetting.openDate || facultySetting.closeDate)) {
    return facultySetting;
  }
  return institutionSettings[course?.institution];
}

/**
 * "open" | "closed" for a specific course, honoring a faculty-level override
 * of its institution's window. Same 2-state contract as
 * getInstitutionApplicationStatus, so anywhere doing strict gating (e.g.
 * Results.jsx locking closed institutions) can move to this without a
 * behavior change when no faculty override exists.
 */
export function getCourseApplicationStatus(course, institutionSettings = {}, facultySettings = {}, now = new Date()) {
  return getInstitutionApplicationStatus(getEffectiveDatesForCourse(course, institutionSettings, facultySettings), now);
}

const CLOSING_SOON_WINDOW_DAYS = 14;

/**
 * "open" | "closing-soon" | "closed" — a richer, DISPLAY-ONLY status for
 * badges. "closing-soon" is not a real gating state (a closing-soon course
 * is still open), it just tells the user to hurry. Anything that needs to
 * gate behavior (allow/deny applying) should keep using
 * getCourseApplicationStatus / getInstitutionApplicationStatus instead.
 */
export function getCourseDisplayStatus(course, institutionSettings = {}, facultySettings = {}, now = new Date(), closingSoonDays = CLOSING_SOON_WINDOW_DAYS) {
  const settings = getEffectiveDatesForCourse(course, institutionSettings, facultySettings);
  const status = getInstitutionApplicationStatus(settings, now);
  if (status === "closed") return "closed";

  if (settings?.closeDate) {
    const closesAt = new Date(settings.closeDate);
    if (!Number.isNaN(closesAt.getTime())) {
      closesAt.setHours(23, 59, 59, 999);
      const msRemaining = closesAt.getTime() - now.getTime();
      const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
      if (daysRemaining >= 0 && daysRemaining <= closingSoonDays) return "closing-soon";
    }
  }
  return "open";
}