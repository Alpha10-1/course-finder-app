import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../../components/Seo";
import { getInstitutions } from "../../utils/publicCourses";

export default function CoursesDirectory() {
  const institutions = useMemo(() => getInstitutions(), []);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");

  const filtered = institutions.filter((i) => {
    const matchesQuery = !query || i.name.toLowerCase().includes(query.toLowerCase());
    const matchesType = type === "all" || i.type === type;
    return matchesQuery && matchesType;
  });

  const universities = filtered.filter((i) => i.type === "university");
  const colleges = filtered.filter((i) => i.type === "college");
  const totalCourses = institutions.reduce((sum, i) => sum + i.courseCount, 0);

  return (
    <>
      <Seo
        title="Browse Courses by Institution"
        path="/courses"
        description={`Browse ${totalCourses}+ university and college courses across South Africa. See admission requirements, APS scores, and qualifying subjects for every course.`}
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 px-4 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Browse Courses by Institution</h1>
            <p className="text-gray-600 mt-2">
              {totalCourses}+ courses across {institutions.length} South African universities and colleges.
              Sign up to check exactly which ones you qualify for.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-4 mb-8 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search institutions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <div className="flex rounded-xl bg-gray-100 p-1">
              {[
                { key: "all", label: "All" },
                { key: "university", label: "🎓 Universities" },
                { key: "college", label: "🏫 Colleges" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setType(opt.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                    type === opt.key ? "bg-white shadow text-purple-700" : "text-gray-500"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {universities.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-purple-700 mb-4">🎓 Universities</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {universities.map((i) => (
                  <Link
                    key={i.slug}
                    to={`/courses/${i.slug}`}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 transition border border-transparent hover:border-purple-200"
                  >
                    <p className="font-semibold text-gray-900">{i.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{i.courseCount} course{i.courseCount === 1 ? "" : "s"}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {colleges.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-blue-700 mb-4">🏫 Colleges</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {colleges.map((i) => (
                  <Link
                    key={i.slug}
                    to={`/courses/${i.slug}`}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 transition border border-transparent hover:border-blue-200"
                  >
                    <p className="font-semibold text-gray-900">{i.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{i.courseCount} course{i.courseCount === 1 ? "" : "s"}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {filtered.length === 0 && (
            <p className="text-center text-gray-500 py-12">No institutions match your search.</p>
          )}

          <div className="mt-12 bg-gradient-to-r from-purple-600 to-blue-500 rounded-2xl p-6 text-center">
            <p className="text-white font-bold text-lg">Want to know exactly what you qualify for?</p>
            <p className="text-white/80 text-sm mt-1 mb-4">
              Enter your marks and Course Finder matches you to real courses in seconds.
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
