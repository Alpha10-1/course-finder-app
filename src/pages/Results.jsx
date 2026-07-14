import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { calculateAPSForUniversity, calculateAPSForCourse, calculateGeneralAPS, meetsCollegeRequirement, getCompletionLabel, getEffectiveMinAPS } from "../utils/marksToAPS";
import { meetsKeySubjects, subjectMatches, isGenericCreditSubject, isAnotherLanguagePlaceholder } from "../utils/subjectMatch";
import { getInstitutionApplicationStatus, getCourseDisplayStatus, fetchApplicationWindowSettings } from "../utils/institutionStatus";
import CourseStatusBadge from "../components/CourseStatusBadge";
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
            } catch {}
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
        setAllQualified(qualified);
        setNormalCourses(uniCourses.filter((c) => !EXTENDED_TYPES.includes(c.qualificationType)));
        setExtendedCourses(uniCourses.filter((c) => EXTENDED_TYPES.includes(c.qualificationType)));
        setCollegeCourses(collCourses);
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

  // All courses across both tabs for filter dropdowns
  const allForFilters = allQualified;

  // ── Selection helpers ─────────────────────────────────────────────────────
  const chosenInstitutions = Object.keys(selections);

  const handlePickCourse = (course) => {
    if (!selectionMode) return;
    // Lock: a new institution can't be added to the application list while
    // it's outside its application window. (Institutions already chosen in
    // round 1 stay pickable in rounds 2/3 even if they close in the meantime.)
    if (round === 1 && !isInstOpen(course.institution)) return;
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
        applySelections:   selections,
        applyStatus:       "submitted",
        applySubmittedAt:  new Date().toISOString(),
        applyContactPhone: contactPhone,
        applyContactEmail: contactEmail,
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
  // Takes the whole course (not just institution) so per-qualification APS
  // methods — e.g. CPUT's Method 1/2/3 — are used instead of always falling
  // back to the institution's default model.
  const getUniAps = (courseOrInstitution) =>
    typeof courseOrInstitution === "string"
      ? calculateAPSForUniversity(courseOrInstitution, subjects)
      : calculateAPSForCourse(courseOrInstitution, subjects);

  const getKeySubjectStatus = (keySubjects) => {
    if (!keySubjects || keySubjects.length === 0) return [];
    return keySubjects.map((req) => {
      if (req.subjectGroup) {
        const met = req.subjectGroup.some((opt) => {
          if (isGenericCreditSubject(opt.subject)) {
            return subjects.some((s) => !subjectMatches(s.subject, "Life Orientation") && parseInt(s.mark, 10) >= opt.minMark);
          }
          if (isAnotherLanguagePlaceholder(opt.subject)) {
            return subjects.some(
              (s) => /(home language|first additional language)$/i.test(s.subject.trim()) &&
                !subjectMatches(s.subject, "English") && parseInt(s.mark, 10) >= opt.minMark
            );
          }
          return subjects.some((s) => subjectMatches(s.subject, opt.subject) && parseInt(s.mark, 10) >= opt.minMark);
        });
        return { label: req.subjectGroup.map((o) => `${o.subject} ≥${o.minMark}%`).join(" or "), met };
      }
      if (isGenericCreditSubject(req.subject)) {
        const userSubj = subjects.find(
          (s) => !subjectMatches(s.subject, "Life Orientation") && parseInt(s.mark, 10) >= req.minMark
        );
        return { label: `${req.subject} ≥${req.minMark}%`, met: !!userSubj, userMark: userSubj ? parseInt(userSubj.mark, 10) : null };
      }
      if (isAnotherLanguagePlaceholder(req.subject)) {
        const userSubj = subjects.find(
          (s) => /(home language|first additional language)$/i.test(s.subject.trim()) &&
            !subjectMatches(s.subject, "English") && parseInt(s.mark, 10) >= req.minMark
        );
        return { label: `${req.subject} ≥${req.minMark}%`, met: !!userSubj, userMark: userSubj ? parseInt(userSubj.mark, 10) : null };
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
    const { score: uniScore, label: uniLabel } = getUniAps(course);
    const keyStatus = getKeySubjectStatus(course.keySubjects);
    const requiredAPS = getEffectiveMinAPS(course, subjects);
    const usingAltAPS = requiredAPS !== (Number(course.minAPS) || 0);
    const isGreen   = colorScheme === "green";
    const isCollege = colorScheme === "college";
    const selectedRound = getCourseSelectionRound(course);
    const isSelected = selectedRound !== null;
    const instOpen = isInstOpen(course.institution);
    // Locked = actively picking round-1 institutions right now, and this one
    // is currently outside its application window.
    const isLocked = selectionMode && round === 1 && !isSelected && !instOpen;

    const baseBg = isCollege ? "bg-amber-50" : isGreen ? "bg-green-50" : "bg-blue-50";
    const titleColor = isCollege ? "text-amber-800" : isGreen ? "text-green-800" : "text-purple-800";
    const scoreColor = isCollege ? "text-amber-600" : isGreen ? "text-green-600" : "text-purple-600";

    return (
      <div
        onClick={() => selectionMode && !isSelected && !isLocked && handlePickCourse(course)}
        className={`
          p-5 rounded-xl shadow transition relative
          ${isLocked
            ? "bg-gray-100 border-2 border-gray-200 opacity-60 cursor-not-allowed"
            : isSelected
              ? "bg-purple-100 border-2 border-purple-500 ring-2 ring-purple-300"
              : selectionMode
                ? "bg-white border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50 cursor-pointer"
                : baseBg
          }
        `}
      >
        {/* Selection badge */}
        {isSelected && (
          <div className="absolute top-3 right-3 bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {ROUND_INFO[selectedRound]?.label}
          </div>
        )}

        {/* Locked — applications closed */}
        {isLocked && (
          <div className="absolute top-3 right-3 text-xs text-gray-500 font-medium flex items-center gap-1">
            🔒 Applications closed
          </div>
        )}

        {/* Select prompt in selection mode */}
        {selectionMode && !isSelected && !isLocked && (
          <div className="absolute top-3 right-3 text-xs text-purple-400 font-medium">
            Tap to select →
          </div>
        )}

        <h3 className={`text-base font-bold mb-1 pr-24 ${isSelected ? "text-purple-800" : titleColor}`}>
          {course.courseName}
        </h3>
        <p className="text-gray-700 text-sm">Faculty: {course.faculty}</p>
        <p className="text-gray-700 text-sm">
          Institution: {course.institution}
          {course.campus && <span className="text-gray-500"> — {course.campus}</span>}
          {" "}
          <CourseStatusBadge status={getCourseDisplayStatus(course, institutionSettings, facultySettings)} className="align-middle" />
        </p>
        <p className="text-gray-700 text-sm">Duration: {course.duration}</p>
        <p className="text-gray-700 text-sm">Qualification: {course.qualificationType}</p>
        <p className="text-gray-500 text-xs mt-1">Code: {course.qualificationCode || "—"}</p>

        {isCollege ? (
          <>
            {(course.minGrade || course.minNQFLevel) && (
              <p className="text-gray-500 text-xs">
                Requires:{" "}
                {course.minGrade && <span className="font-medium text-gray-700">{course.minGrade}</span>}
                {course.minGrade && course.minNQFLevel && " · "}
                {course.minNQFLevel && <span className="font-medium text-gray-700">NQF Level {course.minNQFLevel}</span>}
              </p>
            )}
            {course.admissionRequirement && (
              <p className="text-amber-700 text-xs mt-1 bg-amber-50 rounded-lg px-2 py-1.5 leading-relaxed">
                📋 {course.admissionRequirement}
              </p>
            )}
            {course.curriculum && (course.curriculum.fundamentalSubjects?.length > 0 || course.curriculum.vocationalSubjects?.length > 0) && (
              <div className="mt-2 bg-white/60 rounded-lg px-2 py-1.5 space-y-1.5">
                {course.curriculum.fundamentalSubjects?.length > 0 && (
                  <p className="text-xs text-gray-600">
                    <span className="font-medium text-gray-700">Fundamental subjects:</span>{" "}
                    {course.curriculum.fundamentalSubjects.join(", ")}
                  </p>
                )}
                {course.curriculum.vocationalSubjects?.length > 0 && (
                  <div className="text-xs text-gray-600">
                    <span className="font-medium text-gray-700">Vocational subjects:</span>{" "}
                    {course.curriculum.vocationalSubjects.map((v, i) => (
                      <span key={i}>
                        {v.subject} ({v.levels}{v.optional ? ", optional" : ""})
                        {i < course.curriculum.vocationalSubjects.length - 1 ? "; " : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className={`text-xs font-medium mt-1 ${scoreColor}`}>
              ✓ You qualify — {getCompletionLabel(grade, gradeStatus)}
            </p>
          </>
        ) : (
          <>
            <p className="text-gray-500 text-xs">
              Min APS: {requiredAPS}
              {usingAltAPS && <span className="text-gray-400"> (based on your subject choice)</span>}
            </p>
            <p className={`text-xs font-medium mt-1 ${scoreColor}`}>
              Your score: {uniScore} <span className="text-gray-400 font-normal">({uniLabel})</span>
            </p>
          </>
        )}
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
                  setContactStep(true); // collect contact info before final save
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

  // ── Contact details screen ────────────────────────────────────────────────
  if (contactStep) {
    const validateAndSubmit = async () => {
      if (!contactPhone.trim()) { setContactError("Please enter a phone number."); return; }
      if (!contactEmail.trim() || !contactEmail.includes("@")) { setContactError("Please enter a valid email address."); return; }
      setContactError("");
      await handleSaveAndSubmit();
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <div className="text-4xl mb-2">📞</div>
            <h2 className="text-2xl font-bold text-gray-900">Contact Details</h2>
            <p className="text-gray-500 text-sm mt-1 leading-relaxed">
              These details will be used for your university applications and WhatsApp communication.
            </p>
          </div>

          {contactError && (
            <p className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2">
              {contactError}
            </p>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                WhatsApp / Phone Number
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🇿🇦</span>
                <input
                  type="tel"
                  placeholder="e.g. +27 81 234 5678"
                  value={contactPhone}
                  onChange={(e) => { setContactPhone(e.target.value); setContactError(""); }}
                  className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">We'll use WhatsApp to send you application updates</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address for Applications
              </label>
              <input
                type="email"
                placeholder="e.g. your@email.com"
                value={contactEmail}
                onChange={(e) => { setContactEmail(e.target.value); setContactError(""); }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800"
              />
              <p className="text-xs text-gray-400 mt-1">Universities will contact you at this email</p>
            </div>
          </div>

          {/* Summary of selections */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Your Selections Summary</p>
            <div className="space-y-1.5">
              {Object.entries(selections).map(([inst, choices]) => (
                <div key={inst} className="text-xs text-gray-600">
                  <span className="font-medium text-gray-800">{inst.replace("University of ", "U of ")}:</span>{" "}
                  {[1,2,3].filter(r => choices[r]).map(r => choices[r].courseName).join(" · ")}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setContactStep(false); setConfirming(true); }}
              className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-3 rounded-xl font-medium transition text-sm"
            >
              ← Back
            </button>
            <button
              onClick={validateAndSubmit}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-60"
            >
              {saving ? "Submitting…" : "Submit Applications ✓"}
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
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredNormal.map((course, idx) => (
                    <CourseCard key={idx} course={course} colorScheme="blue" />
                  ))}
                </div>
              </>
            )}
            {filteredExtended.length > 0 && (
              <>
                <h2 className="text-xl font-semibold text-green-700 mb-4 mt-8">Extended Degrees</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredExtended.map((course, idx) => (
                    <CourseCard key={idx} course={course} colorScheme="green" />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* College courses — shown on college tab normally, or always during rounds 2-3 */}
        {(!isUniTab || inRound2or3) && filteredCollege.length > 0 && (
          <>
            <h2 className="text-xl font-semibold text-amber-700 mb-4 mt-8">College Courses</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredCollege.map((course, idx) => (
                <CourseCard key={idx} course={course} colorScheme="college" />
              ))}
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