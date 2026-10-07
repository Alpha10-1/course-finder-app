import { getCourseDisplayStatus } from "../../utils/institutionStatus";
import { InstitutionStatusBadge } from "./ui";

// Cross-institution course search/filter, built around APS: narrow by min/max
// APS (plus faculty/institution/qualification type/name as a bonus), sort by
// APS ascending or descending, and edit/delete straight from the results —
// same course data (`filteredCourses`) the bulk-delete panel already uses,
// just presented as a browsable, sortable table instead of a checkbox list.
export default function ApsSearchPanel({
  courses, allCourses, institutionSettings, facultySettings,
  courseSearch, setCourseSearch,
  filterFaculty, setFilterFaculty,
  filterInstitution, setFilterInstitution,
  filterQualType, setFilterQualType,
  filterMinAPS, setFilterMinAPS,
  filterMaxAPS, setFilterMaxAPS,
  apsSortDir, setApsSortDir,
  setEditingCourse, setConfirmDeleteCourse,
}) {
  const faculties = [...new Set(allCourses.map((c) => c.faculty).filter(Boolean))].sort();
  const institutions = [...new Set(allCourses.map((c) => c.institution).filter(Boolean))].sort();
  const qualTypes = [...new Set(allCourses.map((c) => c.qualificationType).filter(Boolean))].sort();

  const sorted = [...courses].sort((a, b) => {
    const av = Number(a.minAPS) || 0;
    const bv = Number(b.minAPS) || 0;
    return apsSortDir === "asc" ? av - bv : bv - av;
  });

  const anyFilterActive = courseSearch || filterFaculty || filterInstitution || filterQualType || filterMinAPS || filterMaxAPS;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
        Search every course across every institution by APS range (and optionally faculty,
        institution, qualification type or name). Useful for things like "which courses can a
        student with APS 28 actually get into?"
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}
          placeholder="Search by course/institution name…"
          className="lg:col-span-2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
        <select value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Faculties</option>
          {faculties.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filterInstitution} onChange={(e) => setFilterInstitution(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Institutions</option>
          {institutions.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filterQualType} onChange={(e) => setFilterQualType(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Qualification Types</option>
          {qualTypes.map((q) => <option key={q} value={q}>{q}</option>)}
        </select>
        <div className="flex gap-2">
          <input type="number" placeholder="Min APS ≥" value={filterMinAPS}
            onChange={(e) => setFilterMinAPS(e.target.value)}
            className="w-1/2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <input type="number" placeholder="Max APS ≤" value={filterMaxAPS}
            onChange={(e) => setFilterMaxAPS(e.target.value)}
            className="w-1/2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-400">
          <span className="font-bold text-purple-400">{courses.length}</span> of {allCourses.length} courses match
        </p>
        <div className="flex gap-2">
          {anyFilterActive && (
            <button
              onClick={() => {
                setCourseSearch("");
                setFilterFaculty("");
                setFilterInstitution("");
                setFilterQualType("");
                setFilterMinAPS("");
                setFilterMaxAPS("");
              }}
              className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg transition">
              Clear filters
            </button>
          )}
          <button
            onClick={() => setApsSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition">
            Sort APS: {apsSortDir === "asc" ? "Low → High ↑" : "High → Low ↓"}
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No courses match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Course</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Institution</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Type</th>
                <th className="text-left px-4 py-3">APS</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sorted.map((course) => (
                <tr key={course.id} className="bg-gray-950 hover:bg-gray-900 transition">
                  <td className="px-4 py-3 font-medium text-white max-w-xs">
                    <p className="truncate">{course.courseName}</p>
                    <p className="text-xs text-gray-500 truncate">{course.faculty}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-300 max-w-[16rem] truncate">{course.institution}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{course.qualificationType}</span>
                  </td>
                  <td className="px-4 py-3 text-purple-400 font-semibold">{course.minAPS}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <InstitutionStatusBadge status={getCourseDisplayStatus(course, institutionSettings, facultySettings)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingCourse({ ...course })}
                        className="text-xs bg-purple-900 hover:bg-purple-800 text-purple-300 px-3 py-1 rounded-lg transition">
                        Edit
                      </button>
                      <button onClick={() => setConfirmDeleteCourse(course)}
                        className="text-xs bg-red-900 hover:bg-red-800 text-red-300 px-3 py-1 rounded-lg transition">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
