import { useMemo, useState } from "react";
import { findCoursesWithinReach, WITHIN_REACH_MAX_RAISE } from "../../utils/matching";

const INITIALLY_SHOWN = 10;

function describeGap(gap) {
  if (gap.type === "aps") return `APS ${gap.have} — need ${gap.need}`;
  return gap.have !== null ? `${gap.label} — you have ${gap.have}%` : gap.label;
}

// Courses the learner almost qualifies for: they'd get in with marks up to
// WITHIN_REACH_MAX_RAISE% higher. Most useful for Grade 11 and June-results
// learners who can still improve.
export default function WithinReach({ courses, subjects, grade, gradeStatus }) {
  const [showAll, setShowAll] = useState(false);
  const results = useMemo(
    () => findCoursesWithinReach(courses, subjects, { grade, gradeStatus }),
    [courses, subjects, grade, gradeStatus]
  );

  if (results.length === 0) return null;
  const shown = showAll ? results : results.slice(0, INITIALLY_SHOWN);

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-amber-700">Within reach ({results.length})</h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        You don't qualify for these yet, but you would with marks up to {WITHIN_REACH_MAX_RAISE}% higher.
        The badge shows roughly how much higher; the red tags show exactly what's missing.
      </p>
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
        {shown.map(({ course, raiseNeeded, gaps }) => (
          <div key={course.id} className="px-3 py-2 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{course.courseName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {course.institution}{course.campus && ` — ${course.campus}`}
                </p>
              </div>
              <span className="shrink-0 bg-amber-100 text-amber-700 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                +{raiseNeeded}% needed
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {gaps.map((gap, i) => (
                <span key={i} className="bg-red-50 text-red-600 text-[11px] px-2 py-0.5 rounded-full">
                  {describeGap(gap)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {results.length > shown.length && (
        <button onClick={() => setShowAll(true)} className="mt-3 text-sm text-purple-600 hover:underline">
          Show all {results.length}
        </button>
      )}
    </section>
  );
}
