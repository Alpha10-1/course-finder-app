import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { calculateAPSForUniversity, calculateGeneralAPS } from "../utils/marksToAPS";
import { meetsKeySubjects, subjectMatches } from "../utils/subjectMatch";
import { db, auth } from "../firebase";
import localCoursesData from "../data/courses.json";

async function fetchCourses() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    if (!snap.empty) return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {}
  return localCoursesData; // fallback to local JSON
}

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState([]);
  const [generalAps, setGeneralAps] = useState(0);
  const [allQualified, setAllQualified] = useState([]);
  const [normalCourses, setNormalCourses] = useState([]);
  const [extendedCourses, setExtendedCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [selectedQualification, setSelectedQualification] = useState("");
  const [showFullResults, setShowFullResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let loadedSubjects = [];

        // Fast path: subjects passed directly from EnterMarks
        if (location.state?.subjects) {
          loadedSubjects = location.state.subjects;
        } else {
          // Wait for Firebase Auth to initialise
          loadedSubjects = await new Promise((resolve) => {
            const unsub = onAuthStateChanged(auth, async (user) => {
              unsub();
              if (!user) { resolve([]); return; }
              try {
                const snap = await getDoc(doc(db, "users", user.uid));
                resolve(snap.exists() ? (snap.data().subjects || []) : []);
              } catch {
                resolve([]);
              }
            });
          });
        }

        if (cancelled) return;

        const gAps = calculateGeneralAPS(loadedSubjects);

        const coursesData = await fetchCourses();
        const qualified = coursesData.filter((course) => {
          const { score: uniAps } = calculateAPSForUniversity(course.institution, loadedSubjects);
          if (uniAps < course.minAPS) return false;
          return meetsKeySubjects(loadedSubjects, course.keySubjects);
        });

        setSubjects(loadedSubjects);
        setGeneralAps(gAps);
        setAllQualified(qualified);
        const EXTENDED_TYPES = ["Bachelor (Extended)", "Extended Diploma"];
        setNormalCourses(qualified.filter((c) => !EXTENDED_TYPES.includes(c.qualificationType)));
        setExtendedCourses(qualified.filter((c) => EXTENDED_TYPES.includes(c.qualificationType)));
        setLoading(false);
      } catch (err) {
        console.error("Results load error:", err);
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filters ──────────────────────────────────────────────────────────────

  const filteredNormal = normalCourses.filter(
    (c) =>
      (!selectedFaculty || c.faculty === selectedFaculty) &&
      (!selectedInstitution || c.institution === selectedInstitution) &&
      (!selectedQualification || c.qualificationType === selectedQualification) &&
      (!searchTerm || c.courseName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredExtended = extendedCourses.filter(
    (c) =>
      (!selectedFaculty || c.faculty === selectedFaculty) &&
      (!selectedInstitution || c.institution === selectedInstitution) &&
      (!selectedQualification || c.qualificationType === selectedQualification) &&
      (!searchTerm || c.courseName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getLimited = (courses) => {
    const seen = new Set();
    const result = [];
    for (const c of courses) {
      if (!seen.has(c.institution)) { seen.add(c.institution); result.push(c); }
      if (result.length === 3) break;
    }
    return result;
  };

  const displayedNormal = showFullResults ? filteredNormal : getLimited(filteredNormal);
  const totalUnlocked = filteredNormal.length + filteredExtended.length;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getUniAps = (institution) => calculateAPSForUniversity(institution, subjects);

  const getKeySubjectStatus = (keySubjects) => {
    if (!keySubjects || keySubjects.length === 0) return [];
    return keySubjects.map((req) => {
      if (req.subjectGroup) {
        const met = req.subjectGroup.some((opt) =>
          subjects.some(
            (s) => subjectMatches(s.subject, opt.subject) && parseInt(s.mark, 10) >= opt.minMark
          )
        );
        return { label: req.subjectGroup.map((o) => `${o.subject} ≥${o.minMark}%`).join(" or "), met };
      }
      const userSubj = subjects.find((s) => subjectMatches(s.subject, req.subject));
      const met = !!userSubj && parseInt(userSubj.mark, 10) >= req.minMark;
      return {
        label: `${req.subject} ≥${req.minMark}%`,
        met,
        userMark: userSubj ? parseInt(userSubj.mark, 10) : null,
      };
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
        <p className="text-gray-600 text-lg">Loading courses...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 gap-4">
        <p className="text-red-600 font-medium">Something went wrong: {error}</p>
        <button onClick={() => navigate("/enter-marks")} className="bg-purple-600 text-white px-6 py-2 rounded-xl">
          Go Back
        </button>
      </div>
    );
  }

  const CourseCard = ({ course, colorScheme }) => {
    const { score: uniScore, label: uniLabel } = getUniAps(course.institution);
    const keyStatus = getKeySubjectStatus(course.keySubjects);
    const isGreen = colorScheme === "green";

    return (
      <div className={`${isGreen ? "bg-green-50" : "bg-blue-50"} p-5 rounded-xl shadow hover:shadow-md transition`}>
        <h3 className={`text-base font-bold mb-1 ${isGreen ? "text-green-800" : "text-purple-800"}`}>
          {course.courseName}
        </h3>
        <p className="text-gray-700 text-sm">Faculty: {course.faculty}</p>
        <p className="text-gray-700 text-sm">Institution: {course.institution}</p>
        <p className="text-gray-700 text-sm">Duration: {course.duration}</p>
        <p className="text-gray-700 text-sm">Qualification: {course.qualificationType}</p>
        <p className="text-gray-500 text-xs mt-1">Code: {course.qualificationCode || "—"}</p>
        <p className="text-gray-500 text-xs">Min APS: {course.minAPS}</p>
        <p className={`text-xs font-medium mt-1 ${isGreen ? "text-green-600" : "text-purple-600"}`}>
          Your score: {uniScore} <span className="text-gray-400 font-normal">({uniLabel})</span>
        </p>
        {keyStatus.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {keyStatus.map((req, i) => (
              <p key={i} className={`text-xs flex items-center gap-1 ${req.met ? "text-green-600" : "text-red-500"}`}>
                {req.met ? "✓" : "✗"} {req.label}
                {!req.met && req.userMark !== null && (
                  <span className="text-gray-400">(you have {req.userMark}%)</span>
                )}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col items-center p-6">
      <div className="w-full max-w-5xl bg-white shadow-xl rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-1">Your Qualifying Courses</h1>
        <p className="text-center text-gray-500 mb-6">
          Your APS: <span className="font-bold text-gray-900">{generalAps}</span>
          <span className="text-xs text-gray-400 ml-2">(per-university scores used for eligibility)</span>
        </p>

        {/* Search */}
        <input
          type="text"
          placeholder="Search for a course..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full mb-4 p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <select value={selectedFaculty} onChange={(e) => setSelectedFaculty(e.target.value)}
            className="p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400">
            <option value="">All Faculties</option>
            {[...new Set(allQualified.map((c) => c.faculty))].sort().map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select value={selectedInstitution} onChange={(e) => setSelectedInstitution(e.target.value)}
            className="p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400">
            <option value="">All Institutions</option>
            {[...new Set(allQualified.map((c) => c.institution))].sort().map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <select value={selectedQualification} onChange={(e) => setSelectedQualification(e.target.value)}
            className="p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400">
            <option value="">All Qualifications</option>
            {[...new Set(allQualified.map((c) => c.qualificationType))].sort().map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        <button onClick={() => { setSearchTerm(""); setSelectedFaculty(""); setSelectedInstitution(""); setSelectedQualification(""); }}
          className="bg-gray-100 text-gray-700 py-2 px-4 rounded-xl hover:bg-gray-200 transition text-sm mb-4">
          Reset Filters
        </button>

        <p className="text-gray-500 text-sm mb-6">
          Showing <span className="font-bold text-gray-900">{displayedNormal.length}</span> of{" "}
          <span className="font-bold text-gray-900">{totalUnlocked}</span> unlocked courses
        </p>

        {/* Standard Entry Courses */}
        {filteredNormal.length > 0 && (
          <>
            <h2 className="text-2xl font-semibold text-purple-700 mb-4">Standard Entry Courses</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {displayedNormal.map((course, idx) => (
                <CourseCard key={idx} course={course} colorScheme="blue" />
              ))}
            </div>
            {!showFullResults && filteredNormal.length > 3 && (
              <div className="text-center mt-6">
                <p className="text-sm text-gray-500 mb-2">Want to see more courses?</p>
                <button onClick={() => setShowFullResults(true)}
                  className="bg-yellow-500 text-white px-5 py-2 rounded-xl font-semibold hover:bg-yellow-600 transition">
                  Watch Ad to Unlock
                </button>
              </div>
            )}
          </>
        )}

        {/* Extended Degrees */}
        {filteredExtended.length > 0 && showFullResults && (
          <>
            <h2 className="text-2xl font-semibold text-green-700 mb-4 mt-8">Extended Degrees (Lower APS Entry)</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredExtended.map((course, idx) => (
                <CourseCard key={idx} course={course} colorScheme="green" />
              ))}
            </div>
          </>
        )}

        {filteredNormal.length === 0 && filteredExtended.length === 0 && (
          <p className="text-center text-gray-500 mt-6">No courses match your APS or subject results.</p>
        )}

        <button onClick={() => navigate("/enter-marks")}
          className="mt-8 w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold shadow-md transition">
          Back to Marks Entry
        </button>
      </div>
    </div>
  );
}