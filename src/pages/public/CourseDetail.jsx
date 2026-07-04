import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import Seo from "../../components/Seo";
import { getCourseBySlugs, getInstitutionBySlug } from "../../utils/publicCourses";

export default function CourseDetail() {
  const { institutionSlug, courseSlug } = useParams();
  const course = useMemo(
    () => getCourseBySlugs(institutionSlug, courseSlug),
    [institutionSlug, courseSlug]
  );
  const institution = useMemo(() => getInstitutionBySlug(institutionSlug), [institutionSlug]);

  if (!course || !institution) {
    return (
      <>
        <Seo title="Course Not Found" path={`/courses/${institutionSlug}/${courseSlug}`} noindex />
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 px-4">
          <p className="text-gray-700 font-semibold">We couldn't find that course.</p>
          <Link to="/courses" className="text-purple-600 hover:underline mt-2">← Back to all courses</Link>
        </div>
      </>
    );
  }

  const isUniversity = course.institutionType === "university";
  const description = isUniversity
    ? `${course.courseName} at ${course.institution}: minimum APS ${course.minAPS ?? "N/A"}. See qualifying subjects, duration, and how to check if you're eligible.`
    : `${course.courseName} at ${course.institution}: admission requirements, entry grade, and curriculum. See how to check if you're eligible.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.courseName,
    description,
    provider: {
      "@type": "CollegeOrUniversity",
      name: course.institution,
    },
    ...(course.duration ? { timeRequired: course.duration } : {}),
  };

  return (
    <>
      <Seo
        title={`${course.courseName} at ${course.institution}`}
        path={`/courses/${institutionSlug}/${courseSlug}`}
        description={description}
        jsonLd={jsonLd}
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <nav className="text-sm text-purple-700 space-x-1 mb-4">
            <Link to="/courses" className="hover:underline">Courses</Link>
            <span>/</span>
            <Link to={`/courses/${institution.slug}`} className="hover:underline">{institution.name}</Link>
          </nav>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <p className="text-sm font-semibold text-purple-600 uppercase tracking-wide">
              {institution.name}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{course.courseName}</h1>
            <p className="text-gray-500 mt-1">{course.faculty}</p>

            <div className="grid grid-cols-2 gap-4 mt-6">
              {course.qualificationType && (
                <Detail label="Qualification" value={course.qualificationType} />
              )}
              {course.duration && <Detail label="Duration" value={course.duration} />}
              {isUniversity && course.minAPS != null && (
                <Detail label="Minimum APS" value={course.minAPS} />
              )}
              {!isUniversity && course.minGrade && (
                <Detail label="Minimum Grade" value={course.minGrade} />
              )}
              {!isUniversity && course.minNQFLevel && (
                <Detail label="Minimum NQF Level" value={course.minNQFLevel} />
              )}
            </div>

            {course.keySubjects?.length > 0 && (
              <div className="mt-6">
                <h2 className="font-semibold text-gray-800 mb-2">Required subjects</h2>
                <ul className="space-y-1">
                  {course.keySubjects.map((s, idx) => (
                    <li key={idx} className="text-sm text-gray-600 flex justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span>{s.subject}</span>
                      <span className="font-medium">{s.minMark}%+</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {course.admissionRequirement && (
              <div className="mt-6">
                <h2 className="font-semibold text-gray-800 mb-2">Admission requirement</h2>
                <p className="text-sm text-gray-600">{course.admissionRequirement}</p>
              </div>
            )}

            {course.curriculum?.fundamentalSubjects?.length > 0 && (
              <div className="mt-6">
                <h2 className="font-semibold text-gray-800 mb-2">Fundamental subjects</h2>
                <p className="text-sm text-gray-600">{course.curriculum.fundamentalSubjects.join(", ")}</p>
              </div>
            )}

            {course.curriculum?.vocationalSubjects?.length > 0 && (
              <div className="mt-6">
                <h2 className="font-semibold text-gray-800 mb-2">Vocational subjects</h2>
                <ul className="text-sm text-gray-600 space-y-1">
                  {course.curriculum.vocationalSubjects.map((v, idx) => (
                    <li key={idx}>
                      {v.subject} {v.optional ? "(optional)" : ""} — Levels {v.levels}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {course.campuses?.length > 0 && (
              <div className="mt-6">
                <h2 className="font-semibold text-gray-800 mb-2">Offered at campuses</h2>
                <p className="text-sm text-gray-600">{course.campuses.join(", ")}</p>
              </div>
            )}
          </div>

          <div className="mt-8 bg-gradient-to-r from-purple-600 to-blue-500 rounded-2xl p-6 text-center">
            <p className="text-white font-bold text-lg">Do you qualify for this course?</p>
            <p className="text-white/80 text-sm mt-1 mb-4">
              Enter your marks and Course Finder will tell you instantly — plus every other course you're eligible for.
            </p>
            <Link
              to="/signup"
              className="inline-block bg-white text-purple-700 font-semibold px-6 py-3 rounded-xl hover:bg-purple-50 transition"
            >
              Check if I qualify →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-semibold text-gray-800">{value}</p>
    </div>
  );
}
