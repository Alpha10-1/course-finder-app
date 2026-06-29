import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { calculateAPSForUniversity, calculateGeneralAPS } from "../utils/marksToAPS";
import { meetsKeySubjects, subjectMatches } from "../utils/subjectMatch";
import { db, auth } from "../firebase";
import PricingModal from "../components/PricingModal";

async function fetchCourses() {
  const snap = await getDocs(collection(db, "courses"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const ROUND_INFO = {
  1: { label: "1st Choice", color: "purple", hint: "Pick one course per university (up to 6 universities)" },
  2: { label: "2nd Choice", color: "blue",   hint: "Pick a 2nd course from each of your 6 universities"  },
  3: { label: "3rd Choice", color: "teal",   hint: "Pick a 3rd course from each of your 6 universities"  },
};

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();

  // ── Core data ─────────────────────────────────────────────────────────────
  const [subjects,       setSubjects]       = useState([]);
  const [generalAps,     setGeneralAps]     = useState(0);
  const [allQualified,   setAllQualified]   = useState([]);
  const [normalCourses,  setNormalCourses]  = useState([]);
  const [extendedCourses,setExtendedCourses]= useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [userPlan,       setUserPlan]       = useState("free");
  const [userId,         setUserId]         = useState(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchTerm,          setSearchTerm]          = useState("");
  const [selectedFaculty,     setSelectedFaculty]     = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [selectedQualification,setSelectedQualification]=useState("");

  // ── Selection mode ────────────────────────────────────────────────────────
  const [selectionMode,  setSelectionMode]  = useState(false);
  const [round,          setRound]          = useState(1);
  // selections: { [institution]: { 1: course, 2: course, 3: course } }
  const [selections,     setSelections]     = useState({});
  const [saving,         setSaving]         = useState(false);
  const [confirming,     setConfirming]     = useState(false); // show confirmation screen between rounds
  const [submitted,      setSubmitted]      = useState(false);
  const [showPricing,    setShowPricing]    = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let loadedSubjects = [];
        let plan = "free";
        let uid = null;
        let savedSelections = {};
        let alreadySubmitted = false;

        if (location.state?.subjects) {
          loadedSubjects = location.state.subjects;
        }

        await new Promise((resolve) => {
          const unsub = onAuthStateChanged(auth, async (user) => {
            unsub();
            if (!user) { resolve(); return; }
            uid = user.uid;
            try {
              const snap = await getDoc(doc(db, "users", user.uid));
              if (snap.exists()) {
                const data = snap.data();
                plan = data.plan || "free";
                if (!loadedSubjects.length) loadedSubjects = data.subjects || [];
                if (data.applySelections) savedSelections = data.applySelections;
                if (data.applyStatus === "submitted" || data.applySubmittedAt) alreadySubmitted = true;
              }
            } catch {}
            resolve();
          });
        });

        if (cancelled) return;

        const gAps = calculateGeneralAPS(loadedSubjects);
        const coursesData = await fetchCourses();
        const qualified = coursesData.filter((course) => {
          const { score: uniAps } = calculateAPSForUniversity(course.institution, loadedSubjects);
          if (uniAps < course.minAPS) return false;
          return meetsKeySubjects(loadedSubjects, course.keySubjects);
        });

        const EXTENDED_TYPES = ["Bachelor (Extended)", "Extended Diploma"];

        setSubjects(loadedSubjects);
        setGeneralAps(gAps);
        setAllQualified(qualified);
        setNormalCourses(qualified.filter((c) => !EXTENDED_TYPES.includes(c.qualificationType)));
        setExtendedCourses(qualified.filter((c) => EXTENDED_TYPES.includes(c.qualificationType)));
        setUserPlan(plan);
        setUserId(uid);
        setSelections(savedSelections);
        setSubmitted(alreadySubmitted);

        // Resume round if partially complete
        if (Object.keys(savedSelections).length > 0 && !alreadySubmitted) {
          const insts = Object.keys(savedSelections);
          if (insts.length === 6) {
            const r2done = insts.every((i) => savedSelections[i]?.[2]);
            const r3done = insts.every((i) => savedSelections[i]?.[3]);
            if (!r3done) setRound(r2done ? 3 : r2done ? 3 : 2);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Results load error:", err);
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter logic ──────────────────────────────────────────────────────────
  const applyFilters = (courses) => {
    // In selection mode, also hide institutions already fully selected for this round
    return courses.filter((c) => {
      const matchSearch = !searchTerm || c.courseName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFaculty = !selectedFaculty || c.faculty === selectedFaculty;
      const matchInst = !selectedInstitution || c.institution === selectedInstitution;
      const matchQual = !selectedQualification || c.qualificationType === selectedQualification;

      if (!matchSearch || !matchFaculty || !matchInst || !matchQual) return false;

      if (!selectionMode) return true;

      const chosenInstitutions = Object.keys(selections);

      if (round === 1) {
        // Hide institutions already picked
        return !chosenInstitutions.includes(c.institution);
      } else {
        // Round 2 & 3: only show courses from chosen institutions
        if (!chosenInstitutions.includes(c.institution)) return false;
        // Hide already-picked courses for this institution across all rounds
        const instSels = selections[c.institution] || {};
        const pickedIds = Object.values(instSels).map((s) => s.id);
        return !pickedIds.includes(c.id);
      }
    });
  };

  const filteredNormal   = applyFilters(normalCourses);
  const filteredExtended = applyFilters(extendedCourses);
  const totalUnlocked    = applyFilters(normalCourses).length + applyFilters(extendedCourses).length;

  // ── Selection helpers ─────────────────────────────────────────────────────
  const chosenInstitutions = Object.keys(selections);

  const handlePickCourse = (course) => {
    if (!selectionMode) return;
    const inst = course.institution;
    const newSelections = {
      ...selections,
      [inst]: { ...(selections[inst] || {}), [round]: course },
    };
    setSelections(newSelections);
  };

  const roundComplete = () => {
    if (round === 1) return chosenInstitutions.length === 6;
    return chosenInstitutions.every((inst) => selections[inst]?.[round]);
  };

  const handleSaveAndSubmit = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", userId), {
        applySelections:  selections,
        applyStatus:      "submitted",
        applySubmittedAt: new Date().toISOString(),
      }, { merge: true });
      setSubmitted(true);
      setSelectionMode(false);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!userId) return;
    try {
      await setDoc(doc(db, "users", userId), {
        applySelections: selections,
        applyStatus: "draft",
      }, { merge: true });
    } catch (err) {
      console.error("Draft save error:", err);
    }
  };

  const exitSelectionMode = async () => {
    await handleSaveDraft();
    setSelectionMode(false);
  };

  // ── APS & subject helpers ─────────────────────────────────────────────────
  const getUniAps = (institution) => calculateAPSForUniversity(institution, subjects);

  const getKeySubjectStatus = (keySubjects) => {
    if (!keySubjects || keySubjects.length === 0) return [];
    return keySubjects.map((req) => {
      if (req.subjectGroup) {
        const met = req.subjectGroup.some((opt) =>
          subjects.some((s) => subjectMatches(s.subject, opt.subject) && parseInt(s.mark, 10) >= opt.minMark)
        );
        return { label: req.subjectGroup.map((o) => `${o.subject} ≥${o.minMark}%`).join(" or "), met };
      }
      const userSubj = subjects.find((s) => subjectMatches(s.subject, req.subject));
      const met = !!userSubj && parseInt(userSubj.mark, 10) >= req.minMark;
      return { label: `${req.subject} ≥${req.minMark}%`, met, userMark: userSubj ? parseInt(userSubj.mark, 10) : null };
    });
  };

  // Check if this course is selected in any round
  const getCourseSelectionRound = (course) => {
    for (const inst of chosenInstitutions) {
      for (const r of [1, 2, 3]) {
        if (selections[inst]?.[r]?.id === course.id) return r;
      }
    }
    return null;
  };

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
      <p className="text-gray-600 text-lg">Loading courses...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 gap-4">
      <p className="text-red-600 font-medium">Something went wrong: {error}</p>
      <button onClick={() => navigate("/enter-marks")} className="bg-purple-600 text-white px-6 py-2 rounded-xl">Go Back</button>
    </div>
  );

  // ── Course card ───────────────────────────────────────────────────────────
  const CourseCard = ({ course, colorScheme }) => {
    const { score: uniScore, label: uniLabel } = getUniAps(course.institution);
    const keyStatus = getKeySubjectStatus(course.keySubjects);
    const isGreen = colorScheme === "green";
    const selectedRound = getCourseSelectionRound(course);
    const isSelected = selectedRound !== null;

    // In selection mode, grey out courses from institutions already picked this round
    const instAlreadyPicked = selectionMode && round === 1 && chosenInstitutions.includes(course.institution);
    const alreadyPickedThisRound = selectionMode && round > 1 && selections[course.institution]?.[round];

    return (
      <div
        onClick={() => selectionMode && !isSelected && handlePickCourse(course)}
        className={`
          p-5 rounded-xl shadow transition relative
          ${isSelected
            ? "bg-purple-100 border-2 border-purple-500 ring-2 ring-purple-300"
            : selectionMode
              ? "bg-white border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50 cursor-pointer"
              : isGreen ? "bg-green-50" : "bg-blue-50"
          }
        `}
      >
        {/* Selection badge */}
        {isSelected && (
          <div className="absolute top-3 right-3 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {ROUND_INFO[selectedRound]?.label}
          </div>
        )}

        {/* Select prompt in selection mode */}
        {selectionMode && !isSelected && (
          <div className="absolute top-3 right-3 text-xs text-purple-400 font-medium">
            Tap to select →
          </div>
        )}

        <h3 className={`text-base font-bold mb-1 pr-24 ${
          isSelected ? "text-purple-800" : isGreen ? "text-green-800" : "text-purple-800"
        }`}>
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
                {!req.met && req.userMark !== null && <span className="text-gray-400">(you have {req.userMark}%)</span>}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  // ── Confirmation screen between rounds ───────────────────────────────────
  if (confirming) {
    const isLastRound = round === 3;
    const roundChoices = Object.entries(selections).map(([inst, choices]) => ({
      inst,
      course: choices[round],
    })).filter((e) => e.course);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col items-center justify-center p-6">
        {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
        <div className="w-full max-w-xl bg-white shadow-xl rounded-2xl p-8 space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-2">{isLastRound ? "🎉" : "✅"}</div>
            <h2 className="text-2xl font-bold text-gray-900">
              {ROUND_INFO[round].label} Confirmed
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Review your choices below before {isLastRound ? "submitting" : "moving to the next round"}.
            </p>
          </div>

          <div className="space-y-3">
            {roundChoices.map(({ inst, course }) => (
              <div key={inst} className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-0.5">{inst}</p>
                <p className="font-semibold text-purple-800 text-sm">{course.courseName}</p>
                <p className="text-xs text-gray-500">{course.faculty} · {course.duration}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-3 rounded-xl font-medium transition text-sm"
            >
              ← Edit Choices
            </button>
            <button
              onClick={async () => {
                setConfirming(false);
                if (isLastRound) {
                  await handleSaveAndSubmit();
                } else {
                  setRound(round + 1);
                }
              }}
              disabled={saving}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-60"
            >
              {saving ? "Saving…" : isLastRound ? "Submit →" : `Go to ${round === 1 ? "2nd" : "3rd"} Choices →`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col items-center p-6">
      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
      <div className="w-full max-w-5xl bg-white shadow-xl rounded-2xl p-8">

        {/* ── Header ── */}
        {!selectionMode ? (
          <>
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-1">Your Qualifying Courses</h1>
            <p className="text-center text-gray-500 mb-6">
              Your APS: <span className="font-bold text-gray-900">{generalAps}</span>
              <span className="text-xs text-gray-400 ml-2">(per-university scores used for eligibility)</span>
            </p>
          </>
        ) : (
          <div className="mb-6">
            <div className={`rounded-2xl p-5 ${
              round === 1 ? "bg-gradient-to-r from-purple-600 to-blue-500" :
              round === 2 ? "bg-gradient-to-r from-blue-600 to-teal-500" :
                            "bg-gradient-to-r from-teal-600 to-green-500"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Round {round} of 3</p>
                  <h2 className="text-white text-xl font-bold mt-0.5">
                    {round === 1 ? "Pick Your 1st Choices" : round === 2 ? "Pick Your 2nd Choices" : "Pick Your 3rd Choices"}
                  </h2>
                  <p className="text-white/80 text-sm mt-1">{ROUND_INFO[round].hint}</p>
                </div>
                <button onClick={exitSelectionMode}
                  className="text-white/60 hover:text-white text-sm border border-white/30 px-3 py-1.5 rounded-lg transition">
                  Save & Exit
                </button>
              </div>
              {/* Round progress */}
              <div className="flex gap-2 mt-4">
                {[1, 2, 3].map((r) => (
                  <div key={r} className={`flex-1 h-1.5 rounded-full ${r <= round ? "bg-white" : "bg-white/30"}`} />
                ))}
              </div>
            </div>

            {/* Selection progress */}
            <div className="mt-4 flex flex-wrap gap-2">
              {round === 1 && (
                <p className="text-sm text-gray-600">
                  <span className="font-bold text-purple-700">{chosenInstitutions.length}</span>/6 universities selected
                </p>
              )}
              {round > 1 && chosenInstitutions.map((inst) => {
                const picked = selections[inst]?.[round];
                return (
                  <span key={inst} className={`text-xs px-3 py-1 rounded-full ${
                    picked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {picked ? "✓ " : ""}{inst.replace("University of ", "U of ")}
                  </span>
                );
              })}
            </div>

            {/* Next round / Submit button */}
            {roundComplete() && (
              <button onClick={() => setConfirming(true)}
                className={`mt-4 w-full text-white py-3 rounded-xl font-semibold transition ${
                  round === 3 ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700"
                }`}>
                {round === 3 ? "Review & Submit →" : `Review ${ROUND_INFO[round].label}s →`}
              </button>
            )}
          </div>
        )}

        {/* ── Submitted state ── */}
        {submitted && !selectionMode && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
            <p className="text-green-800 font-bold">✅ Selections submitted!</p>
            <p className="text-green-600 text-sm mt-1">Our team will begin applying to your chosen institutions.</p>
            <div className="mt-3 space-y-2">
              {Object.entries(selections).map(([inst, choices]) => (
                <div key={inst} className="bg-white rounded-xl p-3">
                  <p className="font-semibold text-gray-800 text-sm">{inst}</p>
                  {[1, 2, 3].map((r) => choices[r] && (
                    <p key={r} className="text-xs text-gray-500 mt-0.5">
                      <span className="text-purple-600 font-medium">Choice {r}:</span> {choices[r].courseName}
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <button onClick={() => { setSubmitted(false); setSelectionMode(true); }}
              className="mt-3 text-sm text-purple-600 hover:underline">
              Edit selections
            </button>
          </div>
        )}

        {/* ── Apply For Me banner — free users ── */}
        {userPlan !== "apply_for_me" && !selectionMode && !submitted && (
          <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-bold">🚀 Apply For Me</p>
              <p className="text-white/80 text-sm mt-0.5">Let us apply to up to 6 universities on your behalf — R150 once-off</p>
            </div>
            <button onClick={() => setShowPricing(true)}
              className="bg-white text-purple-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-purple-50 transition shrink-0">
              Upgrade →
            </button>
          </div>
        )}

        {/* ── Apply For Me banner — paid users ── */}
        {userPlan === "apply_for_me" && !selectionMode && !submitted && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-purple-800 font-bold">🚀 Apply For Me — Active</p>
              <p className="text-purple-600 text-sm mt-0.5">
                {chosenInstitutions.length > 0
                  ? `${chosenInstitutions.length}/6 universities selected — continue your selection`
                  : "Use the search and filters below to find your courses, then select them"}
              </p>
            </div>
            <button onClick={() => setSelectionMode(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm px-4 py-2 rounded-xl transition shrink-0">
              {chosenInstitutions.length > 0 ? "Continue →" : "Start Selecting"}
            </button>
          </div>
        )}

        {/* ── Search ── */}
        <input type="text" placeholder="Search for a course..."
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full mb-4 p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />

        {/* ── Filters ── */}
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
          Showing <span className="font-bold text-gray-900">{filteredNormal.length + filteredExtended.length}</span> of{" "}
          <span className="font-bold text-gray-900">{totalUnlocked}</span> courses
          {selectionMode && round > 1 && " from your selected universities"}
        </p>

        {/* ── Standard Entry Courses ── */}
        {filteredNormal.length > 0 && (
          <>
            <h2 className="text-2xl font-semibold text-purple-700 mb-4">Standard Entry Courses</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredNormal.map((course, idx) => (
                <CourseCard key={idx} course={course} colorScheme="blue" />
              ))}
            </div>
          </>
        )}

        {/* ── Extended Degrees ── */}
        {filteredExtended.length > 0 && (
          <>
            <h2 className="text-2xl font-semibold text-green-700 mb-4 mt-8">Extended Degrees</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredExtended.map((course, idx) => (
                <CourseCard key={idx} course={course} colorScheme="green" />
              ))}
            </div>
          </>
        )}

        {filteredNormal.length === 0 && filteredExtended.length === 0 && (
          <p className="text-center text-gray-500 mt-6">
            {selectionMode && round > 1
              ? "No other qualifying courses found at your selected universities."
              : "No courses match your filters."}
          </p>
        )}

        <button onClick={() => navigate("/enter-marks")}
          className="mt-8 w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold shadow-md transition">
          Back to Marks Entry
        </button>
      </div>
    </div>
  );
}