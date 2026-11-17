import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Seo from "../components/Seo";
import { COURSE_TOPICS, certificateLabel, levelLabel, topicLabel, visibleFreeCourses } from "../utils/freeCourses";

const CERT_STYLE = {
  free: "bg-green-50 text-green-800 border-green-200",
  paid: "bg-amber-50 text-amber-900 border-amber-200",
  none: "bg-gray-50 text-gray-700 border-gray-200",
};

// Free online courses (admin-curated, Firestore `freeCourses`). Public, so
// anyone can find them; learners are sent to the provider's own site.
export default function FreeCourses() {
  const [courses, setCourses] = useState(null); // null while loading
  const [failed, setFailed] = useState(false);
  const [topic, setTopic] = useState("");

  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, "freeCourses"))
      .then((snap) => { if (!cancelled) setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); })
      .catch(() => { if (!cancelled) { setFailed(true); setCourses([]); } });
    return () => { cancelled = true; };
  }, []);

  const shown = courses ? visibleFreeCourses(courses, topic) : [];
  const topicsInUse = courses
    ? COURSE_TOPICS.filter((t) => visibleFreeCourses(courses, t.key).length > 0)
    : [];

  return (
    <>
      <Seo
        title="Free Online Courses with Certificates"
        path="/free-courses"
        description="Free online courses South African learners can take to build skills — coding, data, IT, business and more — with honest notes on which certificates are free."
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="text-sm text-purple-700 hover:underline">← Course Finder</Link>
          <header className="mt-3 mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Free courses</h1>
            <p className="text-gray-700 mt-2">
              Learn skills employers look for, for free. Each course says whether its certificate is free — some
              courses are free to take but charge for the certificate.
            </p>
          </header>

          {topicsInUse.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by topic">
              {[{ key: "", label: "All" }, ...topicsInUse].map((t) => (
                <button
                  key={t.key || "all"}
                  type="button"
                  aria-pressed={topic === t.key}
                  onClick={() => setTopic(t.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    topic === t.key ? "bg-purple-700 border-purple-700 text-white" : "bg-white border-gray-300 text-gray-800 hover:border-purple-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {courses === null ? (
            <p className="text-gray-700">Loading courses…</p>
          ) : failed ? (
            <p className="bg-white rounded-2xl p-5 text-gray-700">Couldn't load the courses. Check your connection and try again.</p>
          ) : shown.length === 0 ? (
            <p className="bg-white rounded-2xl p-5 text-gray-700">No free courses listed yet — check back soon.</p>
          ) : (
            <ul className="space-y-3">
              {shown.map((c) => (
                <li key={c.id} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-gray-900">{c.title}</h2>
                      <p className="text-sm text-gray-600">
                        {c.provider} · {levelLabel(c.level)}{c.duration && ` · ${c.duration}`}
                      </p>
                    </div>
                    <span className={`text-xs font-medium border rounded-full px-2.5 py-0.5 shrink-0 ${CERT_STYLE[c.certificate] || CERT_STYLE.none}`}>
                      {certificateLabel(c.certificate)}
                    </span>
                  </div>
                  {c.description && <p className="text-sm text-gray-700 mt-2">{c.description}</p>}
                  <p className="text-xs text-gray-600 mt-2">{(c.topics || []).map(topicLabel).join(" · ")}</p>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded-xl transition"
                  >
                    Go to the course ↗
                  </a>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-gray-700 mt-6 leading-relaxed">
            These courses are run by other organisations. Check the details on their sites — prices and certificates can
            change. Course Finder never asks you to pay for a free course.
          </p>
        </div>
      </div>
    </>
  );
}
