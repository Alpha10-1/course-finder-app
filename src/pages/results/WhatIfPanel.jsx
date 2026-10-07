import { useMemo, useState } from "react";
import { calculateGeneralAPS } from "../../utils/marksToAPS";
import { compareQualification } from "../../utils/matching";

const INITIALLY_SHOWN = 8;

const clampMark = (value) => (value === "" ? "" : String(Math.max(0, Math.min(100, Math.round(Number(value))))));

// "What if my marks change?" — try different marks against the full catalogue
// without touching the learner's saved marks (or their limited mark edits).
export default function WhatIfPanel({ courses, subjects, grade, gradeStatus, onClose }) {
  const initial = useMemo(() => subjects.map((s) => (s.mark === null || s.mark === undefined ? "" : String(s.mark))), [subjects]);
  const [marks, setMarks] = useState(initial);
  const [showAllGained, setShowAllGained] = useState(false);

  const whatIf = useMemo(() => subjects.map((s, i) => ({ ...s, mark: marks[i] })), [subjects, marks]);
  const { count, gained, lost } = useMemo(
    () => compareQualification(courses, subjects, whatIf, { grade, gradeStatus }),
    [courses, subjects, whatIf, grade, gradeStatus]
  );
  const apsBefore = calculateGeneralAPS(subjects);
  const apsAfter = calculateGeneralAPS(whatIf);
  const changed = marks.some((m, i) => m !== initial[i]);

  const setMark = (index, value) => setMarks((prev) => prev.map((m, i) => (i === index ? clampMark(value) : m)));
  const raiseAll = (points) => setMarks((prev) => prev.map((m) => (m === "" ? m : clampMark(Number(m) + points))));

  const shownGained = showAllGained ? gained : gained.slice(0, INITIALLY_SHOWN);

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-indigo-900">🔮 What if my marks change?</p>
          <p className="text-xs text-indigo-700/80 mt-0.5">
            Try different marks to see which courses open up. Your saved marks stay as they are.
          </p>
        </div>
        <button onClick={onClose} className="text-indigo-400 hover:text-indigo-700 text-sm shrink-0" aria-label="Close what-if">
          ✕
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
        {subjects.map((s, i) => (
          <label key={`${i}-${s.subject}`} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-700 truncate">{s.subject}</span>
            <input
              type="number"
              min="0"
              max="100"
              inputMode="numeric"
              value={marks[i]}
              onChange={(e) => setMark(i, e.target.value)}
              aria-label={`What-if mark for ${s.subject}`}
              className={`w-16 text-right text-sm border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                marks[i] !== initial[i] ? "border-indigo-400 text-indigo-700 font-semibold" : "border-gray-200 text-gray-800"
              }`}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={() => raiseAll(5)} className="text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
          +5% on every subject
        </button>
        <button onClick={() => raiseAll(10)} className="text-xs bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
          +10% on every subject
        </button>
        {changed && (
          <button onClick={() => { setMarks(initial); setShowAllGained(false); }} className="text-xs text-gray-500 hover:text-gray-800 px-2">
            Reset
          </button>
        )}
      </div>

      <div className="mt-4 bg-white rounded-xl p-4">
        <p className="text-sm text-gray-700">
          With these marks you'd qualify for <span className="font-bold text-gray-900">{count}</span> course{count !== 1 ? "s" : ""}
          {gained.length > 0 && <span className="text-green-600 font-semibold"> (+{gained.length} new)</span>}
          {lost.length > 0 && <span className="text-red-500 font-semibold"> ({lost.length} fewer)</span>}
          .
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          APS (best 6): {apsBefore}
          {apsAfter !== apsBefore && <> → <span className="font-semibold text-gray-800">{apsAfter}</span></>}
        </p>

        {gained.length > 0 && (
          <ul className="mt-3 space-y-1">
            {shownGained.map((c) => (
              <li key={c.id} className="text-xs text-gray-700">
                <span className="text-green-600">＋</span> <span className="font-medium">{c.courseName}</span>
                <span className="text-gray-400"> · {c.institution}</span>
              </li>
            ))}
          </ul>
        )}
        {gained.length > shownGained.length && (
          <button onClick={() => setShowAllGained(true)} className="mt-2 text-xs text-purple-600 hover:underline">
            Show all {gained.length} new courses
          </button>
        )}
      </div>
    </div>
  );
}
