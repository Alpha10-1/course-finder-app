// Admission information some courses carry beyond APS and subject minimums
// (wait-list rules, selection processes, deadlines). Shared by the learner's
// course card and the public course page so both show the same notes.

const SELECTION_PROCESS_TEXT =
  "This course has a selection process (for example an interview, test or portfolio). " +
  "Meeting the minimum requirements doesn't guarantee a place.";

/**
 * Deadlines in the data are free text ("31 July", "31 July 2025"). One with a
 * year that has already passed is from an earlier application cycle, so it's
 * flagged rather than shown as if it were current.
 */
export function describeDeadline(deadline, now = new Date()) {
  const year = Number(String(deadline).match(/\b(20\d{2})\b/)?.[1]);
  if (year && year < now.getFullYear()) {
    return `Last published deadline: ${deadline} (an earlier year) — check the institution's website for this year's date.`;
  }
  return `Applications close ${deadline}.`;
}

/**
 * @returns {Array<{kind: "requirement"|"additional"|"selection"|"deadline", text: string}>}
 */
export function getAdmissionNotes(course, now = new Date()) {
  const notes = [];
  if (course?.admissionRequirement) notes.push({ kind: "requirement", text: course.admissionRequirement });
  if (course?.additionalRequirements) notes.push({ kind: "additional", text: course.additionalRequirements });
  if (course?.selectionProcess) notes.push({ kind: "selection", text: SELECTION_PROCESS_TEXT });
  if (course?.applicationDeadline) notes.push({ kind: "deadline", text: describeDeadline(course.applicationDeadline, now) });
  return notes;
}

export const NOTE_ICONS = { requirement: "📋", additional: "ℹ️", selection: "📝", deadline: "📅" };

/** "Mathematics 50%+" or, for any-of groups, "Mathematics 50%+ or Mathematical Literacy 60%+". */
export function describeKeySubject(req) {
  if (req.subjectGroup) return req.subjectGroup.map((o) => `${o.subject} ${o.minMark}%+`).join(" or ");
  return `${req.subject} ${req.minMark}%+`;
}
