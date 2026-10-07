import { calculateAPSForCourse, getCompletionLabel, getEffectiveMinAPS } from "../../utils/marksToAPS";
import { getKeySubjectStatus } from "../../utils/subjectMatch";
import { getCourseDisplayStatus, getInstitutionApplicationStatus } from "../../utils/institutionStatus";
import CourseStatusBadge from "../../components/CourseStatusBadge";
import { ROUND_INFO } from "./roundInfo";

// Collapsed list row that expands into the full course tile.
export default function CourseCard({
  course, colorScheme, subjects, grade, gradeStatus,
  institutionSettings, facultySettings,
  selectionMode, round, selectedRound,
  isExpanded, onToggleExpand, onPick,
}) {
  // Per-course (not per-institution) so qualification-specific APS methods,
  // e.g. CPUT's Method 1/2/3, are used.
  const { score: uniScore, label: uniLabel } = calculateAPSForCourse(course, subjects);
  const keyStatus = getKeySubjectStatus(subjects, course.keySubjects);
  const requiredAPS = getEffectiveMinAPS(course, subjects);
  const usingAltAPS = requiredAPS !== (Number(course.minAPS) || 0);
  const isGreen   = colorScheme === "green";
  const isCollege = colorScheme === "college";
  const isSelected = selectedRound !== null;
  const instOpen = getInstitutionApplicationStatus(institutionSettings[course.institution]) === "open";
  // Locked = actively picking round-1 institutions right now, and this one
  // is currently outside its application window.
  const isLocked = selectionMode && round === 1 && !isSelected && !instOpen;

  const titleColor = isCollege ? "text-amber-800" : isGreen ? "text-green-800" : "text-purple-800";
  const scoreColor = isCollege ? "text-amber-600" : isGreen ? "text-green-600" : "text-purple-600";
  const rowBg = isLocked
    ? "bg-gray-50 opacity-60"
    : isSelected
      ? "bg-purple-50"
      : "bg-white";

  return (
    <div className={`${rowBg} transition`}>
      {/* Collapsed row — always visible, kept to ~2 short lines so many fit on a mobile screen */}
      <button
        type="button"
        onClick={() => onToggleExpand(course.id)}
        aria-expanded={isExpanded}
        className="w-full text-left px-3 py-2 flex items-center gap-2 active:bg-gray-50"
      >
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${isSelected ? "text-purple-800" : titleColor}`}>
            {course.courseName}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {course.institution}{course.campus && ` — ${course.campus}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isSelected && (
            <span className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
              {ROUND_INFO[selectedRound]?.label}
            </span>
          )}
          {isLocked && <span className="text-xs" title="Applications closed">🔒</span>}
          <span className={`text-xs font-medium whitespace-nowrap ${scoreColor}`}>
            {isCollege ? "✓ Qualify" : uniScore}
          </span>
          <span className={`text-gray-400 text-xs transition-transform inline-block ${isExpanded ? "rotate-180" : ""}`}>
            ▾
          </span>
        </div>
      </button>

      {/* Expanded detail — the full tile, unchanged content-wise, shown on tap */}
      {isExpanded && (
        <div className="px-3 pb-4 pt-1 border-t border-gray-100">
          <p className="text-gray-700 text-sm">Faculty: {course.faculty}</p>
          <p className="text-gray-700 text-sm">
            Institution: {course.institution}
            {course.campus && <span className="text-gray-500"> — {course.campus}</span>}
            {" "}
            <CourseStatusBadge status={getCourseDisplayStatus(course, institutionSettings, facultySettings)} className="align-middle" />
          </p>
          <p className="text-gray-700 text-sm">Duration: {course.duration}</p>
          <p className="text-gray-700 text-sm">Qualification: {course.qualificationType}</p>
          <p className="text-gray-500 text-xs mt-1">Code: {course.qualificationCode || "—"}</p>

          {isCollege ? (
            <>
              {(course.minGrade || course.minNQFLevel) && (
                <p className="text-gray-500 text-xs">
                  Requires:{" "}
                  {course.minGrade && <span className="font-medium text-gray-700">{course.minGrade}</span>}
                  {course.minGrade && course.minNQFLevel && " · "}
                  {course.minNQFLevel && <span className="font-medium text-gray-700">NQF Level {course.minNQFLevel}</span>}
                </p>
              )}
              {course.admissionRequirement && (
                <p className="text-amber-700 text-xs mt-1 bg-amber-50 rounded-lg px-2 py-1.5 leading-relaxed">
                  📋 {course.admissionRequirement}
                </p>
              )}
              {course.curriculum && (course.curriculum.fundamentalSubjects?.length > 0 || course.curriculum.vocationalSubjects?.length > 0) && (
                <div className="mt-2 bg-gray-50 rounded-lg px-2 py-1.5 space-y-1.5">
                  {course.curriculum.fundamentalSubjects?.length > 0 && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Fundamental subjects:</span>{" "}
                      {course.curriculum.fundamentalSubjects.join(", ")}
                    </p>
                  )}
                  {course.curriculum.vocationalSubjects?.length > 0 && (
                    <div className="text-xs text-gray-600">
                      <span className="font-medium text-gray-700">Vocational subjects:</span>{" "}
                      {course.curriculum.vocationalSubjects.map((v, i) => (
                        <span key={i}>
                          {v.subject} ({v.levels}{v.optional ? ", optional" : ""})
                          {i < course.curriculum.vocationalSubjects.length - 1 ? "; " : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className={`text-xs font-medium mt-1 ${scoreColor}`}>
                ✓ You qualify — {getCompletionLabel(grade, gradeStatus)}
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-xs">
                Min APS: {requiredAPS}
                {usingAltAPS && <span className="text-gray-400"> (based on your subject choice)</span>}
              </p>
              <p className={`text-xs font-medium mt-1 ${scoreColor}`}>
                Your score: {uniScore} <span className="text-gray-400 font-normal">({uniLabel})</span>
              </p>
            </>
          )}
          {keyStatus.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {keyStatus.map((req, i) => (
                <p key={i} className={`text-xs flex items-center gap-1 ${req.met ? "text-green-600" : "text-red-500"}`}>
                  {req.met ? "✓" : "✗"} {req.label}
                  {!req.met && req.userMark !== null && <span className="text-gray-400">(you have {req.userMark}%)</span>}
                </p>
              ))}
            </div>
          )}

          {/* Selection action — only shown here, so tapping the row header always just expands/collapses */}
          {selectionMode && !isSelected && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (!isLocked) onPick(course); }}
              disabled={isLocked}
              className={`mt-3 w-full text-sm font-medium rounded-lg py-2 transition ${
                isLocked
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              }`}
            >
              {isLocked ? "🔒 Applications closed" : "Select this course →"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
