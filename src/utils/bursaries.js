// Bursary directory: admins keep a list of bursaries in Firestore
// (`bursaries/{id}`), each tagged with the broad fields of study it funds.
// Learners see the ones that fund something they qualify for.
//
// Course faculties are free text (100+ different spellings across
// institutions), so courses are mapped to a small fixed set of study fields
// by keyword: first from the course name, falling back to the faculty name.

import { saToday } from "./saDate";

export const ANY_FIELD = "any";

export const STUDY_FIELDS = [
  { key: ANY_FIELD, label: "Any field of study" },
  { key: "engineering", label: "Engineering, built environment & trades" },
  { key: "science", label: "Natural sciences & mathematics" },
  { key: "it", label: "IT & computer science" },
  { key: "health", label: "Health sciences" },
  { key: "commerce", label: "Commerce, accounting & management" },
  { key: "law", label: "Law" },
  { key: "education", label: "Education & teaching" },
  { key: "agriculture", label: "Agriculture & environment" },
  { key: "humanities", label: "Humanities, arts & social sciences" },
];

const FIELD_LABELS = Object.fromEntries(STUDY_FIELDS.map((f) => [f.key, f.label]));
export const studyFieldLabel = (key) => FIELD_LABELS[key] || key;

// "Sciences" phrases that aren't natural science — stripped before testing
// for science so "Faculty of Health Sciences" or "Bachelor of Social Science"
// doesn't count as science.
const NOT_NATURAL_SCIENCE = /\b(social|political|consumer|sports?|management|economic|financial|health|human|military|library|information|education|security|computer|veterinary|dental|medical|nursing|pharmaceutical|clinical|wellness|community|actuarial)\s+sciences?\b/g;

const FIELD_PATTERNS = {
  engineering: /engineer|built environment|architect|construction|quantity survey|mechatronic|mining|metallurg|trades|apprentice|boilermak|fitter|welding|electrician|millwright|plumb|\bmotor mechanic/,
  science: /\bb\.?sc\b|\bscience\b|natural|applied (and computer )?sciences|mathemat|physic|chemi|biolog|statistic|geolog|biotech|zoolog|botan|microbio|actuarial/,
  it: /informat|computer|computing|\bict\b|software|data science|\bit\b/,
  health: /health|medic|nursing|pharma|dentist|dental|veterinar|physio|radiograph|wellness|clinical|optometr|occupational therap|dietetic|nutrition|biokinetic|audiolog|speech|mbchb|emergency care|oral hygiene/,
  commerce: /commerce|account|economic|management|business|financ|marketing|administration|office|hospitality|tourism|\bbcom\b|auditing|banking|insurance|human resource|logistics|supply chain|retail|entrepreneur/,
  law: /\blaw\b|\bllb\b|legal|policing|criminolog|security sciences|paralegal/,
  education: /educat|teach|\bb\.?ed\b|foundation phase|early childhood|\becd\b|educare/,
  agriculture: /agri|agro|farm|animal|crop|soil|forestry|horticult|environmental|conservation|wildlife|game ranch|nature|food science|viticult|oenolog/,
  humanities: /humanit|social science|social work|\barts?\b|design|language|theolog|religio|music|drama|performing|journalism|media|psycholog|human sciences|communication|fashion|film|fine art|histor|philosoph|anthropolog|sociolog|politic/,
};

function fieldsIn(text) {
  const lower = (text || "").toLowerCase();
  const scienceText = lower.replace(NOT_NATURAL_SCIENCE, " ");
  const found = [];
  for (const [key, pattern] of Object.entries(FIELD_PATTERNS)) {
    if (pattern.test(key === "science" ? scienceText : lower)) found.push(key);
  }
  return found;
}

/** The study fields (keys of STUDY_FIELDS, never "any") a course belongs to. */
export function studyFieldsForCourse(course) {
  const fromName = fieldsIn(course?.courseName);
  return fromName.length ? fromName : fieldsIn(course?.faculty);
}

/** Every study field covered by a list of courses, as a Set. */
export function studyFieldsForCourses(courses) {
  const fields = new Set();
  for (const course of courses) {
    for (const field of studyFieldsForCourse(course)) fields.add(field);
  }
  return fields;
}

export { saToday };

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
