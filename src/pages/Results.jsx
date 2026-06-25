import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { convertMarkToAPS } from "../utils/marksToAPS";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const normalizeSubject = (subject) => {
  return subject.toLowerCase().replace(/\s+/g, "");
};

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();

  const [allCourses, setAllCourses] = useState([]);
  const [normalCourses, setNormalCourses] = useState([]);
  const [extendedCourses, setExtendedCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [selectedQualification, setSelectedQualification] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [aps, setAps] = useState(0);
  const [subjects, setSubjects] = useState([]);
  const [showFullResults, setShowFullResults] = useState(false);

  useEffect(() => {
    const fetchSavedData = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setSubjects(data.subjects || []);
          setAps(data.aps || 0);
          console.log("✅ Loaded saved APS and subjects into Results page");
        }
      }
    };

    fetchSavedData();
    fetch("/courses.json")
      .then((res) => res.json())
      .then((data) => {
        const subjectsWithAPS = subjects.map((s) => ({
          ...s,
          aps: convertMarkToAPS(parseInt(s.mark, 10)),
        }));

        const qualified = data.filter((course) => {
          if (aps < course.minAPS) return false;

          if (!course.keySubjects || course.keySubjects.length === 0) return true;

          const keyPass = course.keySubjects.every((req) => {
            const userHasSubject = Array.isArray(req.subject)
              ? req.subject.some((subj) =>
                  subjects.some(
                    (s) =>
                      s.subject.toLowerCase() === subj.toLowerCase() &&
                      parseInt(s.mark, 10) >= req.minMark
                  )
                )
              : subjects.some(
                  (s) =>
                    s.subject.toLowerCase() === req.subject.toLowerCase() &&
                    parseInt(s.mark, 10) >= req.minMark
                );

            return userHasSubject;
          });

          return keyPass;
        });

        const normal = qualified.filter((c) => c.qualificationType !== "Bachelor Extended");
        const extended = qualified.filter((c) => c.qualificationType === "Bachelor Extended");

        setAllCourses(qualified);
        setNormalCourses(normal);
        setExtendedCourses(extended);
      })
      .catch((err) => console.error("Error fetching courses:", err));
  }, [aps, subjects]);

  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setSearchTerm(value);

    const filtered = allCourses.filter((course) =>
      course.courseName.toLowerCase().includes(value)
    );

    const normal = filtered.filter((course) => course.qualificationType !== "Bachelor Extended");
    const extended = filtered.filter((course) => course.qualificationType === "Bachelor Extended");

    setNormalCourses(normal);
    setExtendedCourses(extended);
  };

  const handleBack = () => {
    navigate("/enter-marks");
  };

  const handleWatchAd = () => {
    alert("Thanks for watching the ad! More courses unlocked.");
    setShowFullResults(true);
  };

  const getLimitedCourses = (courses) => {
    const institutions = new Set();
    const limited = [];

    for (const course of courses) {
      if (!institutions.has(course.institution)) {
        institutions.add(course.institution);
        limited.push(course);
      }
      if (limited.length === 3) break;
    }

    return limited;
  };

  const filteredNormalCourses = normalCourses
    .filter(
      (course) =>
        (selectedInstitution === "" || course.institution === selectedInstitution) &&
        (selectedQualification === "" || course.qualificationType === selectedQualification) &&
        (selectedFaculty === "" || course.faculty === selectedFaculty)
    );

  const filteredExtendedCourses = extendedCourses
    .filter(
      (course) =>
        (selectedInstitution === "" || course.institution === selectedInstitution) &&
        (selectedQualification === "" || course.qualificationType === selectedQualification) &&
        (selectedFaculty === "" || course.faculty === selectedFaculty)
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col items-center p-6">
      <div className="w-full max-w-5xl bg-white shadow-xl rounded-2xl p-6">
        <h1 className="text-3xl font-bold text-center mb-4 text-gray-800">Your Qualifying Courses</h1>
        <p className="text-center text-gray-600 mb-6">Your APS: <span className="font-bold">{aps}</span></p>

        <input
          type="text"
          placeholder="Search for a course..."
          value={searchTerm}
          onChange={handleSearch}
          className="w-full mb-6 p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <select
            value={selectedFaculty}
            onChange={(e) => setSelectedFaculty(e.target.value)}
            className="p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Faculties</option>
            {Array.from(new Set(allCourses.map((c) => c.faculty))).map((fac, idx) => (
              <option key={idx} value={fac}>{fac}</option>
            ))}
          </select>
          <select
            value={selectedInstitution}
            onChange={(e) => setSelectedInstitution(e.target.value)}
            className="p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Institutions</option>
            {Array.from(new Set(allCourses.map((c) => c.institution))).map((inst, idx) => (
              <option key={idx} value={inst}>{inst}</option>
            ))}
          </select>
          <select
            value={selectedQualification}
            onChange={(e) => setSelectedQualification(e.target.value)}
            className="p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Qualifications</option>
            {Array.from(new Set(allCourses.map((c) => c.qualificationType))).map((qual, idx) => (
              <option key={idx} value={qual}>{qual}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setSelectedInstitution("");
            setSelectedQualification("");
            setSelectedFaculty("");
            setSearchTerm("");
          }}
          className="mt-4 bg-gray-200 text-gray-700 py-2 px-4 rounded-xl hover:bg-red-100 hover:text-red-600 transition-all"
        >
          Reset Filters
        </button>

        {/* Normal Degrees */}
        {filteredNormalCourses.length > 0 && (
          <>
            <h2 className="text-2xl font-semibold text-purple-700 mb-4 mt-6">Standard Entry Courses</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {(showFullResults ? filteredNormalCourses : getLimitedCourses(filteredNormalCourses)).map((course, idx) => (
                <div key={idx} className="bg-blue-50 p-4 rounded-xl shadow-md hover:shadow-lg transition-transform transform hover:scale-105">
                  <h2 className="text-lg font-bold text-purple-800">{course.courseName}</h2>
                  <p className="text-gray-700">Faculty: {course.faculty}</p>
                  <p className="text-gray-700">Institution: {course.institution}</p>
                  <p className="text-gray-700">Duration: {course.duration}</p>
                  <p className="text-gray-700">Qualification: {course.qualificationType}</p>
                  <p className="text-gray-500 text-sm">Code: {course.qualificationCode}</p>
                  <p className="text-gray-500 text-sm">Min APS: {course.minAPS}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Unlock Button */}
        {!showFullResults && filteredNormalCourses.length > 3 && (
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600 mb-2">Want to see more courses?</p>
            <button
              onClick={handleWatchAd}
              className="bg-yellow-500 text-white px-4 py-2 rounded-xl font-semibold shadow hover:bg-yellow-600 transition"
            >
              Watch Ad to Unlock
            </button>
          </div>
        )}

        {/* Extended Degrees */}
        {filteredExtendedCourses.length > 0 && showFullResults && (
          <>
            <h2 className="text-2xl font-semibold text-green-700 mb-4 mt-8">Extended Degrees (Lower APS Entry)</h2>
            <div className="grid gap-6 md:grid-cols-2">
              {filteredExtendedCourses.map((course, idx) => (
                <div key={idx} className="bg-green-50 p-4 rounded-xl shadow-md hover:shadow-lg transition-transform transform hover:scale-105">
                  <h2 className="text-lg font-bold text-green-800">{course.courseName}</h2>
                  <p className="text-gray-700">Faculty: {course.faculty}</p>
                  <p className="text-gray-700">Institution: {course.institution}</p>
                  <p className="text-gray-700">Duration: {course.duration}</p>
                  <p className="text-gray-700">Qualification: {course.qualificationType}</p>
                  <p className="text-gray-500 text-sm">Code: {course.qualificationCode}</p>
                  <p className="text-gray-500 text-sm">Min APS: {course.minAPS}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {filteredNormalCourses.length === 0 && filteredExtendedCourses.length === 0 && (
          <p className="text-center text-gray-600 mt-6">No courses match your APS or subject results.</p>
        )}

        <button
          onClick={handleBack}
          className="mt-8 w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl font-semibold shadow-md hover:from-purple-700 hover:to-indigo-700 transition-all"
        >
          Back to Marks Entry
        </button>
      </div>
    </div>
  );
}