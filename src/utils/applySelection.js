// "Apply For Me" course selection, mirroring South Africa's university
// application process: round 1 picks one course at each of up to 6
// institutions; rounds 2 and 3 pick a 2nd and 3rd choice at those same
// institutions.
//
// selections: { [institution]: { 1: course, 2: course, 3: course } }

export const MAX_INSTITUTIONS = 6;

/**
 * Courses that can still be picked in a round — built from the full
 * qualified pool (not the search/filter-narrowed list), so a learner's own
 * filters never look like "no options left". Round 1: any course at an open
 * institution not chosen yet. Rounds 2/3: courses at already-chosen
 * institutions that haven't been used as an earlier choice there.
 *
 * @param {Array} pool - every course the learner qualifies for
 * @param {1|2|3} round
 * @param {object} selections
 * @param {(institution: string) => boolean} isOpen - application window check
 */
export function getPickableForRound(pool, round, selections, isOpen) {
  const chosen = Object.keys(selections);
  if (round === 1) {
    return pool.filter((c) => !chosen.includes(c.institution) && isOpen(c.institution));
  }
  return pool.filter((c) => {
    if (!chosen.includes(c.institution)) return false;
    const pickedIds = Object.values(selections[c.institution] || {}).map((s) => s.id);
    return !pickedIds.includes(c.id);
  });
}

/**
 * A round is complete once there's nothing more it can take: round 1 when
 * 6 institutions are chosen or no open institution is left; rounds 2/3 when
 * every chosen institution has a pick for that round or has nothing left to
 * offer (e.g. it only had one qualifying course, already used in round 1).
 */
export function isRoundComplete(pool, round, selections, isOpen) {
  const chosen = Object.keys(selections);
  if (round === 1) {
    return chosen.length === MAX_INSTITUTIONS || getPickableForRound(pool, 1, selections, isOpen).length === 0;
  }
  const pickable = getPickableForRound(pool, round, selections, isOpen);
  return chosen.every((inst) => selections[inst]?.[round] || !pickable.some((c) => c.institution === inst));
}

/** The round (1–3) a course has been picked in, or null. */
export function getCourseSelectionRound(selections, course) {
  for (const choices of Object.values(selections)) {
    for (const r of [1, 2, 3]) {
      if (choices?.[r]?.id === course.id) return r;
    }
  }
  return null;
}

// Derives per-institution + overall "Apply For Me" application progress from
// a user's saved course selections and the admin-maintained applicationProgress
// map (which institutions an admin has actually submitted the application for).
export function getApplicationProgress(user) {
  const institutions = Object.keys(user?.applySelections || {});
  if (institutions.length === 0) return { status: null, appliedCount: 0, total: 0 };
  const progress = user.applicationProgress || {};
  const appliedCount = institutions.filter((inst) => progress[inst]?.applied).length;
  const status = appliedCount === 0 ? "not_started" : appliedCount === institutions.length ? "complete" : "in_progress";
  return { status, appliedCount, total: institutions.length };
}
