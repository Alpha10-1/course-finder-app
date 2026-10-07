import { useState } from "react";
import { calculateGeneralAPS } from "../../utils/marksToAPS";
import { NSC_SUBJECTS, DEFAULT_SUBJECT_ROWS } from "../../utils/nscSubjects";
import { getQualifiedCourses } from "./helpers";
import QualifiedCoursesPanel from "./QualifiedCoursesPanel";

// Walk-in eligibility check: no account, no grade-selection step — just
// subjects + marks in, qualifying courses out. College-course eligibility
// (which depends on highest grade/NQF completed) assumes a completed
// Matric, since that's the overwhelmingly common walk-in case; flagged
// in the UI so it's never a silent assumption.
export default function QuickCheckPanel({ courses }) {
  const [rows, setRows] = useState(DEFAULT_SUBJECT_ROWS);
  const [results, setResults] = useState(null); // null until first Check

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, { subject: "English Home Language", mark: "" }]);
  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));
  const resetAll = () => { setRows(DEFAULT_SUBJECT_ROWS); setResults(null); };

  const validSubjects = rows
    .filter((r) => r.subject && r.mark !== "" && Number.isFinite(Number(r.mark)))
    .map((r) => ({ subject: r.subject, mark: Number(r.mark) }));

  const handleCheck = () => {
    const quickUser = { subjects: validSubjects, grade: "Grade 12", gradeStatus: "completed" };
    const qualified = getQualifiedCourses(quickUser, courses);
    const aps = validSubjects.length > 0 ? calculateGeneralAPS(validSubjects) : 0;
    setResults({ qualified, aps });
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
        <p className="text-xs text-yellow-500 bg-yellow-900/20 border border-yellow-900/50 rounded-lg px-3 py-2">
          ⚠️ Assumes a completed Matric for college eligibility (there's no grade-selection step
          here). University matches are based purely on subjects/marks, same as always.
        </p>

        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="relative flex-1">
              <select value={row.subject} onChange={(e) => updateRow(index, "subject", e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500">
                {NSC_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <input type="number" value={row.mark} min="0" max="100" placeholder="Mark"
              onChange={(e) => updateRow(index, "mark", e.target.value)}
              className="w-24 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
            {rows.length > 1 && (
              <button type="button" onClick={() => removeRow(index)}
                className="text-red-500 hover:text-red-400 font-bold text-lg px-1">✕</button>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <button type="button" onClick={addRow}
            className="text-purple-400 hover:text-purple-300 text-sm font-medium">
            + Add subject
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={resetAll}
              className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg transition">
              Reset
            </button>
            <button type="button" onClick={handleCheck} disabled={validSubjects.length === 0}
              className="text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 text-white px-4 py-1.5 rounded-lg font-semibold transition">
              Check Courses
            </button>
          </div>
        </div>
      </div>

      {results && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
          <p className="text-center text-purple-400 font-bold text-xl">
            APS: {results.aps}
            <span className="block text-gray-500 text-xs font-normal mt-0.5">
              General APS (best 6 subjects, LO excluded) — actual per-institution APS may differ
            </span>
          </p>
          <QualifiedCoursesPanel courses={results.qualified} defaultOpen />
        </div>
      )}
    </div>
  );
}
