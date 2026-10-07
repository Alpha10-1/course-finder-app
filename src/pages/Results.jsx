import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { calculateAPSForCourse, calculateGeneralAPS, meetsCollegeRequirement, getEffectiveMinAPS } from "../utils/marksToAPS";
import { meetsKeySubjects } from "../utils/subjectMatch";
import { getInstitutionApplicationStatus, fetchApplicationWindowSettings } from "../utils/institutionStatus";
import { MAX_INSTITUTIONS, getCourseSelectionRound, isRoundComplete } from "../utils/applySelection";
import { db, auth } from "../firebase";
import PricingModal from "../components/PricingModal";
import CourseCard from "./results/CourseCard";
import RoundReview from "./results/RoundReview";
import ContactDetailsStep from "./results/ContactDetailsStep";
import { ROUND_INFO } from "./results/roundInfo";

async function fetchCourses() {
  const snap = await getDocs(collection(db, "courses"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();

  // ── Core data ─────────────────────────────────────────────────────────────
  const [subjects,       setSubjects]       = useState([]);
  const [generalAps,     setGeneralAps]     = useState(0);
  const [normalCourses,  setNormalCourses]  = useState([]);
  const [extendedCourses,setExtendedCourses]= useState([]);
  const [collegeCourses, setCollegeCourses]  = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [userPlan,       setUserPlan]       = useState("free");
  const [userId,         setUserId]         = useState(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchTerm,          setSearchTerm]          = useState("");
  const [selectedFaculty,     setSelectedFaculty]     = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [selectedQualification,setSelectedQualification]=useState("");
  const [openOnly,            setOpenOnly]            = useState(false);

  // Which course rows are expanded into the full detail tile. Kept here
  // rather than inside CourseCard so a row stays expanded when it's filtered
  // out and back in, or when switching tabs.
  const [expandedIds,         setExpandedIds]         = useState(() => new Set());
  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Institution application windows — { [institution]: { openDate, closeDate } }
  const [institutionSettings, setInstitutionSettings] = useState({});
  const [facultySettings, setFacultySettings] = useState({});

  // ── Selection mode ────────────────────────────────────────────────────────
  const [selectionMode,  setSelectionMode]  = useState(false);
  const [round,          setRound]          = useState(1);
  // selections: { [institution]: { 1: course, 2: course, 3: course } }
  const [selections,     setSelections]     = useState({});
  const [saving,         setSaving]         = useState(false);
  const [confirming,     setConfirming]     = useState(false);
  const [contactStep,    setContactStep]    = useState(false);
  const [contactPhone,   setContactPhone]   = useState("");
  const [contactEmail,   setContactEmail]   = useState("");
  const [contactError,   setContactError]   = useState("");
  const [submitted,      setSubmitted]      = useState(false);
  const [showPricing,    setShowPricing]    = useState(false);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState("universities"); // "universities" | "colleges"
  const [accessLevel,    setAccessLevel]    = useState("all"); // "all" | "grade12_current" | "colleges_only"
  const [gradeLabel,     setGradeLabel]     = useState("");
  const [grade,          setGrade]          = useState(null);
  const [gradeStatus,    setGradeStatus]    = useState(null);

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
        let userGrade = null;
        let userGradeStatus = null;

        if (location.state?.subjects) {
          loadedSubjects = location.state.subjects;
        }

        // Load grade/access info from navigation state
        if (location.state?.accessLevel) setAccessLevel(location.state.accessLevel);
        if (location.state?.accessLevel === "colleges_only") setActiveTab("colleges");
        if (location.state?.grade) {
          userGrade = location.state.grade;
          userGradeStatus = location.state.gradeStatus;
          const ms = location.state.marksSource;
          const g  = location.state.grade;
          const s  = location.state.gradeStatus;
          setGradeLabel(
            ms === "gr11"     ? "Grade 11 results" :
            ms === "gr12june" ? "Grade 12 June results" :
            s  === "completed" ? `${g} (completed)` : g
          );
        }

        await new Promise((resolve) => {
          const unsub = onAuthStateChanged(auth, async (user) => {
            unsub();
            if (!user) { resolve(); return; }
            uid = user.uid;
              if (user.email) setContactEmail(user.email);
            try {
              const snap = await getDoc(doc(db, "users", user.uid));
              if (snap.exists()) {
                const data = snap.data();
                plan = data.plan || "free";
                if (!loadedSubjects.length) loadedSubjects = data.subjects || [];
                // Load grade info from Firestore if not in navigation state
                if (!location.state?.accessLevel && data.accessLevel) {
                  setAccessLevel(data.accessLevel);
                  if (data.accessLevel === "colleges_only") setActiveTab("colleges");
                }
                if (!location.state?.grade && data.grade) {
                  userGrade = data.grade;
                  userGradeStatus = data.gradeStatus;
                  const ms = data.marksSource;
                  const g  = data.grade;
                  const s  = data.gradeStatus;
                  setGradeLabel(
                    ms === "gr11"      ? "Grade 11 results" :
                    ms === "gr12june"  ? "Grade 12 June results" :
                    s  === "completed" ? `${g} (completed)` : g
                  );
                }
                if (data.applySelections) savedSelections = data.applySelections;
                if (data.applyStatus === "submitted" || data.applySubmittedAt) alreadySubmitted = true;
                // Pre-fill contact details if already saved
                if (data.applyPhone) setContactPhone(data.applyPhone);
                if (data.applyEmail) setContactEmail(data.applyEmail || data.email || "");
              }
            } catch {
              // Profile load failed — fall through with whatever came from navigation state.
            }
            resolve();
          });
        });

        if (cancelled) return;

        setGrade(userGrade);
        setGradeStatus(userGradeStatus);

        const gAps = calculateGeneralAPS(loadedSubjects);
        const [coursesData, windowSettings] = await Promise.all([
          fetchCourses(),
          fetchApplicationWindowSettings().catch(() => ({ institutionSettings: {}, facultySettings: {} })),
        ]);
        setInstitutionSettings(windowSettings.institutionSettings);
        setFacultySettings(windowSettings.facultySettings);
        const qualified = coursesData.filter((course) => {
          const isCollegeCourse = course.institutionType === "college";

          if (isCollegeCourse) {
            // Colleges: eligibility based on grade/NQF level, not APS
            if (!meetsCollegeRequirement(userGrade, userGradeStatus, course)) return false;
          } else {
            // Universities: eligibility based on per-institution APS model
            const { score: uniAps } = calculateAPSForCourse(course, loadedSubjects);
            const requiredAPS = getEffectiveMinAPS(course, loadedSubjects);
            if (uniAps < requiredAPS) return false;
          }

          return meetsKeySubjects(loadedSubjects, course.keySubjects);
        });

        const EXTENDED_TYPES = ["Bachelor (Extended)", "Extended Diploma"];

        // Split into universities and colleges by institutionType field
        // Courses without institutionType default to "university"
        const uniCourses  = qualified.filter((c) => !c.institutionType || c.institutionType === "university");
        const collCourses = qualified.filter((c) => c.institutionType === "college");

        setSubjects(loadedSubjects);
        setGeneralAps(gAps);
        setNormalCourses(uniCourses.filter((c) => !EXTENDED_TYPES.includes(c.qualificationType)));
        setExtendedCourses(uniCourses.filter((c) => EXTENDED_TYPES.includes(c.qualificationType)));
        setCollegeCourses(collCourses);
        setUserPlan(plan);
        setUserId(uid);
        setSelections(savedSelections);
        setSubmitted(alreadySubmitted);

        // Resume round if partially complete.
        //
        // Can't infer completion from savedSelections alone: round 1 can
        // legitimately finish with fewer than 6 institutions (exhausted
        // early), and rounds 2/3 silently skip an institution that has
        // nothing left to offer rather than writing a selection for it — so
        // a missing entry might mean "not started yet" or "already
        // exhausted and skipped". Uses the freshly loaded pool and window
        // settings directly, since the component state holding them hasn't
        // committed yet at this point in the load.
        if (Object.keys(savedSelections).length > 0 && !alreadySubmitted) {
          const localPool = [...uniCourses, ...collCourses];
          const localIsOpen = (inst) =>
            getInstitutionApplicationStatus(windowSettings.institutionSettings[inst]) === "open";
          const localComplete = (r) => isRoundComplete(localPool, r, savedSelections, localIsOpen);

          if (localComplete(1)) {
            const targetRound = localComplete(2) ? 3 : 2;
            setRound(targetRound);
            // If the round we're resuming into is itself already exhausted
            // (e.g. every remaining institution only had one course total,
            // all used up earlier), don't leave the user staring at an empty
            // browse screen — open the review screen immediately.
            if (localComplete(targetRound)) setConfirming(true);
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
  const isInstOpen = (institution) => getInstitutionApplicationStatus(institutionSettings[institution]) === "open";

  const applyFilters = (courses) => {
    return courses.filter((c) => {
      const matchSearch = !searchTerm || c.courseName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchFaculty = !selectedFaculty || c.faculty === selectedFaculty;
      const matchInst = !selectedInstitution || c.institution === selectedInstitution;
      const matchQual = !selectedQualification || c.qualificationType === selectedQualification;
      const matchOpen = !openOnly || isInstOpen(c.institution);

      if (!matchSearch || !matchFaculty || !matchInst || !matchQual || !matchOpen) return false;
      if (!selectionMode) return true;

      const chosenInstitutions = Object.keys(selections);
      if (round === 1) return !chosenInstitutions.includes(c.institution);
      if (!chosenInstitutions.includes(c.institution)) return false;
      const instSels = selections[c.institution] || {};
      const pickedIds = Object.values(instSels).map((s) => s.id);
      return !pickedIds.includes(c.id);
    });
  };

  // Active tab courses
  const isUniTab  = activeTab === "universities";

  // Rounds 2 & 3: chosen institutions may be university OR college, so pull from
  // whichever pool actually contains them — not just the active tab.
  const inRound2or3 = selectionMode && round > 1;

  const filteredNormal = applyFilters(
    inRound2or3 ? normalCourses : (isUniTab ? normalCourses : [])
  );
  const filteredExtended = applyFilters(
    inRound2or3 ? extendedCourses : (isUniTab ? extendedCourses : [])
  );
  const filteredCollege = applyFilters(
    inRound2or3 ? collegeCourses : (!isUniTab ? collegeCourses : [])
  );

  const totalOnTab = inRound2or3
    ? filteredNormal.length + filteredExtended.length + filteredCollege.length
    : (isUniTab ? filteredNormal.length + filteredExtended.length : filteredCollege.length);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const chosenInstitutions = Object.keys(selections);
  const qualifiedPool = [...normalCourses, ...extendedCourses, ...collegeCourses];
  const roundIsComplete = (r, sels = selections) => isRoundComplete(qualifiedPool, r, sels, isInstOpen);
  const roundComplete = () => roundIsComplete(round);

  const handlePickCourse = (course) => {
    if (!selectionMode) return;
    // Lock: a new institution can't be added to the application list while
    // it's outside its application window. (Institutions already chosen in
    // round 1 stay pickable in rounds 2/3 even if they close in the meantime.)
    if (round === 1 && !isInstOpen(course.institution)) return;
    const inst = course.institution;

    // Hard cap: round 1 is exactly 6 institutions. Once 6 are chosen, round-1
    // browsing only ever shows courses from institutions NOT yet chosen (see
    // applyFilters above), so any further round-1 click here would always be
    // a 7th+ institution — block it outright rather than letting the count
    // overshoot 6 (which used to silently break roundComplete() and leave
    // the user stuck with no way to undo a pick).
    if (round === 1 && !selections[inst] && chosenInstitutions.length >= MAX_INSTITUTIONS) return;

    const newSelections = {
      ...selections,
      [inst]: { ...(selections[inst] || {}), [round]: course },
    };
    setSelections(newSelections);

    // Auto-advance straight to the review screen the instant this round has
    // nothing more it can offer — whether that's because round 1 hit 6, or
    // because every chosen institution is out of further choices for this
    // round (some institutions only offer 1-2 courses total). Without this,
    // a round could sit permanently "incomplete" with no way to finish it.
    if (roundIsComplete(round, newSelections)) {
      setConfirming(true);
    }
  };

  // "Continue" on the review screen between rounds.
  const handleRoundConfirmed = () => {
    setConfirming(false);
    if (round === 3) {
      setContactStep(true); // collect contact info before final save
      return;
    }
    const nextRound = round + 1;
    setRound(nextRound);
    // If the next round has nothing left to offer at all (e.g. every chosen
    // institution only had one course total, already used earlier), don't
    // leave the user staring at an empty browse screen — jump straight to
    // its review screen too, same as picking would have triggered.
    if (roundIsComplete(nextRound)) {
      setConfirming(true);
    }
  };

  const handleSaveAndSubmit = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "users", userId), {
        applySelections:   selections,
        applyStatus:       "submitted",
        applySubmittedAt:  new Date().toISOString(),
        applyContactPhone: contactPhone,
        applyContactEmail: contactEmail,
      }, { merge: true });
      setSubmitted(true);
      setSelectionMode(false);
      setContactStep(false); // back to the results page, which shows the submitted summary
    } catch (err) {
      console.error("Save error:", err);
      setContactError("We couldn't submit your applications. Please check your connection and try again.");
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

  // Final submit from the contact details step.
  const handleContactSubmit = async () => {
    if (!contactPhone.trim()) { setContactError("Please enter a phone number."); return; }
    if (!contactEmail.trim() || !contactEmail.includes("@")) { setContactError("Please enter a valid email address."); return; }
    setContactError("");
    await handleSaveAndSubmit();
  };

  const renderCourse = (course, colorScheme) => (
    <CourseCard
      key={course.id}
      course={course}
      colorScheme={colorScheme}
      subjects={subjects}
      grade={grade}
      gradeStatus={gradeStatus}
      institutionSettings={institutionSettings}
      facultySettings={facultySettings}
      selectionMode={selectionMode}
      round={round}
      selectedRound={getCourseSelectionRound(selections, course)}
      isExpanded={expandedIds.has(course.id)}
      onToggleExpand={toggleExpand}
      onPick={handlePickCourse}
    />
  );

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

  // ── Review screen between rounds ──────────────────────────────────────────
  if (confirming) {
    return (
      <RoundReview
        round={round}
        selections={selections}
        saving={saving}
        onEdit={() => setConfirming(false)}
        onContinue={handleRoundConfirmed}
      />
    );
  }

  // ── Contact details screen ────────────────────────────────────────────────
  if (contactStep) {
    return (
      <ContactDetailsStep
        phone={contactPhone}
        email={contactEmail}
        error={contactError}
        saving={saving}
        selections={selections}
        onPhoneChange={(value) => { setContactPhone(value); setContactError(""); }}
        onEmailChange={(value) => { setContactEmail(value); setContactError(""); }}
        onBack={() => { setContactStep(false); setConfirming(true); }}
        onSubmit={handleContactSubmit}
      />
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
            <p className="text-center text-gray-500 mb-3">
              Your APS: <span className="font-bold text-gray-900">{generalAps}</span>
              {gradeLabel && <span className="text-xs text-gray-400 ml-2">· {gradeLabel}</span>}
            </p>

            {/* ── Tab switcher ── */}
            <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
              {(accessLevel !== "colleges_only") && (
                <button
                  onClick={() => { setActiveTab("universities"); setSelectedFaculty(""); setSelectedInstitution(""); setSelectedQualification(""); setSearchTerm(""); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                    activeTab === "universities"
                      ? "bg-white shadow text-purple-700"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  🎓 Universities
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === "universities" ? "bg-purple-100 text-purple-600" : "bg-gray-200 text-gray-500"
                  }`}>
                    {normalCourses.length + extendedCourses.length}
                  </span>
                </button>
              )}
              <button
                onClick={() => { setActiveTab("colleges"); setSelectedFaculty(""); setSelectedInstitution(""); setSelectedQualification(""); setSearchTerm(""); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === "colleges"
                    ? "bg-white shadow text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                🏫 Colleges
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === "colleges" ? "bg-blue-100 text-blue-600" : "bg-gray-200 text-gray-500"
                }`}>
                  {collegeCourses.length}
                </span>
              </button>
            </div>

            {/* Colleges-only notice */}
            {accessLevel === "colleges_only" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 text-sm text-yellow-800">
                🏫 Showing college courses based on your grade. Complete Grade 12 to unlock university courses.
                <button onClick={() => navigate("/enter-marks")} className="ml-2 text-yellow-600 hover:underline text-xs">
                  Update grade →
                </button>
              </div>
            )}
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

            {/* Tab switcher — only relevant in round 1 to browse both pools */}
            {round === 1 && (
              <div className="flex rounded-xl bg-gray-100 p-1 mt-4">
                {(accessLevel !== "colleges_only") && (
                  <button
                    onClick={() => { setActiveTab("universities"); setSelectedFaculty(""); setSelectedInstitution(""); setSelectedQualification(""); setSearchTerm(""); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                      activeTab === "universities" ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    🎓 Universities
                  </button>
                )}
                <button
                  onClick={() => { setActiveTab("colleges"); setSelectedFaculty(""); setSelectedInstitution(""); setSelectedQualification(""); setSearchTerm(""); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                    activeTab === "colleges" ? "bg-white shadow text-blue-700" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  🏫 Colleges
                </button>
              </div>
            )}

            {/* Selection progress */}
            <div className="mt-4 flex flex-wrap gap-2">
              {round === 1 && (
                <p className="text-sm text-gray-600">
                  <span className="font-bold text-purple-700">{chosenInstitutions.length}</span>/6 institutions selected
                  <span className="text-gray-400 font-normal"> (mix universities & colleges freely)</span>
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
              <p className="text-white/80 text-sm mt-0.5">Let us apply to up to 6 universities on your behalf — R100 service fee</p>
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
            {[...new Set((isUniTab ? [...normalCourses, ...extendedCourses] : collegeCourses).map((c) => c.faculty))].sort().map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <select value={selectedInstitution} onChange={(e) => setSelectedInstitution(e.target.value)}
            className="p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400">
            <option value="">All Institutions</option>
            {[...new Set((isUniTab ? [...normalCourses, ...extendedCourses] : collegeCourses).map((c) => c.institution))].sort().map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          <select value={selectedQualification} onChange={(e) => setSelectedQualification(e.target.value)}
            className="p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400">
            <option value="">All Qualifications</option>
            {[...new Set((isUniTab ? [...normalCourses, ...extendedCourses] : collegeCourses).map((c) => c.qualificationType))].sort().map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 mb-4 text-sm text-gray-700 select-none cursor-pointer">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)}
            className="w-4 h-4 accent-purple-600" />
          Show only institutions currently open for applications
        </label>

        <button onClick={() => { setSearchTerm(""); setSelectedFaculty(""); setSelectedInstitution(""); setSelectedQualification(""); setOpenOnly(false); }}
          className="bg-gray-100 text-gray-700 py-2 px-4 rounded-xl hover:bg-gray-200 transition text-sm mb-4">
          Reset Filters
        </button>

        <p className="text-gray-500 text-sm mb-6">
          Showing <span className="font-bold text-gray-900">{totalOnTab}</span> qualifying {activeTab}
          {selectionMode && round > 1 && " from your selected institutions"}
        </p>

        {/* ── University tab ── */}
        {/* University courses — shown on uni tab normally, or always during rounds 2-3 */}
        {(isUniTab || inRound2or3) && (
          <>
            {filteredNormal.length > 0 && (
              <>
                <h2 className="text-xl font-semibold text-purple-700 mb-4">Standard Entry</h2>
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
                  {filteredNormal.map((course) => renderCourse(course, "blue"))}
                </div>
              </>
            )}
            {filteredExtended.length > 0 && (
              <>
                <h2 className="text-xl font-semibold text-green-700 mb-4 mt-8">Extended Degrees</h2>
                <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
                  {filteredExtended.map((course) => renderCourse(course, "green"))}
                </div>
              </>
            )}
          </>
        )}

        {/* College courses — shown on college tab normally, or always during rounds 2-3 */}
        {(!isUniTab || inRound2or3) && filteredCollege.length > 0 && (
          <>
            <h2 className="text-xl font-semibold text-amber-700 mb-4 mt-8">College Courses</h2>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
              {filteredCollege.map((course) => renderCourse(course, "college"))}
            </div>
          </>
        )}

        {/* Empty states */}
        {filteredNormal.length === 0 && filteredExtended.length === 0 && filteredCollege.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <div className="text-4xl">{isUniTab ? "🎓" : "🏫"}</div>
            <p className="text-gray-500">
              {selectionMode && round > 1
                ? "No other qualifying courses at your selected institutions."
                : `No ${isUniTab ? "university" : "college"} courses match your filters.`}
            </p>
            {!isUniTab && collegeCourses.length === 0 && !selectionMode && (
              <p className="text-gray-400 text-sm">College courses are being added. Check back soon.</p>
            )}
          </div>
        )}

        <button onClick={() => navigate("/enter-marks")}
          className="mt-8 w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold shadow-md transition">
          Back to Marks Entry
        </button>
      </div>
    </div>
  );
}