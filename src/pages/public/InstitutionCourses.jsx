import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import Seo from "../../components/Seo";
import { getInstitutionBySlug, getCoursesByInstitution } from "../../utils/publicCourses";

export default function InstitutionCourses() {
  const { institutionSlug } = useParams();
  const institution = useMemo(() => getInstitutionBySlug(institutionSlug), [institutionSlug]);
  const courses = useMemo(() => getCoursesByInstitution(institutionSlug), [institutionSlug]);

  if (!institution) {
    return (
      <>
        <Seo title="Institution Not Found" path={`/courses/${institutionSlug}`} noindex />
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 px-4">
          <p className="text-gray-700 font-semibold">We couldn't find that institution.</p>
          <Link to="/courses" className="text-purple-600 hover:underline mt-2">← Back to all institutions</Link>
        </div>
      </>
    );
  }

  const icon = institution.type === "university" ? "🎓" : "🏫";

  return (
    <>
      <Seo
        title={`Courses at ${institution.name}`}
        path={`/courses/${institution.slug}`}
        description={`See all ${institution.courseCount} courses offered at ${institution.name}, including admission requirements, APS scores, and qualifying subjects.`}
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <Link to="/courses" className="text-sm text-purple-700 hover:underline">← All institutions</Link>

          <div className="mt-3 mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{icon} {institution.name}</h1>
            <p className="text-gray-600 mt-2">
              {institution.courseCount} course{institution.courseCount === 1 ? "" : "s"} across {institution.faculties.length} facult{institution.faculties.length === 1 ? "y" : "ies"}.
            </p>
          </div>

          <div className="space-y-3">
            {courses.map((c) => (
              <Link
                key={c.courseSlug}
                to={`/courses/${institution.slug}/${c.courseSlug}`}
                className="block bg-white rounded-xl shadow-sm hover:shadow-md p-4 transition border border-transparent hover:border-purple-200"
              >
                <p className="font-semibold text-gray-900">{c.courseName}</p>
                <p className="text-sm text-gray-500 mt-0.5">{c.faculty}{c.duration ? ` · ${c.duration}` : ""}</p>
                {c.institutionType === "university" ? (
                  <p className="text-xs text-purple-600 font-medium mt-1">Min APS: {c.minAPS ?? "—"}</p>
                ) : (
                  (c.minGrade || c.minNQFLevel) && (
                    <p className="text-xs text-blue-600 font-medium mt-1">
                      Requires: {[c.minGrade, c.minNQFLevel ? `NQF Level ${c.minNQFLevel}` : null].filter(Boolean).join(" · ")}
                    </p>
                  )
                )}
              </Link>
            ))}
          </div>

          <div className="mt-10 bg-gradient-to-r from-purple-600 to-blue-500 rounded-2xl p-6 text-center">
            <p className="text-white font-bold text-lg">Not sure if you qualify for these?</p>
            <p className="text-white/80 text-sm mt-1 mb-4">
              Enter your marks once and see every course you're eligible for — here and at every other institution.
            </p>
            <Link
              to="/signup"
              className="inline-block bg-white text-purple-700 font-semibold px-6 py-3 rounded-xl hover:bg-purple-50 transition"
            >
              Check what you qualify for →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
