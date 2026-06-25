import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { convertMarkToAPS } from "../utils/marksToAPS";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import coursesData from "../data/courses.json";

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();

  const [allQualified, setAllQualified] = useState([]);
  const [normalCourses, setNormalCourses] = useState([]);
  const [extendedCourses, setExtendedCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [selectedQualification, setSelectedQualification] = useState("");
  const [aps, setAps] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const [showFullResults, setShowFullResults] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      let loadedSubjects = [];
      let loadedAps = 0;

      if (location.state?.subjects && location.state?.aps !== undefined) {
        loadedSubjects = location.state.subjects;
        loadedAps = location.state.aps;
      } else {
        const user = auth.currentUser;
        if (user) {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            const data = snap.data();
            loadedSubjects = data.subjects || [];
            loadedAps = data.aps || 0;
          }
        }
      }

      setSubjects(loadedSubjects);
      setAps(loadedAps);

      const qualified = coursesData.filter((course) => {
        if (loadedAps < course.minAPS) return false;
        if (!course.keySubjects || course.keySubjects.length === 0) return true;

        return course.keySubjects.every((req) => {
          if (req.subjectGroup) {
            return req.subjectGroup.some((opt) =>
              loadedSubjects.some(
                (s) =>
                  s.subject.toLowerCase() === opt.subject.toLowerCase() &&
                  parseInt(s.mark, 10) >= opt.minMark
              )
            );
          }
          return loadedSubjects.some(
            (s) =>
              s.subject.toLowerCase() === req.subject.toLowerCase() &&
              parseInt(s.mark, 10) >= req.minMark
          );
        });
      });

      setAllQualified(qualified);
      setNormalCourses(qualified.filter((c) => c.qualificationType !== "Bachelor Extended"));
      setExtendedCourses(qualified.filter((c) => c.qualificationType === "Bachelor Extended"));
      setLoading(false);
    };

    init();
  }, []);

  const applyFilters = (courses) =>
    courses.filter(
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
      if (!seen.has(c.institution)) {
        seen.add(c.institution);
        result.push(c);
      }
      if (result.length === 3) break;
    }
    return result;
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedFaculty("");
    setSelectedInstitution("");
    setSelectedQualification("");
  };

  const filteredNormal = applyFilters(normalCourses);
  const filteredExtended = applyFilters(extendedCourses);
  const displayedNormal = showFullResults ? filteredNormal : getLimited(filteredNormal);
  const totalUnlocked = filteredNormal.length + filteredExtended.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
        <p className="text-gray-600 text-lg">Loading courses...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col items-center p-6">
      <div className="w-full max-w-5xl bg-white shadow-xl rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-1">
          Your Qualifying Courses
        </h1>
        <p className="text-center text-gray-500 mb-6">
          Your APS: <span className="font-bold text-gray-900">{aps}</span>
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
          <select
            value={selectedFaculty}
            onChange={(e) => setSelectedFaculty(e.target.value)}
            className="p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">All Faculties</option>
            {[...new Set(allQualified.map((c) => c.faculty))].sort().map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select
            value={selectedInstitution}
            onChange={(e) => setSelectedInstitution(e.target.value)}
            className="p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">All Institutions</option>
            {[...new Set(allQualified.map((c) => c.institution))].sort().map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <select
            value={selectedQualification}
            onChange={(e) => setSelectedQualification(e.target.value)}
            className="p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <option value="">All Qualifications</option>
            {[...new Set(allQualified.map((c) => c.qualificationType))].sort().map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        <button
          onClick={resetFilters}
          className="bg-gray-100 text-gray-700 py-2 px-4 rounded-xl hover:bg-gray-200 transition text-sm mb-4"
        >
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
                <div
                  key={idx}
                  className="bg-blue-50 p-5 rounded-xl shadow hover:shadow-md transition"
                >
                  <h3 className="text-base font-bold text-purple-800 mb-1">{course.courseName}</h3>
                  <p className="text-gray-700 text-sm">Faculty: {course.faculty}</p>
                  <p className="text-gray-700 text-sm">Institution: {course.institution}</p>
                  <p className="text-gray-700 text-sm">Duration: {course.duration}</p>
                  <p className="text-gray-700 text-sm">Qualification: {course.qualificationType}</p>
                  <p className="text-gray-500 text-xs mt-1">Code: {course.qualificationCode || ""}</p>
                  <p className="text-gray-500 text-xs">Min APS: {course.minAPS}</p>
                </div>
              ))}
            </div>

            {!showFullResults && filteredNormal.length > 3 && (
              <div className="text-center mt-6">
                <p className="text-sm text-gray-500 mb-2">Want to see more courses?</p>
                <button
                  onClick={() => setShowFullResults(true)}
                  className="bg-yellow-500 text-white px-5 py-2 rounded-xl font-semibold hover:bg-yellow-600 transition"
                >
                  Watch Ad to Unlock
                </button>
              </div>
            )}
          </>
        )}

        {/* Extended Degrees */}
        {filteredExtended.length > 0 && showFullResults && (
          <>
            <h2 className="text-2xl font-semibold text-green-700 mb-4 mt-8">
              Extended Degrees (Lower APS Entry)
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredExtended.map((course, idx) => (
                <div key={idx} className="bg-green-50 p-5 rounded-xl shadow hover:shadow-md transition">
                  <h3 className="text-base font-bold text-green-800 mb-1">{course.courseName}</h3>
                  <p className="text-gray-700 text-sm">Faculty: {course.faculty}</p>
                  <p className="text-gray-700 text-sm">Institution: {course.institution}</p>
                  <p className="text-gray-700 text-sm">Duration: {course.duration}</p>
                  <p className="text-gray-700 text-sm">Qualification: {course.qualificationType}</p>
                  <p className="text-gray-500 text-xs mt-1">Code: {course.qualificationCode || ""}</p>
                  <p className="text-gray-500 text-xs">Min APS: {course.minAPS}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {filteredNormal.length === 0 && filteredExtended.length === 0 && (
          <p className="text-center text-gray-500 mt-6">No courses match your APS or subject results.</p>
        )}

        <button
          onClick={() => navigate("/enter-marks")}
          className="mt-8 w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold shadow-md transition"
        >
          Back to Marks Entry
        </button>
      </div>
    </div>
  );
}