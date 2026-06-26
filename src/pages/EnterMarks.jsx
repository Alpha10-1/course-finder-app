import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { calculateGeneralAPS } from "../utils/marksToAPS";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const SUBJECTS = [
  "Accounting",
  "Afrikaans Home Language",
  "Afrikaans First Additional Language",
  "Business Studies",
  "CAT (Computer Applications Technology)",
  "Consumer Studies",
  "Economics",
  "Engineering Graphics and Design",
  "English Home Language",
  "English First Additional Language",
  "Geography",
  "History",
  "IT (Information Technology)",
  "Life Orientation",
  "Life Sciences",
  "Mathematical Literacy",
  "Mathematics",
  "Physical Sciences",
  "Tourism",
  "Visual Arts",
];

const DEFAULT_ROWS = [
  { subject: "Accounting", mark: "" },
  { subject: "Business Studies", mark: "" },
  { subject: "Consumer Studies", mark: "" },
  { subject: "English Home Language", mark: "" },
  { subject: "Geography", mark: "" },
  { subject: "Life Orientation", mark: "" },
  { subject: "Mathematics", mark: "" },
  { subject: "Physical Sciences", mark: "" },
];

export default function EnterMarks() {
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [aps, setAps] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restored, setRestored] = useState(false);
  const navigate = useNavigate();

  // Load saved marks from Firestore on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            const data = snap.data();
            if (data.subjects && data.subjects.length > 0) {
              setRows(data.subjects.map((s) => ({
                subject: s.subject,
                mark: (s.mark !== undefined && s.mark !== null) ? String(s.mark) : "",
              })));
              setRestored(true);
            }
          }
        } catch (err) {
          console.error("Error loading saved marks:", err);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubjectChange = (index, value) => {
    const updated = [...rows];
    updated[index].subject = value;
    setRows(updated);
    setAps(null);
  };

  const handleMarkChange = (index, value) => {
    const updated = [...rows];
    updated[index].mark = value;
    setRows(updated);
    setAps(null);
  };

  const addRow = () => {
    setRows([...rows, { subject: SUBJECTS[0], mark: "" }]);
    setAps(null);
  };

  const removeRow = (index) => {
    setRows(rows.filter((_, i) => i !== index));
    setAps(null);
  };

  const getFilledSubjects = () =>
    rows
      .filter((r) => {
        const v = String(r.mark ?? "").trim();
        return v !== "" && !isNaN(Number(v));
      })
      .map((r) => ({ subject: r.subject, mark: parseInt(r.mark, 10) }));

  const handleCalculate = (e) => {
    e.preventDefault();
    const subjects = getFilledSubjects();
    const total = calculateGeneralAPS(subjects);
    setAps(total);
  };

  const handleViewCourses = async () => {
    const subjects = getFilledSubjects();
    const total = calculateGeneralAPS(subjects);

    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), { subjects, aps: total }, { merge: true });
      } catch (err) {
        console.error("Error saving:", err);
      }
    }

    navigate("/results", { state: { subjects, aps: total } });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
        <p className="text-gray-600">Loading your marks...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex items-start justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-2xl mt-6">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">
          Enter Your Subject Marks
        </h1>

        {restored && (
          <p className="text-center text-green-600 text-sm mb-4">
            ✓ Your previous marks have been restored
          </p>
        )}

        <form onSubmit={handleCalculate} className="space-y-3 mt-4">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={row.subject}
                  onChange={(e) => handleSubjectChange(index, e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-800"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▾</div>
              </div>
              <input
                type="number"
                value={row.mark}
                onChange={(e) => handleMarkChange(index, e.target.value)}
                min="0"
                max="100"
                placeholder="Mark"
                className="w-24 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-800"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="text-red-400 hover:text-red-600 font-bold text-lg px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className="text-purple-600 hover:text-purple-800 text-sm font-medium mt-1"
          >
            + Add subject
          </button>

          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold shadow-md transition mt-4"
          >
            Calculate APS
          </button>
        </form>

        {aps !== null && (
          <>
            <p className="text-center text-purple-700 font-bold text-xl mt-5">
              Your APS: {aps}
            </p>
            <p className="text-center text-gray-400 text-xs mt-1">
              General APS (best 6 subjects, LO excluded) — per-university scores calculated on results page
            </p>
            <button
              onClick={handleViewCourses}
              className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold shadow-md transition"
            >
              View Courses
            </button>
          </>
        )}
      </div>
    </div>
  );
}