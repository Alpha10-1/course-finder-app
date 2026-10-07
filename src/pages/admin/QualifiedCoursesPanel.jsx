import { useState } from "react";

// Shows every course a learner currently qualifies for (computed live from
// their saved subjects/grade against the full catalog), grouped by
// institution, with a small search box since some learners qualify for
// dozens of courses.
export default function QualifiedCoursesPanel({ courses, defaultOpen = false }) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(!defaultOpen);

  const filtered = courses.filter((c) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return c.courseName?.toLowerCase().includes(term) || c.institution?.toLowerCase().includes(term);
  });

  const byInstitution = filtered.reduce((acc, c) => {
    (acc[c.institution] ||= []).push(c);
    return acc;
  }, {});
  const institutions = Object.keys(byInstitution).sort();
  const uniCount = courses.filter((c) => c.institutionType !== "college").length;
  const collegeCount = courses.filter((c) => c.institutionType === "college").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => setCollapsed((v) => !v)}>
        <p className="text-xs text-gray-400 font-medium">
          Qualified Courses <span className="text-white font-semibold">({courses.length})</span>
          <span className="text-gray-600 ml-1">— {uniCount} uni · {collegeCount} college</span>
        </p>
        <span className="text-gray-600 text-xs">{collapsed ? "▼" : "▲"}</span>
      </div>

      {!collapsed && (
        courses.length === 0 ? (
          <p className="text-gray-500 text-xs bg-gray-800 rounded-xl p-3">
            No qualifying courses found for this learner's current subjects/grade.
          </p>
        ) : (
          <div className="space-y-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search qualified courses…"
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-600"
            />
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {institutions.map((inst) => (
                <div key={inst} className="bg-gray-800 rounded-xl p-3">
                  <p className="text-white text-xs font-semibold mb-1">{inst}</p>
                  <div className="space-y-0.5">
                    {byInstitution[inst].map((c) => (
                      <p key={c.id} className="text-gray-400 text-xs">
                        {c.courseName}
                        <span className="text-gray-600"> · {c.qualificationType}{c.faculty ? ` · ${c.faculty}` : ""}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
