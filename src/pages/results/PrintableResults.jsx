import { calculateAPSForCourse, getEffectiveMinAPS } from "../../utils/marksToAPS";
import { SITE_URL } from "../../utils/shareResults";

const cell = "border border-gray-300 px-2 py-1 text-left align-top";

// Print-only layout behind "Save as PDF": the learner's marks and the courses
// currently on screen as plain tables, so the browser's print dialog can save
// a clean PDF. Only mounted while printing (see Results).
export default function PrintableResults({ aps, gradeLabel, subjects, sections }) {
  const generated = new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="hidden print:block w-full bg-white text-black text-sm">
      <h1 className="text-2xl font-bold">My qualifying courses</h1>
      <p className="text-gray-700 mt-1">
        APS {aps}{gradeLabel ? ` · ${gradeLabel}` : ""} · generated {generated} on Course Finder ({SITE_URL.replace("https://", "")})
      </p>

      <h2 className="text-lg font-semibold mt-5 mb-2">My marks</h2>
      <table className="border-collapse w-full">
        <tbody>
          {subjects.map((s) => (
            <tr key={s.subject}>
              <td className={cell}>{s.subject}</td>
              <td className={`${cell} w-24`}>{s.mark === "" || s.mark == null ? "—" : `${s.mark}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sections.filter((section) => section.courses.length > 0).map((section) => (
        <section key={section.title}>
          <h2 className="text-lg font-semibold mt-5 mb-2">{section.title} ({section.courses.length})</h2>
          <table className="border-collapse w-full">
            <thead>
              <tr>
                <th className={cell}>Course</th>
                <th className={cell}>Institution</th>
                <th className={cell}>Qualification</th>
                <th className={cell}>{section.college ? "Requires" : "Min APS · yours"}</th>
              </tr>
            </thead>
            <tbody>
              {section.courses.map((course) => (
                <tr key={course.id} className="break-inside-avoid">
                  <td className={cell}>{course.courseName}</td>
                  <td className={cell}>{course.institution}{course.campus ? ` (${course.campus})` : ""}</td>
                  <td className={cell}>{course.qualificationType}</td>
                  <td className={cell}>
                    {section.college
                      ? [course.minGrade, course.minNQFLevel && `NQF ${course.minNQFLevel}`].filter(Boolean).join(" · ") || "—"
                      : `${getEffectiveMinAPS(course, subjects)} · ${calculateAPSForCourse(course, subjects).score}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <p className="text-xs text-gray-600 mt-6">
        Admission requirements change every year. Confirm them with each institution before you apply.
      </p>
    </div>
  );
}
