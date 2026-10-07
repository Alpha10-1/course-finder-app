import { getInstitutionApplicationStatus, facultySettingsKey, getCourseDisplayStatus } from "../../utils/institutionStatus";
import { BLANK_COURSE } from "./constants";
import { InstitutionStatusBadge } from "./ui";
import CourseFormFields from "./CourseFormFields";
import BulkDeleteCoursesPanel from "./BulkDeleteCoursesPanel";
import ApsSearchPanel from "./ApsSearchPanel";

export default function CoursesTab({ admin, windows }) {
  const {
    filterFaculty, setFilterFaculty, filterInstitution, setFilterInstitution, filterQualType,
    setFilterQualType, filterMinAPS, setFilterMinAPS, filterMaxAPS, setFilterMaxAPS, courses,
    loadingCourses, courseSearch, setCourseSearch, editingCourse, setEditingCourse, addingCourse,
    setAddingCourse, newCourse, setNewCourse, confirmDeleteCourse, setConfirmDeleteCourse,
    seedExclusions, showSeedExclusions, setShowSeedExclusions, selectedVarsity, setSelectedVarsity,
    collapsedFacultyGroups, bulkMode, setBulkMode, bulkSelectedIds, confirmBulkDelete,
    setConfirmBulkDelete, bulkDeleting, apsSearchMode, setApsSearchMode, apsSortDir, setApsSortDir,
    toggleFacultyGroupCollapsed, loadCourses, handleSeedCourses, handleSeedCollegeCourses,
    handleSaveCourse, handleAddCourse, loadSeedExclusions, handleRestoreSeedExclusion,
    handleDeleteCourse, toggleBulkSelected, selectAllBulkMatches, clearBulkSelection, handleBulkDelete,
    filteredCourses,
  } = admin;
  const {
    institutionSettings, editingInstitutionDates, setEditingInstitutionDates, datesForm,
    setDatesForm, facultySettings, editingFacultyDates, setEditingFacultyDates, facultyDatesForm,
    setFacultyDatesForm, openInstitutionDatesEditor, handleSaveInstitutionDates, handleClearInstitutionDates,
    openFacultyDatesEditor, handleSaveFacultyDates, handleClearFacultyDates,
  } = windows;

  return (
    <>
      {/* Confirm delete course */}
      {confirmDeleteCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 text-center space-y-4">
            <p className="text-lg font-bold text-red-400">Delete Course?</p>
            <p className="text-gray-400 text-sm">Remove <span className="text-white font-medium">"{confirmDeleteCourse.courseName}"</span> permanently?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteCourse(null)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={() => handleDeleteCourse(confirmDeleteCourse.id, confirmDeleteCourse.courseName)} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit course modal */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col">
            <h3 className="text-lg font-bold text-white px-6 pt-6 pb-3 shrink-0 border-b border-gray-800">Edit Course</h3>
            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
              <CourseFormFields data={editingCourse} onChange={(f, v) => setEditingCourse((p) => ({ ...p, [f]: v }))} />
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
              <button onClick={() => setEditingCourse(null)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleSaveCourse} className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add course modal */}
      {addingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col">
            <h3 className="text-lg font-bold text-white px-6 pt-6 pb-3 shrink-0 border-b border-gray-800">Add New Course</h3>
            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
              <CourseFormFields data={newCourse} onChange={(f, v) => setNewCourse((p) => ({ ...p, [f]: v }))} />
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
              <button onClick={() => setAddingCourse(false)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleAddCourse} className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-semibold transition">Add Course</button>
            </div>
          </div>
        </div>
      )}

      {/* Institution application-window editor */}
      {editingInstitutionDates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Application Window</h3>
            <p className="text-sm text-gray-300">{editingInstitutionDates}</p>
            <p className="text-xs text-gray-500">
              Leave both fields blank to keep this institution always open. While a student is
              selecting institutions to apply to, any institution outside its window shows as
              closed and can't be picked.
            </p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Opens on</label>
              <input type="date" value={datesForm.openDate}
                onChange={(e) => setDatesForm((f) => ({ ...f, openDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Closes on</label>
              <input type="date" value={datesForm.closeDate}
                onChange={(e) => setDatesForm((f) => ({ ...f, closeDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditingInstitutionDates(null)}
                className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleSaveInstitutionDates}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition">Save</button>
            </div>
            {(institutionSettings[editingInstitutionDates]?.openDate || institutionSettings[editingInstitutionDates]?.closeDate) && (
              <button onClick={handleClearInstitutionDates}
                className="w-full text-xs text-red-400 hover:text-red-300 transition">
                Clear dates (always open)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Faculty application-window editor */}
      {editingFacultyDates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Faculty Application Window</h3>
            <p className="text-sm text-gray-300">
              {editingFacultyDates.faculty}
              <span className="block text-gray-500 text-xs mt-0.5">{editingFacultyDates.institution}</span>
            </p>
            <p className="text-xs text-gray-500">
              Leave both fields blank to have this faculty simply follow {editingFacultyDates.institution}'s own
              application window. Only set dates here if this faculty closes on a different schedule.
            </p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Opens on</label>
              <input type="date" value={facultyDatesForm.openDate}
                onChange={(e) => setFacultyDatesForm((f) => ({ ...f, openDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Closes on</label>
              <input type="date" value={facultyDatesForm.closeDate}
                onChange={(e) => setFacultyDatesForm((f) => ({ ...f, closeDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditingFacultyDates(null)}
                className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleSaveFacultyDates}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition">Save</button>
            </div>
            {(() => {
              const key = facultySettingsKey(editingFacultyDates.institution, editingFacultyDates.faculty);
              return (facultySettings[key]?.openDate || facultySettings[key]?.closeDate) && (
                <button onClick={handleClearFacultyDates}
                  className="w-full text-xs text-red-400 hover:text-red-300 transition">
                  Clear dates (follow {editingFacultyDates.institution}'s dates)
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Confirm bulk delete */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 text-center space-y-4">
            <p className="text-lg font-bold text-red-400">Delete {bulkSelectedIds.size} Course{bulkSelectedIds.size !== 1 ? "s" : ""}?</p>
            <p className="text-gray-400 text-sm">This permanently removes all selected courses and can't be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting}
                className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition disabled:opacity-60">Cancel</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold transition disabled:opacity-60">
                {bulkDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">

        {/* ═══ VARSITY GRID — landing view ═══ */}
        {!selectedVarsity && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold text-white">
                Institutions <span className="text-gray-500 font-normal text-base">({courses.length} courses total)</span>
              </h2>
              <div className="flex gap-2">
                <button onClick={handleSeedCourses}
                  className="text-xs bg-yellow-700 hover:bg-yellow-600 text-yellow-200 px-3 py-1.5 rounded-lg transition font-medium">
                  ⚡ Seed from JSON
                </button>
                <button onClick={handleSeedCollegeCourses}
                  className="text-xs bg-amber-700 hover:bg-amber-600 text-amber-200 px-3 py-1.5 rounded-lg transition font-medium">
                  🏫 Seed Colleges from JSON
                </button>
                <button onClick={async () => { await loadSeedExclusions(); setShowSeedExclusions((v) => !v); }}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition font-medium">
                  🚫 Seed Exclusions
                </button>
                <button onClick={() => { setNewCourse(BLANK_COURSE); setAddingCourse(true); }}
                  className="text-xs bg-green-700 hover:bg-green-600 text-green-200 px-3 py-1.5 rounded-lg transition font-medium">
                  + Add Course
                </button>
                <button onClick={() => { setBulkMode((v) => !v); setApsSearchMode(false); clearBulkSelection(); }}
                  className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${
                    bulkMode ? "bg-red-700 hover:bg-red-600 text-red-100" : "bg-red-900 hover:bg-red-800 text-red-300"
                  }`}>
                  {bulkMode ? "✕ Exit Bulk Delete" : "🗑️ Bulk Delete"}
                </button>
                <button onClick={() => { setApsSearchMode((v) => !v); setBulkMode(false); clearBulkSelection(); }}
                  className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${
                    apsSearchMode ? "bg-purple-700 hover:bg-purple-600 text-purple-100" : "bg-purple-900 hover:bg-purple-800 text-purple-300"
                  }`}>
                  {apsSearchMode ? "✕ Exit APS Search" : "🎯 Search by APS"}
                </button>
                <button onClick={loadCourses}
                  className="text-xs text-purple-400 hover:text-purple-300 border border-gray-700 px-3 py-1.5 rounded-lg transition">
                  ↻ Refresh
                </button>
              </div>
            </div>

            {bulkMode ? (
              <BulkDeleteCoursesPanel
                courses={filteredCourses}
                allCourses={courses}
                institutionSettings={institutionSettings}
                facultySettings={facultySettings}
                filterFaculty={filterFaculty} setFilterFaculty={setFilterFaculty}
                filterInstitution={filterInstitution} setFilterInstitution={setFilterInstitution}
                filterQualType={filterQualType} setFilterQualType={setFilterQualType}
                filterMinAPS={filterMinAPS} setFilterMinAPS={setFilterMinAPS}
                filterMaxAPS={filterMaxAPS} setFilterMaxAPS={setFilterMaxAPS}
                bulkSelectedIds={bulkSelectedIds}
                toggleBulkSelected={toggleBulkSelected}
                selectAllBulkMatches={selectAllBulkMatches}
                clearBulkSelection={clearBulkSelection}
                onDeleteClick={() => setConfirmBulkDelete(true)}
              />
            ) : apsSearchMode ? (
              <ApsSearchPanel
                courses={filteredCourses}
                allCourses={courses}
                institutionSettings={institutionSettings}
                facultySettings={facultySettings}
                courseSearch={courseSearch} setCourseSearch={setCourseSearch}
                filterFaculty={filterFaculty} setFilterFaculty={setFilterFaculty}
                filterInstitution={filterInstitution} setFilterInstitution={setFilterInstitution}
                filterQualType={filterQualType} setFilterQualType={setFilterQualType}
                filterMinAPS={filterMinAPS} setFilterMinAPS={setFilterMinAPS}
                filterMaxAPS={filterMaxAPS} setFilterMaxAPS={setFilterMaxAPS}
                apsSortDir={apsSortDir} setApsSortDir={setApsSortDir}
                setEditingCourse={setEditingCourse}
                setConfirmDeleteCourse={setConfirmDeleteCourse}
              />
            ) : (
            <>

            {showSeedExclusions && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-300 mb-1">
                  Excluded from seeding ({seedExclusions.length})
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Courses deleted from here are remembered, so seeding never silently re-adds them —
                  even if they're still in the local JSON file. Restore one if you want it back next
                  time you seed.
                </p>
                {seedExclusions.length === 0 ? (
                  <p className="text-sm text-gray-500">Nothing excluded right now.</p>
                ) : (
                  <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                    {seedExclusions.map((key) => {
                      const [courseName, institution] = key.split("|||");
                      return (
                        <li key={key} className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
                          <span className="text-sm text-gray-300 truncate">
                            {courseName || "(unnamed)"} <span className="text-gray-500">· {institution}</span>
                          </span>
                          <button
                            onClick={() => handleRestoreSeedExclusion(key)}
                            className="text-xs text-purple-400 hover:text-purple-300 shrink-0 ml-3"
                          >
                            ↺ Restore
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {loadingCourses ? (
              <p className="text-gray-500 text-sm py-8 text-center">Loading courses…</p>
            ) : courses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No courses found in Firestore.</p>
                <p className="text-gray-500 text-sm mt-1">Use the "+ Add Course" button to add courses.</p>
              </div>
            ) : (
              <>
                {/* Universities */}
                {(() => {
                  const uniInstitutions = [...new Set(
                    courses.filter((c) => c.institutionType !== "college").map((c) => c.institution)
                  )].sort();
                  if (uniInstitutions.length === 0) return null;
                  return (
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">🎓 Universities</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {uniInstitutions.map((inst) => {
                          const count = courses.filter((c) => c.institution === inst).length;
                          const status = getInstitutionApplicationStatus(institutionSettings[inst]);
                          return (
                            <div key={inst} className="relative bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-purple-600 rounded-2xl p-4 transition group">
                              <button onClick={() => setSelectedVarsity(inst)} className="text-left w-full">
                                <p className="text-white font-semibold text-sm group-hover:text-purple-400 transition truncate pr-16">{inst}</p>
                                <p className="text-gray-500 text-xs mt-1">{count} course{count !== 1 ? "s" : ""}</p>
                              </button>
                              <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                                <InstitutionStatusBadge status={status} />
                                <button onClick={() => openInstitutionDatesEditor(inst)}
                                  className="text-[10px] text-gray-500 hover:text-purple-400 underline">
                                  Set dates
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Colleges */}
                {(() => {
                  const collegeInstitutions = [...new Set(
                    courses.filter((c) => c.institutionType === "college").map((c) => c.institution)
                  )].sort();
                  if (collegeInstitutions.length === 0) return null;
                  return (
                    <div className="mt-6">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">🏫 Colleges</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {collegeInstitutions.map((inst) => {
                          const count = courses.filter((c) => c.institution === inst).length;
                          const status = getInstitutionApplicationStatus(institutionSettings[inst]);
                          return (
                            <div key={inst} className="relative bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-amber-600 rounded-2xl p-4 transition group">
                              <button onClick={() => setSelectedVarsity(inst)} className="text-left w-full">
                                <p className="text-white font-semibold text-sm group-hover:text-amber-400 transition truncate pr-16">{inst}</p>
                                <p className="text-gray-500 text-xs mt-1">{count} course{count !== 1 ? "s" : ""}</p>
                              </button>
                              <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                                <InstitutionStatusBadge status={status} />
                                <button onClick={() => openInstitutionDatesEditor(inst)}
                                  className="text-[10px] text-gray-500 hover:text-amber-400 underline">
                                  Set dates
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            </>
            )}
          </>
        )}

        {/* ═══ SINGLE VARSITY VIEW — courses for selectedVarsity ═══ */}
        {selectedVarsity && (() => {
          const varsityCourses = courses.filter((c) => c.institution === selectedVarsity);
          const filtered = varsityCourses.filter((c) =>
            !courseSearch || c.courseName?.toLowerCase().includes(courseSearch.toLowerCase())
          );
          return (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <button onClick={() => { setSelectedVarsity(null); setCourseSearch(""); }}
                    className="text-xs text-gray-400 hover:text-white transition mb-1">
                    ← All Institutions
                  </button>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
                    {selectedVarsity}
                    <InstitutionStatusBadge status={getInstitutionApplicationStatus(institutionSettings[selectedVarsity])} />
                    <button onClick={() => openInstitutionDatesEditor(selectedVarsity)}
                      className="text-xs font-normal text-gray-500 hover:text-purple-400 underline">
                      Set dates
                    </button>
                    <span className="text-gray-500 font-normal text-base ml-2">({filtered.length} of {varsityCourses.length})</span>
                  </h2>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setNewCourse({ ...BLANK_COURSE, institution: selectedVarsity,
                      institutionType: varsityCourses[0]?.institutionType || "university" });
                    setAddingCourse(true);
                  }}
                    className="text-xs bg-green-700 hover:bg-green-600 text-green-200 px-3 py-1.5 rounded-lg transition font-medium">
                    + Add Course Here
                  </button>
                </div>
              </div>

              <input value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}
                placeholder={`Search courses at ${selectedVarsity}…`}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />

              {filtered.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">No courses match your search.</p>
              ) : (() => {
                // Group courses by faculty. Courses with no faculty set
                // fall into a catch-all group so nothing is dropped.
                const groups = new Map(); // facultyName -> courses[]
                filtered.forEach((course) => {
                  const key = course.faculty?.trim() || "(No Faculty Listed)";
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key).push(course);
                });
                const facultyNames = [...groups.keys()].sort((a, b) => {
                  if (a === "(No Faculty Listed)") return 1;
                  if (b === "(No Faculty Listed)") return -1;
                  return a.localeCompare(b);
                });

                return (
                  <div className="space-y-4">
                    {facultyNames.map((facultyName) => {
                      const facultyCourses = groups.get(facultyName);
                      const groupKey = facultySettingsKey(selectedVarsity, facultyName);
                      const isCollapsed = collapsedFacultyGroups.has(groupKey);
                      const hasOwnDates = facultyName !== "(No Faculty Listed)" &&
                        (facultySettings[groupKey]?.openDate || facultySettings[groupKey]?.closeDate);
                      const facultyStatus = facultyName === "(No Faculty Listed)"
                        ? getInstitutionApplicationStatus(institutionSettings[selectedVarsity])
                        : getCourseDisplayStatus({ institution: selectedVarsity, faculty: facultyName }, institutionSettings, facultySettings);

                      return (
                        <div key={facultyName} className="rounded-2xl border border-gray-800 overflow-hidden">
                          <div className="flex items-center justify-between gap-2 bg-gray-900 px-4 py-3">
                            <button onClick={() => toggleFacultyGroupCollapsed(groupKey)}
                              className="flex items-center gap-2 text-left min-w-0 flex-1">
                              <span className="text-gray-500 text-xs shrink-0">{isCollapsed ? "▶" : "▼"}</span>
                              <span className="text-white font-semibold text-sm truncate">{facultyName}</span>
                              <span className="text-gray-500 text-xs shrink-0">({facultyCourses.length})</span>
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <InstitutionStatusBadge status={facultyStatus} />
                              {hasOwnDates && (
                                <span className="text-[10px] text-purple-400 whitespace-nowrap">own dates</span>
                              )}
                              {facultyName !== "(No Faculty Listed)" && (
                                <button onClick={() => openFacultyDatesEditor(selectedVarsity, facultyName)}
                                  className="text-xs text-gray-500 hover:text-purple-400 underline whitespace-nowrap">
                                  Set dates
                                </button>
                              )}
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-950 text-gray-500 text-xs uppercase tracking-wider">
                                  <tr>
                                    <th className="text-left px-4 py-2">Course</th>
                                    <th className="text-left px-4 py-2 hidden md:table-cell">Type</th>
                                    <th className="text-left px-4 py-2">APS</th>
                                    <th className="text-left px-4 py-2">Status</th>
                                    <th className="px-4 py-2 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                  {facultyCourses.map((course) => (
                                    <tr key={course.id} className="bg-gray-950 hover:bg-gray-900 transition">
                                      <td className="px-4 py-3 font-medium text-white max-w-md">
                                        <p className="truncate">
                                          {course.courseName}
                                          {course.campus && (
                                            <span className="ml-2 text-xs font-normal bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded">{course.campus}</span>
                                          )}
                                        </p>
                                      </td>
                                      <td className="px-4 py-3 hidden md:table-cell">
                                        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{course.qualificationType}</span>
                                      </td>
                                      <td className="px-4 py-3 text-purple-400 font-semibold">{course.minAPS}</td>
                                      <td className="px-4 py-3">
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
                    })}
                  </div>
                );
              })()}
            </>
          );
        })()}
      </div>
    </>
  );
}
