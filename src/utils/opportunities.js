// Learnerships, internships, apprenticeships and entry-level jobs.
//
// Admins add verified listings to Firestore (`opportunities/{id}`) with their
// requirements as structured fields. Learners keep a short work profile on
// their user doc (`workProfile`). A listing is shown only when the profile
// meets every requirement — anything the profile doesn't answer yet counts
// as "not shown", never as a pass.
import { meetsKeySubjects } from "./subjectMatch";
import { saToday } from "./saDate";

export const OPPORTUNITY_TYPES = [
  { key: "learnership", label: "Learnership" },
  { key: "internship", label: "Internship" },
  { key: "apprenticeship", label: "Apprenticeship" },
  { key: "job", label: "Entry-level job" },
];

export const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];

// Highest qualification completed, lowest first.
export const EDUCATION_LEVELS = [
  { key: "grade9", label: "Grade 9" },
  { key: "grade10", label: "Grade 10" },
  { key: "grade11", label: "Grade 11" },
  { key: "matric", label: "Matric (Grade 12)" },
  { key: "higher_certificate", label: "Higher certificate" },
  { key: "diploma", label: "Diploma" },
  { key: "degree", label: "Degree" },
];
const EDUCATION_RANK = Object.fromEntries(EDUCATION_LEVELS.map((e, i) => [e.key, i]));
export const educationLabel = (key) => EDUCATION_LEVELS.find((e) => e.key === key)?.label || key;
export const typeLabel = (key) => OPPORTUNITY_TYPES.find((t) => t.key === key)?.label || key;

export const BLANK_OPPORTUNITY = {
  title: "",
  organisation: "",
  type: "learnership",
  applyUrl: "",
  closeDate: "",
  stipend: "",
  description: "",
  source: "",
  minEducation: "",
  requiredSubjects: [],
  ageMin: "",
  ageMax: "",
  provinces: [],
  saCitizenOnly: false,
  driversLicence: false,
  unemployedOnly: false,
  disabilityOnly: false,
  otherRequirements: "",
  published: false,
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isWebUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

/** Checks an admin's form; returns { errors, opportunity } with the cleaned record. */
export function validateOpportunity(form) {
  const text = (k) => String(form?.[k] ?? "").trim();
  const num = (k) => (text(k) === "" ? null : Number(text(k)));
  const opportunity = {
    title: text("title"),
    organisation: text("organisation"),
    type: OPPORTUNITY_TYPES.some((t) => t.key === form?.type) ? form.type : "learnership",
    applyUrl: text("applyUrl"),
    closeDate: text("closeDate") || null,
    stipend: text("stipend"),
    description: text("description"),
    source: text("source"),
    minEducation: EDUCATION_RANK[form?.minEducation] !== undefined ? form.minEducation : "",
    requiredSubjects: (form?.requiredSubjects || [])
      .filter((r) => String(r?.subject || "").trim())
      .map((r) => ({ subject: String(r.subject).trim(), minMark: Number(r.minMark) || 0 })),
    ageMin: num("ageMin"),
    ageMax: num("ageMax"),
    provinces: (form?.provinces || []).filter((p) => PROVINCES.includes(p)),
    saCitizenOnly: form?.saCitizenOnly === true,
    driversLicence: form?.driversLicence === true,
    unemployedOnly: form?.unemployedOnly === true,
    disabilityOnly: form?.disabilityOnly === true,
    otherRequirements: text("otherRequirements"),
    published: form?.published === true,
  };
  const errors = [];
  if (!opportunity.title) errors.push("Add the title.");
  if (!opportunity.organisation) errors.push("Add the organisation offering it.");
  if (!isWebUrl(opportunity.applyUrl)) errors.push("Add the official application link, starting with https://");
  if (!opportunity.source) errors.push("Say where you verified it (e.g. the company's careers page or the SETA).");
  if (opportunity.closeDate && !DATE.test(opportunity.closeDate)) errors.push("The closing date must look like 2026-11-30.");
  for (const k of ["ageMin", "ageMax"]) {
    const v = opportunity[k];
    if (v !== null && (!Number.isInteger(v) || v < 14 || v > 70)) errors.push("Ages must be whole numbers between 14 and 70.");
  }
  if (opportunity.ageMin !== null && opportunity.ageMax !== null && opportunity.ageMin > opportunity.ageMax) {
    errors.push("The minimum age is above the maximum age.");
  }
  if (opportunity.requiredSubjects.some((r) => r.minMark < 0 || r.minMark > 100)) errors.push("Subject marks must be 0–100.");
  if (opportunity.requiredSubjects.length
    && (!opportunity.minEducation || EDUCATION_RANK[opportunity.minEducation] < EDUCATION_RANK.matric)) {
    errors.push("Matric subject requirements need the minimum education set to Matric or higher.");
  }
  return { errors: [...new Set(errors)], opportunity };
}

// An age limit, or null when there isn't one ("" from a blank form counts as none).
const asAge = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Whole years between a "YYYY-MM-DD" birth date and today (South African time). */
export function ageOn(dateOfBirth, today) {
  if (!DATE.test(dateOfBirth || "")) return null;
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/**
 * Checks one listing against a learner. Every requirement ends up met,
 * missing (the learner doesn't meet it) or unknown (the profile doesn't say).
 * Only `qualifies` listings are shown to learners.
 *
 * @param {object} opp listing
 * @param {object} profile workProfile from the user doc
 * @param {Array<{subject: string, mark: number}>} subjects learner's saved marks
 */
export function matchOpportunity(opp, profile = {}, subjects = [], now = new Date()) {
  const today = saToday(now);
  const met = [];
  const missing = [];
  const unknown = [];

  if (opp.minEducation) {
    const need = educationLabel(opp.minEducation);
    if (!profile.education) unknown.push("your highest qualification");
    else if (EDUCATION_RANK[profile.education] >= EDUCATION_RANK[opp.minEducation]) met.push(`${need} or higher`);
    else missing.push(`${need} or higher`);
  }

  if (opp.requiredSubjects?.length) {
    if (!subjects.length) unknown.push("your matric marks (enter them on the marks page)");
    for (const req of opp.requiredSubjects) {
      if (!subjects.length) continue;
      const label = `${req.subject} ${req.minMark}%+`;
      (meetsKeySubjects(subjects, [req]) ? met : missing).push(label);
    }
  }

  const ageMin = asAge(opp.ageMin);
  const ageMax = asAge(opp.ageMax);
  if (ageMin !== null || ageMax !== null) {
    const age = ageOn(profile.dateOfBirth, today);
    const range = ageMin !== null && ageMax !== null ? `Aged ${ageMin}–${ageMax}`
      : ageMin !== null ? `Aged ${ageMin} or older` : `Aged ${ageMax} or younger`;
    if (age === null) unknown.push("your date of birth");
    else if ((ageMin === null || age >= ageMin) && (ageMax === null || age <= ageMax)) met.push(range);
    else missing.push(range);
  }

  if (opp.provinces?.length) {
    const where = `Lives in ${opp.provinces.join(" or ")}`;
    if (!profile.province) unknown.push("your province");
    else (opp.provinces.includes(profile.province) ? met : missing).push(where);
  }

  const yesNo = (flag, field, label, question) => {
    if (!flag) return;
    if (typeof profile[field] !== "boolean") unknown.push(question);
    else (profile[field] ? met : missing).push(label);
  };
  yesNo(opp.saCitizenOnly, "saCitizen", "South African citizen", "whether you're a South African citizen");
  yesNo(opp.driversLicence, "hasDriversLicence", "Driver's licence", "whether you have a driver's licence");
  yesNo(opp.unemployedOnly, "unemployed", "Currently unemployed", "whether you're currently working");
  yesNo(opp.disabilityOnly, "disability", "For people with a disability", "whether you live with a disability");

  const closed = !!(opp.closeDate && DATE.test(opp.closeDate) && opp.closeDate < today);
  return { qualifies: !closed && missing.length === 0 && unknown.length === 0, closed, met, missing, unknown };
}

/**
 * Splits published, open listings for a learner: the ones they qualify for
 * (soonest closing first), how many they don't, and the profile questions
 * that would let more listings be checked.
 */
export function opportunitiesForLearner(listings, profile, subjects, now = new Date()) {
  const qualifying = [];
  let notQualifying = 0;
  const questions = new Map();
  for (const opp of listings) {
    if (opp.published !== true || !isWebUrl(opp.applyUrl)) continue;
    const result = matchOpportunity(opp, profile, subjects, now);
    if (result.closed) continue;
    if (result.qualifies) qualifying.push({ ...opp, met: result.met });
    else if (result.missing.length) notQualifying += 1;
    else for (const q of result.unknown) questions.set(q, (questions.get(q) || 0) + 1);
  }
  qualifying.sort((a, b) => (a.closeDate || "9999").localeCompare(b.closeDate || "9999") || a.title.localeCompare(b.title));
  const unanswered = [...questions].sort((a, b) => b[1] - a[1]).map(([question, count]) => ({ question, count }));
  return { qualifying, notQualifying, unanswered };
}

/** Cleans a learner's profile form before saving (no undefined values for Firestore). */
export function cleanWorkProfile(form) {
  const out = {};
  if (EDUCATION_RANK[form?.education] !== undefined) out.education = form.education;
  if (PROVINCES.includes(form?.province)) out.province = form.province;
  if (DATE.test(form?.dateOfBirth || "")) out.dateOfBirth = form.dateOfBirth;
  for (const k of ["saCitizen", "hasDriversLicence", "unemployed", "disability"]) {
    if (typeof form?.[k] === "boolean") out[k] = form[k];
  }
  return out;
}
