// A learner's starred courses, saved on their user doc as `shortlist`. Each
// entry keeps the name and institution alongside the id, so the list still
// reads sensibly if a course is later edited or removed from the catalogue.

/** Adds the course if it isn't on the list yet, otherwise removes it. */
export function toggleShortlistEntry(shortlist, course) {
  if (shortlist.some((entry) => entry.id === course.id)) {
    return shortlist.filter((entry) => entry.id !== course.id);
  }
  // Only defined fields — Firestore rejects `undefined` values.
  const entry = { id: course.id, courseName: course.courseName, institution: course.institution };
  if (course.campus) entry.campus = course.campus;
  return [...shortlist, entry];
}
