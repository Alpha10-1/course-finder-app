// ─── College course JSON expansion ─────────────────────────────────────────
//
// A source entry in college-courses.json has ONE `institution` — the college
// itself (e.g. "Ekurhuleni East TVET College"). If that college offers the
// course at multiple sites, list them in `campuses` — the entry is cloned
// once per campus, keeping the shared `institution` and adding that campus's
// name plus optionally excluding vocational subjects not offered there.
// A course offered at a single site just omits `campuses` entirely.
// Shared by the admin panel's seed button, verify-college-matching.mjs and
// the tests, so every caller expands campuses identically.
export function expandCollegeCourse(entry) {
  const { campuses, curriculum, _comment, ...base } = entry;

  if (!campuses || campuses.length === 0) {
    return [{ institutionType: "college", keySubjects: [], faculty: "", ...base, curriculum: curriculum || null }];
  }

  return campuses.map((campusObj) => {
    const exclude = new Set((campusObj.excludeVocational || []).map((s) => s.trim().toLowerCase()));
    const vocationalSubjects = (curriculum?.vocationalSubjects || []).filter(
      (v) => !exclude.has((v.subject || "").trim().toLowerCase())
    );
    return {
      institutionType: "college",
      keySubjects: [],
      faculty: "",
      ...base,                     // institution (the college) comes from here
      campus: campusObj.campus,    // the specific site
      curriculum: curriculum ? { ...curriculum, vocationalSubjects } : null,
    };
  });
}
