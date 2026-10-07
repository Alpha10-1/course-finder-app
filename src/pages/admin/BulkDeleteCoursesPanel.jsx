import { getCourseDisplayStatus } from "../../utils/institutionStatus";
import { InstitutionStatusBadge } from "./ui";

// Faculty/qualification-type/min-APS filter panel + checkbox list used to
// select a batch of courses (across every institution) for bulk deletion.
export default function BulkDeleteCoursesPanel({
  courses, allCourses, institutionSettings, facultySettings,
  filterFaculty, setFilterFaculty,
  filterInstitution, setFilterInstitution,
  filterQualType, setFilterQualType,
  filterMinAPS, setFilterMinAPS,
  filterMaxAPS, setFilterMaxAPS,
  bulkSelectedIds, toggleBulkSelected, selectAllBulkMatches, clearBulkSelection,
  onDeleteClick,
}) {
  const faculties = [...new Set(allCourses.map((c) => c.faculty).filter(Boolean))].sort();
  const institutions = [...new Set(allCourses.map((c) => c.institution).filter(Boolean))].sort();
  const qualTypes = [...new Set(allCourses.map((c) => c.qualificationType).filter(Boolean))].sort();

  const allMatchesSelected = courses.length > 0 && courses.every((c) => bulkSelectedIds.has(c.id));

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
        Narrow down with the filters below, then use "Select all matching" (or tick individual
        rows) and delete them all at once. This deletes from Firestore immediately and tombstones
        each one so re-seeding from courses.json won't bring them back.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
        <button
          onClick={() => {
            setFilterFaculty("");
            setFilterInstitution("");
            setFilterQualType("");
            setFilterMinAPS("");
            setFilterMaxAPS("");
          }}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition">
          Reset Filters
        </button>
        <p className="text-sm text-gray-400">
          <span className="font-bold text-white">{courses.length}</span> course{courses.length !== 1 ? "s" : ""} match ·{" "}
          <span className="font-bold text-purple-400">{bulkSelectedIds.size}</span> selected
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => allMatchesSelected ? clearBulkSelection() : selectAllBulkMatches(courses)}
          className="text-xs bg-purple-900 hover:bg-purple-800 text-purple-300 px-3 py-1.5 rounded-lg transition font-medium">
          {allMatchesSelected ? "Deselect All Matching" : `Select All Matching (${courses.length})`}
        </button>
        {bulkSelectedIds.size > 0 && (
          <button onClick={onDeleteClick}
            className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition font-medium">
            🗑️ Delete Selected ({bulkSelectedIds.size})
          </button>
        )}
      </div>

      {courses.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No courses match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-800 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="text-left px-4 py-3">Course</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Institution</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Type</th>
                <th className="text-left px-4 py-3">APS</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {courses.map((course) => {
                const selected = bulkSelectedIds.has(course.id);
                const status = getCourseDisplayStatus(course, institutionSettings, facultySettings);
                return (
                  <tr key={course.id}
                    onClick={() => toggleBulkSelected(course.id)}
                    className={`cursor-pointer transition ${selected ? "bg-red-950/40" : "bg-gray-950 hover:bg-gray-900"}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected} onChange={() => toggleBulkSelected(course.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-red-600" />
                    </td>
                    <td className="px-4 py-3 font-medium text-white max-w-xs">
                      <p className="truncate">{course.courseName}</p>
                      <p className="text-xs text-gray-500 truncate">{course.faculty}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-300 max-w-[16rem] truncate">{course.institution}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{course.qualificationType}</span>
                    </td>
                    <td className="px-4 py-3 text-purple-400 font-semibold">{course.minAPS}</td>
                    <td className="px-4 py-3">
                      <InstitutionStatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
