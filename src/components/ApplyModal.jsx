import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Selection rounds
// Round 1: pick 1 course per institution (up to 6 institutions)
// Round 2: pick a 2nd choice from each of those 6 institutions
// Round 3: pick a 3rd choice from each of those 6 institutions

export default function ApplyModal({ courses, onClose }) {
  const [round,       setRound]       = useState(1);      // 1, 2, 3
  const [selections,  setSelections]  = useState({});     // { institution: { 1: course, 2: course, 3: course } }
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [existing,    setExisting]    = useState(null);   // previously saved selections

  // Load any existing saved selections
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists() && snap.data().applySelections) {
        const sel = snap.data().applySelections;
        setSelections(sel);
        setExisting(sel);
        // Resume from where they left off
        const institutionsPicked = Object.keys(sel);
        if (institutionsPicked.length === 6) {
          const round2done = institutionsPicked.every((i) => sel[i]?.[2]);
          const round3done = institutionsPicked.every((i) => sel[i]?.[3]);
          if (round3done) setSaved(true);
          else if (round2done) setRound(3);
          else setRound(2);
        }
      }
    });
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────

  // Institutions already chosen in round 1
  const chosenInstitutions = Object.keys(selections);

  // Courses available for current round
  const availableForRound = (r) => {
    if (r === 1) {
      // All qualifying courses, exclude institutions already picked
      return courses.filter((c) => !chosenInstitutions.includes(c.institution));
    }
    // Round 2 & 3: only courses from the 6 chosen institutions,
    // excluding courses already selected in any round for that institution
    return courses.filter((c) => {
      if (!chosenInstitutions.includes(c.institution)) return false;
      const instSels = selections[c.institution] || {};
      const alreadyPicked = Object.values(instSels).map((s) => s.id);
      return !alreadyPicked.includes(c.id);
    });
  };

  const available = availableForRound(round);

  // Group available courses by institution
  const byInstitution = available.reduce((acc, course) => {
    if (!acc[course.institution]) acc[course.institution] = [];
    acc[course.institution].push(course);
    return acc;
  }, {});

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handlePick = (course) => {
    const inst = course.institution;
    setSelections((prev) => ({
      ...prev,
      [inst]: {
        ...(prev[inst] || {}),
        [round]: course,
      },
    }));
  };

  // Check if current round is complete
  const roundComplete = () => {
    if (round === 1) return chosenInstitutions.length === 6;
    return chosenInstitutions.every((inst) => selections[inst]?.[round]);
  };

  const handleNextRound = () => {
    if (round < 3) setRound(round + 1);
  };

  const handleSave = async () => {
    setSaving(true);
    const user = auth.currentUser;
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), {
        applySelections: selections,
        applyStatus: "pending",
        applySubmittedAt: new Date().toISOString(),
      }, { merge: true });
      setSaved(true);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Render: saved/complete ───────────────────────────────────────────────────
  if (saved) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center space-y-5">
        <div className="text-5xl">✅</div>
        <h2 className="text-2xl font-bold text-gray-900">Selections Saved!</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your course selections have been saved. Our team will begin applying to your chosen institutions.
        </p>

        {/* Summary */}
        <div className="text-left space-y-3 max-h-64 overflow-y-auto">
          {Object.entries(selections).map(([inst, choices]) => (
            <div key={inst} className="bg-gray-50 rounded-xl p-3">
              <p className="font-semibold text-gray-800 text-sm truncate">{inst}</p>
              {[1, 2, 3].map((r) => choices[r] && (
                <p key={r} className="text-xs text-gray-500 mt-0.5">
                  <span className="text-purple-600 font-medium">Choice {r}:</span> {choices[r].courseName}
                </p>
              ))}
            </div>
          ))}
        </div>

        <button onClick={onClose}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition">
          Done
        </button>
      </div>
    </div>
  );

  // ── Round header info ────────────────────────────────────────────────────────
  const roundInfo = {
    1: { title: "Pick Your First Choices",     subtitle: `Select 1 course per university (${chosenInstitutions.length}/6 chosen)`,      color: "from-purple-600 to-blue-500" },
    2: { title: "Pick Your Second Choices",    subtitle: "Select a 2nd course from each of your 6 universities",                         color: "from-blue-600 to-teal-500"   },
    3: { title: "Pick Your Third Choices",     subtitle: "Select a 3rd course from each of your 6 universities",                         color: "from-teal-600 to-green-500"  },
  }[round];

  // ── Render: selection UI ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

        {/* Header */}
        <div className={`bg-gradient-to-r ${roundInfo.color} px-6 py-5 rounded-t-2xl`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Round {round} of 3</p>
              <h2 className="text-white text-xl font-bold mt-0.5">{roundInfo.title}</h2>
              <p className="text-white/70 text-sm mt-1">{roundInfo.subtitle}</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white text-2xl leading-none">✕</button>
          </div>

          {/* Round progress */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((r) => (
              <div key={r} className={`flex-1 h-1.5 rounded-full ${r <= round ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">

          {/* Round 1: show all institutions grouped */}
          {round === 1 && Object.keys(byInstitution).length > 0 && (
            Object.entries(byInstitution).map(([inst, instCourses]) => (
              <div key={inst}>
                <p className="font-semibold text-gray-800 text-sm mb-2">{inst}</p>
                <div className="space-y-2">
                  {instCourses.map((course) => (
                    <button key={course.id} onClick={() => handlePick(course)}
                      className="w-full text-left bg-blue-50 hover:bg-purple-50 border border-blue-100 hover:border-purple-300 rounded-xl px-4 py-3 transition">
                      <p className="font-medium text-gray-900 text-sm">{course.courseName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{course.faculty} · Min APS: {course.minAPS} · {course.duration}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Round 1 complete — show chosen summary */}
          {round === 1 && Object.keys(byInstitution).length === 0 && roundComplete() && (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">🎉</div>
              <p className="font-semibold text-gray-800">All 6 universities selected!</p>
              <div className="space-y-2">
                {chosenInstitutions.map((inst) => (
                  <div key={inst} className="bg-purple-50 rounded-xl px-4 py-2 text-left">
                    <p className="text-xs text-gray-500">{inst}</p>
                    <p className="font-medium text-purple-800 text-sm">{selections[inst][1].courseName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Round 2 & 3: show remaining courses per institution */}
          {round > 1 && chosenInstitutions.map((inst) => {
            const picked = selections[inst]?.[round];
            const instCourses = byInstitution[inst] || [];
            if (picked) return (
              <div key={inst} className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500">{inst}</p>
                <p className="font-medium text-green-800 text-sm">✓ {picked.courseName}</p>
              </div>
            );
            return (
              <div key={inst}>
                <p className="font-semibold text-gray-800 text-sm mb-2">{inst}</p>
                {instCourses.length === 0 ? (
                  <p className="text-xs text-gray-400 italic px-2">No other qualifying courses at this institution.</p>
                ) : (
                  <div className="space-y-2">
                    {instCourses.map((course) => (
                      <button key={course.id} onClick={() => handlePick(course)}
                        className="w-full text-left bg-blue-50 hover:bg-purple-50 border border-blue-100 hover:border-purple-300 rounded-xl px-4 py-3 transition">
                        <p className="font-medium text-gray-900 text-sm">{course.courseName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{course.faculty} · Min APS: {course.minAPS}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 space-y-3">
          {round < 3 && roundComplete() && (
            <button onClick={handleNextRound}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition">
              Continue to {round === 1 ? "Second" : "Third"} Choices →
            </button>
          )}
          {round === 3 && roundComplete() && (
            <button onClick={handleSave} disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-60">
              {saving ? "Saving…" : "Submit My Choices"}
            </button>
          )}
          {!roundComplete() && (
            <p className="text-center text-gray-400 text-xs">
              {round === 1
                ? `Select ${6 - chosenInstitutions.length} more ${6 - chosenInstitutions.length === 1 ? "university" : "universities"} to continue`
                : `Select a course from each remaining university to continue`}
            </p>
          )}
          <button onClick={onClose} className="w-full text-gray-400 text-sm hover:text-gray-600 transition">
            Save & Continue Later
          </button>
        </div>
      </div>
    </div>
  );
}