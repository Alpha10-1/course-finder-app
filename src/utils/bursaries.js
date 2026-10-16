// Bursary directory: admins keep a list of bursaries in Firestore
// (`bursaries/{id}`), each tagged with the broad fields of study it funds
// (src/utils/studyFields.js). Learners see the ones that fund something they
// qualify for.

import { saToday } from "./saDate";
import { ANY_FIELD, STUDY_FIELDS, studyFieldLabel, studyFieldsForCourse, studyFieldsForCourses } from "./studyFields";

export { ANY_FIELD, STUDY_FIELDS, studyFieldLabel, studyFieldsForCourse, studyFieldsForCourses, saToday };

const FIELD_LABELS = Object.fromEntries(STUDY_FIELDS.map((f) => [f.key, f.label]));

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The bursaries worth showing a learner: still open (a close date of today
 * counts as open), and funding "any field" or a field they qualify for.
 * Soonest closing date first; bursaries without a date come last.
 * Each result gets `matchedFields` (excluding "any") for display.
 */
export function bursariesForLearner(bursaries, learnerFields, now = new Date()) {
  const today = saToday(now);
  return bursaries
    .filter((b) => !b.closeDate || !DATE_PATTERN.test(b.closeDate) || b.closeDate >= today)
    .map((b) => {
      const fields = Array.isArray(b.fields) ? b.fields : [];
      return { ...b, matchedFields: fields.filter((f) => f !== ANY_FIELD && learnerFields.has(f)), anyField: fields.includes(ANY_FIELD) };
    })
    .filter((b) => b.anyField || b.matchedFields.length > 0)
    .sort((a, b) => {
      if (a.closeDate && b.closeDate) return a.closeDate.localeCompare(b.closeDate);
      if (a.closeDate) return -1;
      if (b.closeDate) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
}

export const BLANK_BURSARY = {
  name: "",
  provider: "",
  fields: [],
  description: "",
  covers: "",
  closeDate: "",
  applyUrl: "",
  academicYear: "",
};

const MAX_LENGTHS = { name: 120, provider: 120, description: 600, covers: 200, applyUrl: 500, academicYear: 9 };

/**
 * Checks an admin's bursary form. Returns `{ errors, bursary }`: a list of
 * problems to show, and the cleaned-up document to save when there are none.
 */
export function validateBursary(form) {
  const errors = [];
  const text = (field) => String(form?.[field] ?? "").trim();
  const bursary = {
    name: text("name"),
    provider: text("provider"),
    fields: Array.from(new Set((form?.fields || []).filter((f) => FIELD_LABELS[f]))),
    description: text("description"),
    covers: text("covers"),
    closeDate: text("closeDate") || null,
    applyUrl: text("applyUrl"),
    academicYear: text("academicYear"),
  };

  if (!bursary.name) errors.push("Add the bursary's name.");
  if (!bursary.provider) errors.push("Add who offers it (the company, department or institution).");
  if (bursary.fields.length === 0) errors.push("Pick at least one field of study (or \"Any field of study\").");
  if (bursary.closeDate && !DATE_PATTERN.test(bursary.closeDate)) errors.push("The closing date must look like 2026-11-30.");
  if (!bursary.applyUrl) {
    errors.push("Add the link where learners apply or read the official details.");
  } else {
    try {
      const url = new URL(bursary.applyUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("bad protocol");
    } catch {
      errors.push("The link must be a full web address starting with https://");
    }
  }
  for (const [field, max] of Object.entries(MAX_LENGTHS)) {
    if (bursary[field].length > max) errors.push(`"${field}" is too long (${max} characters max).`);
  }
  return { errors, bursary };
}
