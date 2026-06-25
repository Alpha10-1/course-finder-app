import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { convertMarkToAPS } from "../utils/marksToAPS";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

const SUBJECTS = [
  "Accounting",
  "Business Studies",
  "Consumer Studies",
  "Economics",
  "Engineering Graphics and Design",
  "English",
  "Geography",
  "History",
  "Information Technology",
  "Life Orientation",
  "Life Sciences",
  "Mathematical Literacy",
  "Mathematics",
  "Physical Sciences",
  "Tourism",
  "Visual Arts",
];

export default function EnterMarks() {
  const [rows, setRows] = useState([
    { subject: "Accounting", mark: "" },
    { subject: "Business Studies", mark: "" },
    { subject: "Consumer Studies", mark: "" },
    { subject: "English", mark: "" },
    { subject: "Geography", mark: "" },
    { subject: "Life Orientation", mark: "" },
    { subject: "Mathematics", mark: "" },
    { subject: "Physical Sciences", mark: "" },
  ]);

  const [aps, setAps] = useState(null);
  const navigate = useNavigate();

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

  const calculateAPS = () => {
    const filled = rows.filter((r) => r.mark !== "");
    const total = filled.reduce((sum, r) => {
      return sum + convertMarkToAPS(parseInt(r.mark, 10));
    }, 0);
    setAps(total);
    return { total, filled };
  };

  const handleCalculate = (e) => {
    e.preventDefault();
    calculateAPS();
  };

  const handleViewCourses = async () => {
    const { total, filled } = calculateAPS();
    const subjects = filled.map((r) => ({
      subject: r.subject,
      mark: r.mark,
    }));

    // Save to Firestore
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex items-start justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-2xl mt-6">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Enter Your Subject Marks
        </h1>

        <form onSubmit={handleCalculate} className="space-y-3">
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