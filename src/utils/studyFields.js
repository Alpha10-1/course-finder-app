// Broad fields of study for courses. Course faculties are free text (100+
// different spellings across institutions), so courses are mapped to a small
// fixed set of fields by keyword: first from the course name, falling back to
// the faculty name. Used by the bursary directory (which fields a bursary
// funds) and the subject-choice advisor (what a subject combination rules out).

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
  engineering: /engineer|\bb\.?\s?eng(tech)?\b|\bsc\.?\s?eng\b|built environment|architect|construction|quantity survey|mechatronic|mining|metallurg|trades|apprentice|boilermak|fitter|welding|electrician|millwright|plumb|\bmotor mechanic/,
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
