import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { calculateGeneralAPS } from "../utils/marksToAPS";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const SUBJECTS = [
    "Afrikaans Home Language",
    "Afrikaans First Additional Language",
    "English Home Language",
    "English First Additional Language",
    "isiNdebele Home Language",
    "isiNdebele First Additional Language",
    "isiXhosa Home Language",
    "isiXhosa First Additional Language",
    "isiZulu Home Language",
    "isiZulu First Additional Language",
    "Sepedi Home Language",
    "Sepedi First Additional Language",
    "Sesotho Home Language",
    "Sesotho First Additional Language",
    "Setswana Home Language",
    "Setswana First Additional Language",
    "Siswati Home Language",
    "Siswati First Additional Language",
    "South African Sign Language Home Language",
    "South African Sign Language First Additional Language",
    "Tshivenda Home Language",
    "Tshivenda First Additional Language",
    "Xitsonga Home Language",
    "Xitsonga First Additional Language",
    "Accounting",
    "Agricultural Management Practices",
    "Agricultural Sciences",
    "Agricultural Technology",
    "Business Studies",
    "CAT (Computer Applications Technology)",
    "Civil Technology",
    "Consumer Studies",
    "Dance Studies",
    "Design",
    "Dramatic Arts",
    "Economics",
    "Electrical Technology",
    "Engineering Graphics and Design",
    "Geography",
    "History",
    "Hospitality Studies",
    "IT (Information Technology)",
    "Life Orientation",
    "Life Sciences",
    "Marine Sciences",
    "Maritime Economics",
    "Mathematical Literacy",
    "Mathematics",
    "Mechanical Technology",
    "Music",
    "Physical Sciences",
    "Religion Studies",
    "Technical Mathematics",
    "Technical Science",
    "Tourism",
    "Visual Arts",
];

const DEFAULT_ROWS = [
  { subject: "English Home Language", mark: "" },
  { subject: "Mathematics", mark: "" },
  { subject: "Life Orientation", mark: "" },
  { subject: "Accounting", mark: "" },
  { subject: "Business Studies", mark: "" },
  { subject: "Geography", mark: "" },
  { subject: "Physical Sciences", mark: "" },
];

// ── Grade / status options ────────────────────────────────────────────────────
const GRADES = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"];

// Which institution types a user can access based on grade + status
function getAccessLevel(grade, status) {
  if (!grade || !status) return null;

  const gradeNum = parseInt(grade.replace("Grade ", ""), 10);

  if (status === "completed") {
    if (gradeNum <= 11) return "colleges_only";
    return "all"; // Grade 12 completed
  }

  if (status === "current") {
    if (gradeNum <= 11) return "colleges_only";
    // Grade 12 currently enrolled
    return "grade12_current";
  }

  return null;
}

const inputCls = "w-full p-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-800";

// ── Mark-edit restriction rules ───────────────────────────────────────────────
// Users get MAX_MARK_EDITS "real" edits. An edit only counts against that limit
// when it changes MORE than FREE_CHANGE_LIMIT subjects at once (changing up to
// FREE_CHANGE_LIMIT subjects — e.g. fixing a typo — is always free and doesn't
// need confirmation). Comparison is done by subject name so reordering rows
// doesn't falsely count as a change.
const MAX_MARK_EDITS = 2;
const FREE_CHANGE_LIMIT = 3;

function countChangedSubjects(baseline, current) {
  const baseMap = new Map(baseline.map((s) => [s.subject, String(s.mark)]));
  const curMap = new Map(current.map((s) => [s.subject, String(s.mark)]));
  const allKeys = new Set([...baseMap.keys(), ...curMap.keys()]);
  let changed = 0;
  for (const key of allKeys) {
    if (baseMap.get(key) !== curMap.get(key)) changed++;
  }
  return changed;
}

export default function EnterMarks() {
  // ── Grade / status step ────────────────────────────────────────────────────
  const [step,        setStep]        = useState("grade"); // "grade" | "marks"
  const [grade,       setGrade]       = useState("");
  const [status,      setStatus]      = useState(""); // "current" | "completed"
  const [marksSource, setMarksSource] = useState(""); // "gr11" | "gr12june" (grade12_current only)
  const [accessLevel, setAccessLevel] = useState(null);

  // ── Marks step ────────────────────────────────────────────────────────────
  const [rows,      setRows]      = useState(DEFAULT_ROWS);
  const [aps,       setAps]       = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [restored,  setRestored]  = useState(false);

  // ── Mark-edit restriction state ───────────────────────────────────────────
  const [savedSubjects, setSavedSubjects] = useState([]); // last committed snapshot from Firestore
  const [editCount,     setEditCount]     = useState(0);  // "real" edits used so far
  const [confirmState,  setConfirmState]  = useState(null); // { subjects, total, changedCount } | null
  const [lockedNotice,  setLockedNotice]  = useState(false);
  const [saving,        setSaving]        = useState(false);

  const navigate = useNavigate();

  // Load saved marks + grade info from Firestore on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, "users", user.uid));
          if (snap.exists()) {
            const data = snap.data();
            if (data.grade)      setGrade(data.grade);
            if (data.gradeStatus) setStatus(data.gradeStatus);
            if (data.marksSource) setMarksSource(data.marksSource);
            if (data.grade && data.gradeStatus) {
              const al = getAccessLevel(data.grade, data.gradeStatus);
              setAccessLevel(al);
              // Skip grade step if already saved
              setStep("marks");
            }
            if (data.subjects && data.subjects.length > 0) {
              setRows(data.subjects.map((s) => ({
                subject: s.subject,
                mark: (s.mark !== undefined && s.mark !== null) ? String(s.mark) : "",
              })));
              setRestored(true);
              setSavedSubjects(data.subjects);
            }
            setEditCount(typeof data.marksEditCount === "number" ? data.marksEditCount : 0);
          }
        } catch (err) {
          console.error("Error loading saved data:", err);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── Grade step handlers ───────────────────────────────────────────────────
  const handleGradeConfirm = () => {
    if (!grade || !status) return;
    if (status === "current" && grade === "Grade 12" && !marksSource) return;
    const al = getAccessLevel(grade, status);
    setAccessLevel(al);
    setStep("marks");
  };

  const handleGradeChange = () => {
    setStep("grade");
    setAps(null);
  };

  // ── Marks handlers ────────────────────────────────────────────────────────
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

  const addRow    = () => { setRows([...rows, { subject: SUBJECTS[0], mark: "" }]); setAps(null); };
  const removeRow = (i) => { setRows(rows.filter((_, idx) => idx !== i)); setAps(null); };

  const getFilledSubjects = () =>
    rows.filter((r) => {
      const v = String(r.mark ?? "").trim();
      return v !== "" && !isNaN(Number(v));
    }).map((r) => ({ subject: r.subject, mark: parseInt(r.mark, 10) }));

  const handleCalculate = (e) => {
    e.preventDefault();
    const subjects = getFilledSubjects();
    setAps(calculateGeneralAPS(subjects));
  };

  // Actually writes to Firestore (and navigates). newEditCount is only bumped
  // when this save consumed one of the user's limited "real" edits.
  const commitSave = async (subjects, total, newEditCount) => {
    setSaving(true);
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), {
          subjects,
          aps: total,
          grade,
          gradeStatus: status,
          marksSource: marksSource || null,
          accessLevel,
          marksEditCount: newEditCount,
        }, { merge: true });
      } catch (err) {
        console.error("Error saving:", err);
      }
    }
    setSavedSubjects(subjects);
    setEditCount(newEditCount);
    setSaving(false);
    navigate("/results", { state: { subjects, aps: total, grade, gradeStatus: status, marksSource, accessLevel } });
  };

  const handleViewCourses = async () => {
    const subjects = getFilledSubjects();
    const total = calculateGeneralAPS(subjects);
    const changedCount = countChangedSubjects(savedSubjects, subjects);

    // Nothing changed since the last save — just continue, no save needed.
    if (changedCount === 0) {
      navigate("/results", { state: { subjects, aps: total, grade, gradeStatus: status, marksSource, accessLevel } });
      return;
    }

    // Small touch-ups (up to FREE_CHANGE_LIMIT subjects) are always free —
    // no confirmation, doesn't use up an edit.
    if (changedCount <= FREE_CHANGE_LIMIT) {
      await commitSave(subjects, total, editCount);
      return;
    }

    // A "real" edit (more than FREE_CHANGE_LIMIT subjects changed at once).
    if (editCount >= MAX_MARK_EDITS) {
      setLockedNotice(true);
      return;
    }

    // Ask for confirmation before using up one of the limited edits.
    setConfirmState({ subjects, total, changedCount });
  };

  const handleConfirmEdit = async () => {
    if (!confirmState) return;
    const { subjects, total } = confirmState;
    setConfirmState(null);
    await commitSave(subjects, total, editCount + 1);
  };

  const handleCancelEdit = () => setConfirmState(null);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
      <p className="text-gray-600">Loading your marks...</p>
    </div>
  );

  // ── Step 1: Grade & Status ────────────────────────────────────────────────
  if (step === "grade") return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex items-center justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">📚</div>
          <h1 className="text-2xl font-bold text-gray-900">Your Education Level</h1>
          <p className="text-gray-500 text-sm mt-1">This helps us show you the right courses</p>
        </div>

        {/* Grade selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Which grade are you entering marks for?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {GRADES.map((g) => (
              <button
                key={g} type="button"
                onClick={() => { setGrade(g); setStatus(""); setMarksSource(""); }}
                className={`py-3 rounded-xl border-2 font-medium text-sm transition ${
                  grade === g
                    ? "border-purple-600 bg-purple-50 text-purple-700"
                    : "border-gray-200 text-gray-600 hover:border-purple-300"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          {grade && parseInt(grade.replace("Grade ", "")) < 9 && (
            <p className="text-xs text-red-500 mt-2">Minimum grade is Grade 9.</p>
          )}
        </div>

        {/* Status selector */}
        {grade && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Are you currently in {grade} or have you completed it?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setStatus("current"); setMarksSource(""); }}
                className={`py-3 rounded-xl border-2 font-medium text-sm transition ${
                  status === "current"
                    ? "border-purple-600 bg-purple-50 text-purple-700"
                    : "border-gray-200 text-gray-600 hover:border-purple-300"
                }`}>
                Currently in {grade}
              </button>
              <button type="button" onClick={() => { setStatus("completed"); setMarksSource(""); }}
                className={`py-3 rounded-xl border-2 font-medium text-sm transition ${
                  status === "completed"
                    ? "border-purple-600 bg-purple-50 text-purple-700"
                    : "border-gray-200 text-gray-600 hover:border-purple-300"
                }`}>
                Completed {grade}
              </button>
            </div>
          </div>
        )}

        {/* Grade 12 current — marks source */}
        {grade === "Grade 12" && status === "current" && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Which results will you be using?
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Most universities evaluate Grade 11 results for Grade 12 learners. You can also use your Grade 12 June results.
            </p>
            <div className="space-y-2">
              <button type="button" onClick={() => setMarksSource("gr11")}
                className={`w-full py-3 px-4 rounded-xl border-2 text-left transition ${
                  marksSource === "gr11"
                    ? "border-purple-600 bg-purple-50"
                    : "border-gray-200 hover:border-purple-300"
                }`}>
                <p className={`font-medium text-sm ${marksSource === "gr11" ? "text-purple-700" : "text-gray-800"}`}>
                  Grade 11 results <span className="text-xs text-purple-500 font-normal ml-1">Recommended</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Used by most universities for provisional admission</p>
              </button>
              <button type="button" onClick={() => setMarksSource("gr12june")}
                className={`w-full py-3 px-4 rounded-xl border-2 text-left transition ${
                  marksSource === "gr12june"
                    ? "border-purple-600 bg-purple-50"
                    : "border-gray-200 hover:border-purple-300"
                }`}>
                <p className={`font-medium text-sm ${marksSource === "gr12june" ? "text-purple-700" : "text-gray-800"}`}>
                  Grade 12 June results
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Some universities accept mid-year results</p>
              </button>
            </div>
          </div>
        )}

        {/* Access level preview */}
        {grade && status && (grade !== "Grade 12" || status !== "current" || marksSource) && (() => {
          const al = getAccessLevel(grade, status);
          return (
            <div className={`rounded-xl p-4 text-sm ${
              al === "colleges_only" ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"
            }`}>
              {al === "colleges_only" && (
                <>
                  <p className="font-semibold text-yellow-800">🏫 College courses available</p>
                  <p className="text-yellow-700 text-xs mt-1">
                    Your grade qualifies you for college courses. Complete Grade 12 to unlock university courses.
                  </p>
                </>
              )}
              {(al === "all" || al === "grade12_current") && (
                <>
                  <p className="font-semibold text-green-800">🎓 Universities & Colleges available</p>
                  <p className="text-green-700 text-xs mt-1">
                    {al === "grade12_current" && marksSource === "gr11"
                      ? "Using Grade 11 results — universities will do a final evaluation with your matric results."
                      : "You qualify to browse both university and college courses."}
                  </p>
                </>
              )}
            </div>
          );
        })()}

        <button
          onClick={handleGradeConfirm}
          disabled={!grade || !status || (grade === "Grade 12" && status === "current" && !marksSource)}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-40"
        >
          Continue →
        </button>
      </div>
    </div>
  );

  // ── Step 2: Enter Marks ───────────────────────────────────────────────────
  const gradeLabel = status === "current" && grade === "Grade 12"
    ? (marksSource === "gr11" ? "Grade 11" : "Grade 12 June")
    : grade;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex items-start justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-2xl mt-6">

        <h1 className="text-2xl font-bold text-center text-gray-900 mb-1">
          Enter Your Subject Marks
        </h1>

        {/* Grade context banner */}
        <div className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 mb-4">
          <div>
            <span className="text-xs text-gray-500">Entering marks for: </span>
            <span className="text-sm font-semibold text-purple-700">{gradeLabel} results</span>
            {accessLevel === "colleges_only" && (
              <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Colleges only</span>
            )}
            {(accessLevel === "all" || accessLevel === "grade12_current") && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Universities & Colleges</span>
            )}
          </div>
          <button onClick={handleGradeChange} className="text-xs text-purple-600 hover:underline">
            Change
          </button>
        </div>

        {restored && (
          <p className="text-center text-green-600 text-sm mb-4">✓ Your previous marks have been restored</p>
        )}

        {savedSubjects.length > 0 && (
          <p className={`text-center text-xs mb-4 ${editCount >= MAX_MARK_EDITS ? "text-red-500" : "text-gray-400"}`}>
            {editCount >= MAX_MARK_EDITS
              ? `You've used all ${MAX_MARK_EDITS} major mark edits. You can still fix up to ${FREE_CHANGE_LIMIT} subjects at a time.`
              : `Major edits remaining: ${MAX_MARK_EDITS - editCount} of ${MAX_MARK_EDITS} (changing up to ${FREE_CHANGE_LIMIT} subjects at once is always free)`}
          </p>
        )}

        <form onSubmit={handleCalculate} className="space-y-3 mt-2">
          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="relative flex-1">
                <select value={row.subject} onChange={(e) => handleSubjectChange(index, e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-800">
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▾</div>
              </div>
              <input type="number" value={row.mark}
                onChange={(e) => handleMarkChange(index, e.target.value)}
                min="0" max="100" placeholder="Mark"
                className="w-24 p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-800"
              />
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(index)}
                  className="text-red-400 hover:text-red-600 font-bold text-lg px-1">✕</button>
              )}
            </div>
          ))}

          <button type="button" onClick={addRow}
            className="text-purple-600 hover:text-purple-800 text-sm font-medium mt-1">
            + Add subject
          </button>

          <button type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold shadow-md transition mt-4">
            Calculate APS
          </button>
        </form>

        {aps !== null && (
          <>
            <p className="text-center text-purple-700 font-bold text-xl mt-5">Your APS: {aps}</p>
            <p className="text-center text-gray-400 text-xs mt-1">
              General APS (best 6 subjects, LO excluded) — per-institution scores calculated on results page
            </p>
            <button onClick={handleViewCourses} disabled={saving}
              className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold shadow-md transition disabled:opacity-50">
              {saving ? "Saving..." : "View Courses"}
            </button>
          </>
        )}
      </div>

      {/* Confirm-edit modal (shown before edit #1 and edit #2) */}
      {confirmState && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Are you sure?</h2>
            <p className="text-sm text-gray-600 mb-4">
              You're changing {confirmState.changedCount} subjects. Please confirm your marks are
              accurate — this will be edit {editCount + 1} of {MAX_MARK_EDITS}.
              {editCount + 1 >= MAX_MARK_EDITS
                ? " After this, you won't be able to make further major changes."
                : ` You'll have ${MAX_MARK_EDITS - (editCount + 1)} edit remaining after this.`}
            </p>
            <div className="flex gap-3">
              <button onClick={handleCancelEdit}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition">
                Go back
              </button>
              <button onClick={handleConfirmEdit} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition disabled:opacity-50">
                {saving ? "Saving..." : "Yes, I'm sure"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Locked-out modal (shown once both edits are used up) */}
      {lockedNotice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Edit limit reached</h2>
            <p className="text-sm text-gray-600 mb-4">
              You've already used your {MAX_MARK_EDITS} major mark edits, so this change (more than{" "}
              {FREE_CHANGE_LIMIT} subjects) can't be saved. You can still fix up to {FREE_CHANGE_LIMIT}{" "}
              subjects at a time, or contact support if you need further changes.
            </p>
            <button onClick={() => setLockedNotice(false)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium transition">
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}