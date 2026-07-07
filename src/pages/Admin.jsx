import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, doc, updateDoc, deleteDoc, setDoc, addDoc, getDoc,
  query, orderBy, limit, arrayUnion, arrayRemove, writeBatch
} from "firebase/firestore";
import { sendPasswordResetEmail, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { isSuperAdmin, PERMISSIONS, ADMIN_ROLES, getRoleInfo } from "../utils/adminConfig";
import { HOME_LANGUAGE_SUBJECTS, FAL_SUBJECTS } from "../utils/languages";
import { NSC_LEVEL_OPTIONS, levelToMinMark, markToLevel } from "../utils/marksToAPS";
import {
  getInstitutionApplicationStatus,
  fetchInstitutionSettingsMap,
  saveInstitutionSettings,
} from "../utils/institutionStatus";

const FIREBASE_API_KEY = "AIzaSyDgSKlh9_3pBI9_IggS3C9aGh7I2edX484";
const ALL_TABS = ["Dashboard", "Users", "Courses", "Audit Log", "Settings"];

const QUAL_TYPES = ["Bachelor", "Bachelor (Extended)", "Diploma", "Extended Diploma", "Higher Certificate"];
const INSTITUTIONS = [
  "University of the Witwatersrand",
  "University of Johannesburg",
  "University of Pretoria",
  "Stellenbosch University",
  "University of Cape Town",
  "University of KwaZulu-Natal",
  "University of the Free State",
  "North-West University",
  "University of Limpopo",
  "University of Zululand",
  "University of South Africa",
  "University of the Western Cape",
  "Nelson Mandela University",
  "Rhodes University",
  "Walter Sisulu University",
  "Tshwane University of Technology",
  "Durban University of Technology",
  "Central University of Technology",
  "Cape Peninsula University of Technology",
  "Vaal University of Technology",
  "Mangosuthu University of Technology",
  "University of Venda",
  "University of Fort Hare",
  "University of Mpumalanga",
  "Sefako Makgatho Health Sciences University",
  "Sol Plaatje University",
];

// Common college qualification types (TVET / private colleges)
const COLLEGE_QUAL_TYPES = [
  "N4 Certificate", "N5 Certificate", "N6 Certificate",
  "NCV Level 2", "NCV Level 3", "NCV Level 4",
  "National Certificate (Vocational)",
  "Higher Certificate", "Diploma", "Occupational Certificate",
];

const UNI_QUAL_TYPES = ["Bachelor", "Bachelor (Extended)", "Diploma", "Extended Diploma", "Higher Certificate"];

// Master subject list — used for all subject dropdowns in the admin panel
const SUBJECT_OPTIONS = [
  "Accounting",
  "Agricultural Sciences", "Business Studies", "CAT (Computer Applications Technology)",
  "Civil Technology", "Computer Literacy", "Consumer Studies", "Dramatic Arts",
  "Economics", "Electrical Technology", "Engineering Graphics and Design",
  "Geography",
  "History", "Hospitality Studies", "IT (Information Technology)", "Life Orientation",
  "Life Sciences", "Mathematical Literacy", "Mathematics", "Technical Mathematics",
  "Mechanical Technology", "Music", "Physical Sciences", "Religion Studies",
  "Tourism", "Visual Arts",
  // All 11 official languages, as Home Language and First Additional Language
  ...HOME_LANGUAGE_SUBJECTS,
  ...FAL_SUBJECTS,
].sort();

const BLANK_COURSE = {
  courseName: "", institution: INSTITUTIONS[0], institutionType: "university", faculty: "",
  campus: "",                // college-only, optional — e.g. "Boksburg Campus". `institution` stays
                               // the college itself (e.g. "Ekurhuleni East TVET College"); campus is
                               // the specific site offering this particular course.
  duration: "", qualificationType: "Bachelor", minAPS: 0, keySubjects: [],
  admissionRequirement: "", // free-text description shown to users
  minGrade: null,           // "Grade 9" | "Grade 10" | "Grade 11" | "Grade 12" | null — colleges only
  minNQFLevel: null,        // 1 | 2 | 3 | 4 | null — colleges only
  apsAlternatives: [],      // [{ subject: "Mathematical Literacy", minAPS: 34 }] — alternate minAPS
                             // that applies instead of minAPS when the learner took that subject
                             // (e.g. Maths vs Maths Lit courses with different cutoffs)
  curriculum: null,         // college-only, optional — { fundamentalSubjects: [], vocationalSubjects: [] }
                             // describes the qualification's subject structure (e.g. NC(V) programmes).
                             // This is DISPLAY-ONLY and is never used for eligibility matching — see
                             // minGrade/minNQFLevel above for the actual admission gate.
};

// ─── College course JSON expansion ─────────────────────────────────────────
//
// A source entry in college-courses.json has ONE `institution` — the college
// itself (e.g. "Ekurhuleni East TVET College"). If that college offers the
// course at multiple sites, list them in `campuses` — the entry is cloned
// once per campus, keeping the shared `institution` and adding that campus's
// name plus optionally excluding vocational subjects not offered there.
// A course offered at a single site just omits `campuses` entirely.
// Mirrors the expansion logic in seed-college-courses.mjs so the admin-panel
// button and the offline Node script behave identically.
function expandCollegeCourse(entry) {
  const { campuses, curriculum, _comment, ...base } = entry;

  if (!campuses || campuses.length === 0) {
    return [{ institutionType: "college", keySubjects: [], faculty: "", ...base, curriculum: curriculum || null }];
  }

  return campuses.map((campusObj) => {
    const exclude = new Set((campusObj.excludeVocational || []).map((s) => s.trim().toLowerCase()));
    const vocationalSubjects = (curriculum?.vocationalSubjects || []).filter(
      (v) => !exclude.has((v.subject || "").trim().toLowerCase())
    );
    return {
      institutionType: "college",
      keySubjects: [],
      faculty: "",
      ...base,                     // institution (the college) comes from here
      campus: campusObj.campus,    // the specific site
      curriculum: curriculum ? { ...curriculum, vocationalSubjects } : null,
    };
  });
}

// qualificationCode is included when present so that distinct qualification
// variants that otherwise share the same name/institution/campus/faculty
// (e.g. two different UP "BSc (Biochemistry)" streams with different
// qualificationCode values) are treated as separate courses rather than
// collapsing into one. This matters more now that a dedupe-key match causes
// seeding to OVERWRITE the existing doc (see handleSeedCourses) rather than
// just skip it — an incorrect match here would silently destroy real data.
function courseDedupeKey(c) {
  return [
    (c.courseName       || "").trim().toLowerCase(),
    (c.institution       || "").trim().toLowerCase(),
    (c.campus            || "").trim().toLowerCase(),
    (c.faculty            || "").trim().toLowerCase(),
    (c.qualificationCode || "").trim().toLowerCase(),
  ].join("|||");
}

// ─── Seed exclusions ("tombstones") ────────────────────────────────────────
//
// Deleting a course from the admin panel only removes it from the `courses`
// collection — the seed scripts have no other memory of that deletion. Since
// seeding just diffs "what's in the local JSON" against "what's currently in
// Firestore", a deleted course that's still in courses.json / 
// college-courses.json looks indistinguishable from a never-seeded one, and
// silently comes back on the next seed. This doc is the fix: every deletion
// records its dedupe key here, and both seed functions skip anything listed,
// regardless of whether it's still present in the JSON file.
const SEED_EXCLUSIONS_DOC = doc(db, "meta", "seedExclusions");

async function getSeedExclusions() {
  const snap = await getDoc(SEED_EXCLUSIONS_DOC);
  return new Set(snap.exists() ? snap.data().keys || [] : []);
}

async function addSeedExclusion(key) {
  await setDoc(SEED_EXCLUSIONS_DOC, { keys: arrayUnion(key) }, { merge: true });
}

async function removeSeedExclusion(key) {
  await updateDoc(SEED_EXCLUSIONS_DOC, { keys: arrayRemove(key) }).catch(() =>
    // doc might not exist yet if nothing's ever been excluded — fine, no-op
    null
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchAllAuthUsers(idToken) {
  // Uses Firebase Identity Toolkit API to list all Auth users (admin only via token)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/course-finder-214e7/accounts:lookup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({}),
    }
  );
  // fallback: use download API
  const res2 = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:query?key=${FIREBASE_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: false }) }
  );
  return null; // handled below
}

// ─── Main component ──────────────────────────────────────────────────────────

function CourseFormFields({ data, onChange }) {
  const keySubjects = data.keySubjects || [];
  const [fundamentalInput, setFundamentalInput] = useState("");

  // Add a single required subject
  const addSingle = () => {
    onChange("keySubjects", [...keySubjects, { subject: "", minMark: 50 }]);
  };

  // Add an OR group (e.g. Mathematics OR Mathematical Literacy)
  const addGroup = () => {
    onChange("keySubjects", [
      ...keySubjects,
      { subjectGroup: [{ subject: "", minMark: 50 }, { subject: "", minMark: 50 }] },
    ]);
  };

  const removeReq = (i) => {
    onChange("keySubjects", keySubjects.filter((_, idx) => idx !== i));
  };

  // Update a single-subject requirement
  const updateSingle = (i, field, value) => {
    const updated = keySubjects.map((k, idx) =>
      idx === i ? { ...k, [field]: field === "minMark" ? Number(value) : value } : k
    );
    onChange("keySubjects", updated);
  };

  // Update one option inside an OR group
  const updateGroupOption = (i, j, field, value) => {
    const updated = keySubjects.map((k, idx) => {
      if (idx !== i) return k;
      const newGroup = k.subjectGroup.map((opt, jdx) =>
        jdx === j ? { ...opt, [field]: field === "minMark" ? Number(value) : value } : opt
      );
      return { subjectGroup: newGroup };
    });
    onChange("keySubjects", updated);
  };

  const addGroupOption = (i) => {
    const updated = keySubjects.map((k, idx) =>
      idx === i
        ? { subjectGroup: [...k.subjectGroup, { subject: "", minMark: 50 }] }
        : k
    );
    onChange("keySubjects", updated);
  };

  const removeGroupOption = (i, j) => {
    const updated = keySubjects.map((k, idx) => {
      if (idx !== i) return k;
      const newGroup = k.subjectGroup.filter((_, jdx) => jdx !== j);
      // If only 1 left, convert back to a single requirement
      return newGroup.length === 1
        ? { subject: newGroup[0].subject, minMark: newGroup[0].minMark }
        : { subjectGroup: newGroup };
    });
    onChange("keySubjects", updated);
  };

  // ── Alternate APS (e.g. different minAPS for Maths vs Maths Lit) ──────────
  const apsAlternatives = data.apsAlternatives || [];

  const addApsAlternative = () => {
    onChange("apsAlternatives", [
      ...apsAlternatives,
      { subject: "Mathematical Literacy", minAPS: (Number(data.minAPS) || 0) + 4 },
    ]);
  };

  const updateApsAlternative = (i, field, value) => {
    const updated = apsAlternatives.map((a, idx) =>
      idx === i ? { ...a, [field]: field === "minAPS" ? Number(value) : value } : a
    );
    onChange("apsAlternatives", updated);
  };

  const removeApsAlternative = (i) => {
    onChange("apsAlternatives", apsAlternatives.filter((_, idx) => idx !== i));
  };

  // ── Curriculum (college-only, optional, display-only) ─────────────────────
  // Used for programmes like NC(V) that list compulsory fundamental subjects
  // plus vocational subjects offered at specific NQF levels (some optional).
  // This does NOT affect eligibility — see minGrade/minNQFLevel for that.
  const curriculum = data.curriculum || { fundamentalSubjects: [], vocationalSubjects: [] };
  const fundamentalSubjects = curriculum.fundamentalSubjects || [];
  const vocationalSubjects = curriculum.vocationalSubjects || [];

  const setCurriculum = (patch) => onChange("curriculum", { ...curriculum, ...patch });

  const addFundamental = (name) => {
    if (!name.trim()) return;
    setCurriculum({ fundamentalSubjects: [...fundamentalSubjects, name.trim()] });
  };
  const removeFundamental = (i) => {
    setCurriculum({ fundamentalSubjects: fundamentalSubjects.filter((_, idx) => idx !== i) });
  };

  const addVocational = () => {
    setCurriculum({
      vocationalSubjects: [...vocationalSubjects, { subject: "", levels: "2-4", optional: false }],
    });
  };
  const updateVocational = (i, field, value) => {
    setCurriculum({
      vocationalSubjects: vocationalSubjects.map((v, idx) =>
        idx === i ? { ...v, [field]: value } : v
      ),
    });
  };
  const removeVocational = (i) => {
    setCurriculum({ vocationalSubjects: vocationalSubjects.filter((_, idx) => idx !== i) });
  };

  const inputCls = "bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500";
  const markCls = "w-16 bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500";

  const isCollege = data.institutionType === "college";
  const qualOptions = isCollege ? COLLEGE_QUAL_TYPES : UNI_QUAL_TYPES;

  return (
    <div className="space-y-3">

      {/* Institution Type toggle */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Institution Type</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button"
            onClick={() => { onChange("institutionType", "university"); onChange("qualificationType", "Bachelor"); }}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              !isCollege ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 border border-gray-600"
            }`}>
            🎓 University
          </button>
          <button type="button"
            onClick={() => { onChange("institutionType", "college"); onChange("qualificationType", COLLEGE_QUAL_TYPES[0]); }}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              isCollege ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400 border border-gray-600"
            }`}>
            🏫 College
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[["courseName","Course Name"],["faculty","Faculty"],["duration","Duration (e.g. 3 years)"]].map(([field, label]) => (
          <div key={field} className={field === "courseName" ? "md:col-span-2" : ""}>
            <label className="text-xs text-gray-400 mb-1 block">{label}</label>
            <input value={data[field] || ""} onChange={(e) => onChange(field, e.target.value)} className={`w-full ${inputCls}`} />
          </div>
        ))}

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Institution</label>
          {isCollege ? (
            <input
              value={data.institution || ""}
              onChange={(e) => onChange("institution", e.target.value)}
              placeholder="e.g. Ekurhuleni East TVET College"
              className={`w-full ${inputCls}`}
            />
          ) : (
            <select value={data.institution || ""} onChange={(e) => onChange("institution", e.target.value)} className={`w-full ${inputCls}`}>
              {INSTITUTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          )}
        </div>

        {isCollege && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Campus (optional)</label>
            <input
              value={data.campus || ""}
              onChange={(e) => onChange("campus", e.target.value)}
              placeholder="e.g. Boksburg Campus"
              className={`w-full ${inputCls}`}
            />
            <p className="text-xs text-gray-600 mt-1">
              Leave blank if this college has one site. Fill in when the same college offers this
              course at multiple campuses — the college goes in Institution above, the specific
              site goes here.
            </p>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Qualification Type</label>
          <select value={data.qualificationType || ""} onChange={(e) => onChange("qualificationType", e.target.value)} className={`w-full ${inputCls}`}>
            {qualOptions.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>

        <div className={isCollege ? "md:col-span-2" : ""}>
          <label className="text-xs text-gray-400 mb-1 block">
            Minimum APS {isCollege && <span className="text-gray-500">(usually not used for colleges — leave 0)</span>}
          </label>
          <input type="number" value={data.minAPS || ""} onChange={(e) => onChange("minAPS", Number(e.target.value))} className={`w-full ${inputCls}`} />
        </div>
      </div>

      {/* Alternate APS — different minAPS depending on which subject the learner took,
          e.g. Mathematics vs Mathematical Literacy */}
      {!isCollege && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
              Alternate APS (subject-dependent)
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={addApsAlternative}
                className="text-xs bg-purple-800 hover:bg-purple-700 text-purple-300 px-2 py-1 rounded-lg transition">
                + Add alternate
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-600 mb-2">
            Use this if the minimum APS differs depending on which subject a learner took
            (e.g. Maths vs Maths Lit). Base Minimum APS above applies by default; if the
            learner has one of the subjects listed here, that APS is used instead.
          </p>
          {apsAlternatives.length === 0 ? (
            <p className="text-xs text-gray-600 italic px-1">No alternates — the base Minimum APS always applies.</p>
          ) : (
            <div className="space-y-2">
              {apsAlternatives.map((alt, i) => (
                <div key={i} className="flex gap-2 items-center bg-gray-800/50 rounded-xl px-3 py-2">
                  <span className="text-xs text-gray-500 shrink-0">If learner took</span>
                  <select
                    value={alt.subject || ""}
                    onChange={(e) => updateApsAlternative(i, "subject", e.target.value)}
                    className={`flex-1 ${inputCls}`}
                  >
                    <option value="">Select subject…</option>
                    {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="text-xs text-gray-500 shrink-0">min APS</span>
                  <input
                    type="number" value={alt.minAPS ?? 0}
                    onChange={(e) => updateApsAlternative(i, "minAPS", e.target.value)}
                    className={markCls}
                  />
                  <button type="button" onClick={() => removeApsAlternative(i)}
                    className="text-red-500 hover:text-red-400 font-bold px-1">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isCollege && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Minimum Grade</label>
              <select
                value={data.minGrade || ""}
                onChange={(e) => onChange("minGrade", e.target.value || null)}
                className={`w-full ${inputCls}`}
              >
                <option value="">None</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Minimum NQF Level</label>
              <select
                value={data.minNQFLevel || ""}
                onChange={(e) => onChange("minNQFLevel", e.target.value ? Number(e.target.value) : null)}
                className={`w-full ${inputCls}`}
              >
                <option value="">None</option>
                <option value="1">NQF Level 1</option>
                <option value="2">NQF Level 2</option>
                <option value="3">NQF Level 3</option>
                <option value="4">NQF Level 4</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Set at least one. If both are set, the learner must meet both. Leave both blank for open enrolment (no minimum).
          </p>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Admission Requirement (free text — shown to users)
            </label>
            <textarea
              value={data.admissionRequirement || ""}
              onChange={(e) => onChange("admissionRequirement", e.target.value)}
              placeholder='e.g. "NQF Level 2: Grade 9 or higher. NQF Levels 3 & 4: Competency at NQF Level 3/4 of the same sub field."'
              rows={3}
              className={`w-full ${inputCls} resize-none`}
            />
            <p className="text-xs text-gray-500 mt-1">
              This is purely descriptive — eligibility is determined by the Minimum Grade / NQF Level fields above.
            </p>
          </div>

          {/* Curriculum — optional, display-only subject structure (e.g. NC(V) programmes) */}
          <div className="border border-gray-700 rounded-xl p-3 space-y-3">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">
                Curriculum (optional — display only)
              </p>
              <p className="text-xs text-gray-600">
                For programmes like NC(V) that list compulsory fundamental subjects plus vocational
                subjects offered at specific NQF levels (some optional). Shown to students but does
                NOT affect eligibility — that's still controlled by Minimum Grade / NQF Level above.
              </p>
            </div>

            {/* Fundamental subjects */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Compulsory Fundamental Subjects</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {fundamentalSubjects.map((s, i) => (
                  <span key={i} className="text-xs bg-gray-800 border border-gray-600 text-gray-300 rounded-full pl-2.5 pr-1 py-1 flex items-center gap-1.5">
                    {s}
                    <button type="button" onClick={() => removeFundamental(i)} className="text-red-500 hover:text-red-400 font-bold">✕</button>
                  </span>
                ))}
                {fundamentalSubjects.length === 0 && <p className="text-xs text-gray-600 italic">None added yet.</p>}
              </div>
              <div className="flex gap-2">
                <input
                  value={fundamentalInput}
                  onChange={(e) => setFundamentalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addFundamental(fundamentalInput); setFundamentalInput(""); }
                  }}
                  placeholder="e.g. English First Additional Language"
                  className={`flex-1 ${inputCls}`}
                />
                <button type="button"
                  onClick={() => { addFundamental(fundamentalInput); setFundamentalInput(""); }}
                  className="text-xs bg-green-800 hover:bg-green-700 text-green-300 px-3 py-2 rounded-lg transition">
                  + Add
                </button>
              </div>
            </div>

            {/* Vocational subjects */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400 block">Vocational Subjects</label>
                <button type="button" onClick={addVocational}
                  className="text-xs bg-amber-800 hover:bg-amber-700 text-amber-300 px-2 py-1 rounded-lg transition">
                  + Add vocational subject
                </button>
              </div>
              {vocationalSubjects.length === 0 ? (
                <p className="text-xs text-gray-600 italic">None added yet.</p>
              ) : (
                <div className="space-y-2">
                  {vocationalSubjects.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center bg-gray-800/50 rounded-xl px-3 py-2">
                      <input
                        value={v.subject || ""}
                        onChange={(e) => updateVocational(i, "subject", e.target.value)}
                        placeholder="e.g. Electrical Principles and Practice"
                        className={`flex-1 ${inputCls}`}
                      />
                      <input
                        value={v.levels || ""}
                        onChange={(e) => updateVocational(i, "levels", e.target.value)}
                        placeholder="e.g. 2-4"
                        className={`w-20 ${inputCls}`}
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                        <input
                          type="checkbox"
                          checked={!!v.optional}
                          onChange={(e) => updateVocational(i, "optional", e.target.checked)}
                        />
                        Optional
                      </label>
                      <button type="button" onClick={() => removeVocational(i)}
                        className="text-red-500 hover:text-red-400 font-bold px-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-600 mt-1">
                "Levels" is free text (e.g. "2", "2-4", "3-4") since NC(V) subjects are assessed by
                NQF competency level rather than percentage mark.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Key Subjects */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Required Subjects</label>
          <div className="flex gap-2">
            <button type="button" onClick={addSingle}
              className="text-xs bg-green-800 hover:bg-green-700 text-green-300 px-2 py-1 rounded-lg transition">
              + Single
            </button>
            <button type="button" onClick={addGroup}
              className="text-xs bg-blue-800 hover:bg-blue-700 text-blue-300 px-2 py-1 rounded-lg transition">
              + OR Group
            </button>
          </div>
        </div>

        {/* Quick-add presets — common requirement combos in one click */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {[
            { label: "+ English (Level 4)", req: { subject: "English Home Language", minMark: 50 } },
            { label: "+ Maths (Level 4)",   req: { subject: "Mathematics", minMark: 50 } },
            { label: "+ Maths (L4) OR Maths Lit (L5)", req: { subjectGroup: [{ subject: "Mathematics", minMark: 50 }, { subject: "Mathematical Literacy", minMark: 60 }] } },
            { label: "+ LO OR Computer Literacy (L3)", req: { subjectGroup: [{ subject: "Life Orientation", minMark: 40 }, { subject: "Computer Literacy", minMark: 40 }] } },
            {
              label: "+ Second Language (any of 11, L3)",
              req: { subjectGroup: FAL_SUBJECTS.map((s) => ({ subject: s, minMark: 40 })) },
            },
          ].map((preset, idx) => (
            <button key={idx} type="button"
              onClick={() => onChange("keySubjects", [...keySubjects, preset.req])}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full border border-gray-600 transition">
              {preset.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600 -mt-1 mb-2">
          "Second Language" adds an OR group across all 11 official languages' First Additional
          Language subjects — a learner satisfies it with any one of them at the mark you set
          (edit the mark per-option afterwards if needed).
        </p>

        {keySubjects.length === 0 ? (
          <p className="text-xs text-gray-600 italic px-1">
            No required subjects — open to all with qualifying APS.
          </p>
        ) : (
          <div className="space-y-3">
            {keySubjects.map((ks, i) => (
              <div key={i}>
                {/* ── Single subject requirement ── */}
                {!ks.subjectGroup ? (
                  <div className="flex gap-2 items-center bg-gray-800/50 rounded-xl px-3 py-2">
                    <select
                      value={ks.subject || ""}
                      onChange={(e) => updateSingle(i, "subject", e.target.value)}
                      className={`flex-1 ${inputCls}`}
                    >
                      <option value="">Select subject…</option>
                      {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <span className="text-gray-500 text-xs shrink-0">≥</span>
                    <select
                      value={markToLevel(ks.minMark ?? 50)}
                      onChange={(e) => updateSingle(i, "minMark", levelToMinMark(e.target.value))}
                      className={`${inputCls} w-36 shrink-0`}
                    >
                      {NSC_LEVEL_OPTIONS.map((o) => (
                        <option key={o.level} value={o.level}>{o.label}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeReq(i)}
                      className="text-red-500 hover:text-red-400 font-bold px-1">✕</button>
                  </div>
                ) : (
                  /* ── OR group ── */
                  <div className="border border-blue-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">OR Group</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => addGroupOption(i)}
                          className="text-xs text-blue-400 hover:text-blue-300">+ option</button>
                        <button type="button" onClick={() => removeReq(i)}
                          className="text-xs text-red-500 hover:text-red-400 font-bold">✕ Remove group</button>
                      </div>
                    </div>
                    {ks.subjectGroup.map((opt, j) => (
                      <div key={j} className="flex gap-2 items-center">
                        {j > 0 && (
                          <span className="text-xs text-blue-500 font-bold shrink-0 w-6 text-center">OR</span>
                        )}
                        {j === 0 && <div className="w-6 shrink-0" />}
                        <select
                          value={opt.subject || ""}
                          onChange={(e) => updateGroupOption(i, j, "subject", e.target.value)}
                          className={`flex-1 ${inputCls}`}
                        >
                          <option value="">Select subject…</option>
                          {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <span className="text-gray-500 text-xs shrink-0">≥</span>
                        <select
                          value={markToLevel(opt.minMark ?? 50)}
                          onChange={(e) => updateGroupOption(i, j, "minMark", levelToMinMark(e.target.value))}
                          className={`${inputCls} w-36 shrink-0`}
                        >
                          {NSC_LEVEL_OPTIONS.map((o) => (
                            <option key={o.level} value={o.level}>{o.label}</option>
                          ))}
                        </select>
                        {ks.subjectGroup.length > 2 && (
                          <button type="button" onClick={() => removeGroupOption(i, j)}
                            className="text-red-500 hover:text-red-400 font-bold px-1">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Dashboard");

  // Users state — merged Auth + Firestore
  const [currentUserRole, setCurrentUserRole] = useState("admin"); // safe default; upgraded to "super" only after verified
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchUser, setSearchUser] = useState("");
  const [expandedUser, setExpandedUser] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  // User filters
  const [filterPlan, setFilterPlan] = useState("");
  const [filterAdmin, setFilterAdmin] = useState("");
  const [filterAuthOnly, setFilterAuthOnly] = useState("");

  // Course filters
  const [filterFaculty, setFilterFaculty] = useState("");
  const [filterInstitution, setFilterInstitution] = useState("");
  const [filterQualType, setFilterQualType] = useState("");
  const [filterMinAPS, setFilterMinAPS] = useState("");
  const [filterMaxAPS, setFilterMaxAPS] = useState("");

  // Courses state — Firestore
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseSearch, setCourseSearch] = useState("");
  const [editingCourse, setEditingCourse] = useState(null); // null | course obj with id
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState(BLANK_COURSE);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(null);
  const [seedExclusions, setSeedExclusions] = useState([]);
  const [showSeedExclusions, setShowSeedExclusions] = useState(false);
  const [selectedVarsity, setSelectedVarsity] = useState(null); // null = show varsity grid, else show that varsity's courses

  // Institution application windows (open/close dates)
  const [institutionSettings, setInstitutionSettings] = useState({}); // { [institution]: { openDate, closeDate } }
  const [editingInstitutionDates, setEditingInstitutionDates] = useState(null); // institution name | null
  const [datesForm, setDatesForm] = useState({ openDate: "", closeDate: "" });

  // Bulk delete mode
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState(() => new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Settings
  const [adminEmailInput, setAdminEmailInput] = useState("");

  // UI
  const [toast, setToast] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load users from Firestore ────────────────────────────────────────────
  // Note: Firebase Auth user listing requires Admin SDK (server-side).
  // Users appear here as soon as they sign in (SignIn.jsx writes their doc).
  // For pre-existing Auth accounts, use "Import users" below.
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      setUsers(list);
      // Detect current user's role
      const me = auth.currentUser;
      if (me) {
        if (isSuperAdmin(me.email)) {
          setCurrentUserRole("super");
        } else {
          const myDoc = list.find((u) => u.uid === me.uid);
          setCurrentUserRole(myDoc?.adminRole || "admin");
        }
      }
    } catch (err) {
      showToast("Failed to load users: " + err.message, "error");
    } finally {
      setLoadingUsers(false);
    }
  }, []);


  // ── Load Firestore courses ───────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const snap = await getDocs(collection(db, "courses"));
      if (snap.empty) {
        // First run: seed from local JSON
        showToast("No courses in Firestore yet. Seed from local JSON first.", "error");
        setCourses([]);
      } else {
        setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      showToast("Failed to load courses: " + err.message, "error");
    } finally {
      setLoadingCourses(false);
    }
  }, []);



  // ── Load institution application-window settings ─────────────────────────
  const loadInstitutionSettings = useCallback(async () => {
    try {
      const map = await fetchInstitutionSettingsMap();
      setInstitutionSettings(map);
    } catch (err) {
      showToast("Failed to load application windows: " + err.message, "error");
    }
  }, []);

  useEffect(() => { loadUsers(); loadCourses(); loadInstitutionSettings(); }, [loadUsers, loadCourses, loadInstitutionSettings]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    total: users.length,
    free: users.filter((u) => !u.plan || u.plan === "free").length,

    applyForMe: users.filter((u) => u.plan === "apply_for_me").length,
    admins: users.filter((u) => u.isAdmin).length,
    authOnly: users.filter((u) => u.authOnly).length,
  };

  // ── User actions ─────────────────────────────────────────────────────────
  const handlePasswordReset = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(`Password reset sent to ${email}`);
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleDeleteUser = async (uid, email) => {
    try {
      // Delete Firestore doc
      await deleteDoc(doc(db, "users", uid));
      // Also call Auth REST delete (requires admin token)
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        await fetch(`https://identitytoolkit.googleapis.com/v1/projects/course-finder-214e7/accounts/${uid}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        });
      }
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      showToast(`User ${email} deleted`);
      setConfirmDeleteUser(null);
    } catch (err) { showToast(err.message, "error"); }
  };

  // Set a user's admin role. Pass role=null to revoke all admin access.
  const handleSetRole = async (uid, role) => {
    // Never allow modifying the super admin via UI
    const target = users.find((u) => u.uid === uid);
    if (target && isSuperAdmin(target.email)) {
      showToast("Super admin cannot be modified.", "error"); return;
    }
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      const updates = role
        ? { isAdmin: true, adminRole: role }
        : { isAdmin: false, adminRole: null };
      if (snap.exists()) { await updateDoc(ref, updates); }
      else { await setDoc(ref, { uid, ...updates }); }
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, ...updates } : u));
      showToast(role ? `Role set to "${role}"` : "Admin access revoked");
    } catch (err) { showToast(err.message, "error"); }
  };

  // Legacy alias used in Settings tab
  const handleToggleAdmin = (uid, isCurrentlyAdmin) =>
    handleSetRole(uid, isCurrentlyAdmin ? null : "admin");

  const handleChangePlan = async (uid, plan) => {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (snap.exists()) { await updateDoc(ref, { plan }); }
      else { await setDoc(ref, { plan, uid }); }
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, plan } : u));
      showToast("Plan updated");
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Course actions ────────────────────────────────────────────────────────
  // ── Audit log ──────────────────────────────────────────────────────────────
  // Records every course change with who, what, when. Only the super admin
  // can read this (enforced by Firestore rules), but any admin/moderator who
  // makes a change still gets logged — they just can't view the log.
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(true);

  const writeAuditLog = async (action, course, changedFields) => {
    const me = auth.currentUser;
    if (!me) return;
    try {
      await addDoc(collection(db, "courseAuditLogs"), {
        action,              // "add" | "edit" | "delete"
        courseId: course.id || null,
        courseName: course.courseName || "(unnamed course)",
        institution: course.institution || "",
        changedFields: changedFields || null, // for edits: { field: { from, to } }
        adminUid: me.uid,
        adminEmail: me.email || "unknown",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // Never block the actual course operation if logging fails
      console.error("Audit log write failed:", err);
    }
  };

  const loadAuditLogs = useCallback(async () => {
    if (!isSuperAdmin(auth.currentUser?.email)) return;
    setLoadingAuditLogs(true);
    try {
      const q = query(collection(db, "courseAuditLogs"), orderBy("timestamp", "desc"), limit(200));
      const snap = await getDocs(q);
      setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoadingAuditLogs(false);
    }
  }, []);

  useEffect(() => { loadAuditLogs(); }, [loadAuditLogs]);

  // Build a diff between the old course doc and the new edited data
  const buildCourseDiff = (oldData, newData) => {
    const diff = {};
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    allKeys.forEach((key) => {
      if (key === "id") return;
      const oldVal = JSON.stringify(oldData[key] ?? null);
      const newVal = JSON.stringify(newData[key] ?? null);
      if (oldVal !== newVal) {
        diff[key] = { from: oldData[key] ?? null, to: newData[key] ?? null };
      }
    });
    return diff;
  };

  // Firestore batched writes are capped at 500 operations each; chunk to stay
  // safely under that regardless of how large courses.json grows.
  const SEED_BATCH_LIMIT = 400;

  // Shared add-or-replace logic for both seed buttons below.
  //
  // Behavior: for every course in the local JSON, look it up in Firestore by
  // dedupeKey (courseName + institution + campus + faculty + qualificationCode).
  //   - No match, not tombstoned  -> ADD as a new doc.
  //   - Match found               -> REPLACE the existing doc's fields with
  //                                   the JSON version (this is what makes
  //                                   editing a course in courses.json and
  //                                   re-seeding actually push the fix live,
  //                                   instead of the old behavior of treating
  //                                   any dedupe-key match as "already seeded"
  //                                   and silently skipping it forever).
  //   - Tombstoned (previously
  //     deleted via the admin panel) -> always skipped, regardless of match,
  //                                      so intentional deletions don't come back.
  // If the same dedupeKey matches more than one existing doc (a leftover from
  // before this dedupe key included qualificationCode), all of them are
  // updated to the same JSON data rather than picking one arbitrarily.
  async function seedCoursesInto(localCourses) {
    const [snap, excluded] = await Promise.all([
      getDocs(collection(db, "courses")),
      getSeedExclusions(),
    ]);

    const existingByKey = new Map(); // dedupeKey -> [docId, ...]
    for (const d of snap.docs) {
      const key = courseDedupeKey(d.data());
      if (!existingByKey.has(key)) existingByKey.set(key, []);
      existingByKey.get(key).push(d.id);
    }

    let added = 0, updated = 0, skippedExcluded = 0;
    const ops = [];

    for (const course of localCourses) {
      const key = courseDedupeKey(course);
      if (excluded.has(key)) { skippedExcluded++; continue; }

      const existingIds = existingByKey.get(key);
      if (existingIds && existingIds.length > 0) {
        for (const id of existingIds) {
          ops.push({ ref: doc(db, "courses", id), data: course });
          updated++;
        }
      } else {
        ops.push({ ref: doc(collection(db, "courses")), data: course });
        added++;
      }
    }

    for (let i = 0; i < ops.length; i += SEED_BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + SEED_BATCH_LIMIT)) {
        batch.set(op.ref, op.data);
      }
      await batch.commit();
    }

    return { added, updated, skippedExcluded };
  }

  const handleSeedCourses = async () => {
    try {
      showToast("Syncing courses from courses.json…");
      const { default: localCourses } = await import("../data/courses.json");
      const { added, updated, skippedExcluded } = await seedCoursesInto(localCourses);

      if (added === 0 && updated === 0) {
        showToast("✓ No changes — Firestore is already up to date.");
        return;
      }

      const parts = [];
      if (added) parts.push(`${added} added`);
      if (updated) parts.push(`${updated} updated`);
      if (skippedExcluded) parts.push(`${skippedExcluded} skipped (previously deleted)`);
      showToast(`✓ Sync complete — ${parts.join(", ")}.`);
      loadCourses();
    } catch (err) {
      showToast("Seed failed: " + err.message, "error");
    }
  };

  const handleSeedCollegeCourses = async () => {
    try {
      showToast("Syncing college courses from college-courses.json…");
      const { default: localCollegeCourses } = await import("../data/college-courses.json");
      const expanded = localCollegeCourses.flatMap(expandCollegeCourse);
      const { added, updated, skippedExcluded } = await seedCoursesInto(expanded);

      if (added === 0 && updated === 0) {
        showToast("✓ No changes — Firestore is already up to date.");
        return;
      }

      const parts = [];
      if (added) parts.push(`${added} added`);
      if (updated) parts.push(`${updated} updated`);
      if (skippedExcluded) parts.push(`${skippedExcluded} skipped (previously deleted)`);
      showToast(`✓ Sync complete — ${parts.join(", ")}.`);
      loadCourses();
    } catch (err) {
      showToast("Seed failed: " + err.message, "error");
    }
  };

  const handleSaveCourse = async () => {
    try {
      const { id, ...data } = editingCourse;
      const original = courses.find((c) => c.id === id) || {};
      const diff = buildCourseDiff(original, data);

      await updateDoc(doc(db, "courses", id), data);
      setCourses((prev) => prev.map((c) => c.id === id ? { id, ...data } : c));

      if (Object.keys(diff).length > 0) {
        await writeAuditLog("edit", { id, ...data }, diff);
        loadAuditLogs();
      }

      setEditingCourse(null);
      showToast("Course updated");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleAddCourse = async () => {
    try {
      const ref = await addDoc(collection(db, "courses"), newCourse);
      const created = { id: ref.id, ...newCourse };
      setCourses((prev) => [...prev, created]);
      await writeAuditLog("add", created, null);
      loadAuditLogs();
      setNewCourse(BLANK_COURSE);
      setAddingCourse(false);
      showToast("Course added");
    } catch (err) { showToast(err.message, "error"); }
  };

  const loadSeedExclusions = async () => {
    const snap = await getDoc(SEED_EXCLUSIONS_DOC);
    setSeedExclusions(snap.exists() ? snap.data().keys || [] : []);
  };

  const handleRestoreSeedExclusion = async (key) => {
    try {
      await removeSeedExclusion(key);
      setSeedExclusions((prev) => prev.filter((k) => k !== key));
      showToast("Restored — it'll be re-added next time you seed.");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteCourse = async (id, name) => {
    try {
      const deletedCourse = courses.find((c) => c.id === id) || { id, courseName: name };
      await deleteDoc(doc(db, "courses", id));
      await addSeedExclusion(courseDedupeKey(deletedCourse));
      setCourses((prev) => prev.filter((c) => c.id !== id));
      await writeAuditLog("delete", deletedCourse, null);
      loadAuditLogs();
      setConfirmDeleteCourse(null);
      showToast(`"${name}" deleted`);
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Institution application windows ──────────────────────────────────────
  const openInstitutionDatesEditor = (institution) => {
    const s = institutionSettings[institution] || {};
    setDatesForm({ openDate: s.openDate || "", closeDate: s.closeDate || "" });
    setEditingInstitutionDates(institution);
  };

  const handleSaveInstitutionDates = async () => {
    if (!editingInstitutionDates) return;
    try {
      await saveInstitutionSettings(editingInstitutionDates, datesForm, auth.currentUser?.email);
      setInstitutionSettings((prev) => ({
        ...prev,
        [editingInstitutionDates]: {
          openDate: datesForm.openDate || null,
          closeDate: datesForm.closeDate || null,
        },
      }));
      showToast(`Application window saved for ${editingInstitutionDates}`);
      setEditingInstitutionDates(null);
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleClearInstitutionDates = async () => {
    if (!editingInstitutionDates) return;
    try {
      await saveInstitutionSettings(editingInstitutionDates, { openDate: null, closeDate: null }, auth.currentUser?.email);
      setInstitutionSettings((prev) => ({ ...prev, [editingInstitutionDates]: { openDate: null, closeDate: null } }));
      showToast(`${editingInstitutionDates} is now always open (dates cleared)`);
      setEditingInstitutionDates(null);
    } catch (err) { showToast(err.message, "error"); }
  };

  // ── Bulk delete ───────────────────────────────────────────────────────────
  const toggleBulkSelected = (id) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllBulkMatches = (matches) => setBulkSelectedIds(new Set(matches.map((c) => c.id)));
  const clearBulkSelection = () => setBulkSelectedIds(new Set());

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const toDelete = courses.filter((c) => bulkSelectedIds.has(c.id));

      // Delete the Firestore docs in batches (500-op cap per batch).
      for (let i = 0; i < toDelete.length; i += SEED_BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (const c of toDelete.slice(i, i + SEED_BATCH_LIMIT)) {
          batch.delete(doc(db, "courses", c.id));
        }
        await batch.commit();
      }

      // Tombstone all of them in one write so re-seeding from courses.json
      // doesn't silently bring any of them back.
      const keys = toDelete.map((c) => courseDedupeKey(c));
      if (keys.length > 0) {
        await setDoc(SEED_EXCLUSIONS_DOC, { keys: arrayUnion(...keys) }, { merge: true });
      }

      // One audit log entry per deleted course, same as a single delete.
      await Promise.all(toDelete.map((c) => writeAuditLog("delete", c, null)));

      setCourses((prev) => prev.filter((c) => !bulkSelectedIds.has(c.id)));
      setBulkSelectedIds(new Set());
      setConfirmBulkDelete(false);
      setBulkMode(false);
      showToast(`Deleted ${toDelete.length} course(s)`);
      loadAuditLogs();
      loadSeedExclusions();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleGrantAdminByEmail = async () => {
    const email = adminEmailInput.trim().toLowerCase();
    if (!email) return;
    const found = users.find((u) => (u.email || "").toLowerCase() === email);
    if (!found) { showToast("User not found", "error"); return; }
    await handleToggleAdmin(found.uid, false);
    setAdminEmailInput("");
  };

  // ── Import pre-existing Auth users by pasting emails ────────────────────
  // Since we can't list Firebase Auth users client-side, paste their emails
  // (one per line) from the Firebase Console to create Firestore stubs.
  const handleImportUsers = async () => {
    const emails = importText
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) { showToast("No valid emails found", "error"); return; }

    let created = 0, skipped = 0;
    for (const email of emails) {
      const exists = users.find((u) => (u.email || "").toLowerCase() === email);
      if (exists) { skipped++; continue; }
      // Create a stub — uid will be filled when they next sign in
      const stubId = `stub_${email.replace(/[^a-z0-9]/g, "_")}`;
      try {
        await setDoc(doc(db, "users", stubId), {
          uid: stubId,
          email,
          firstName: "",
          lastName: "",
          dob: "",
          plan: "free",
          isAdmin: false,
          stub: true, // flag so we know it's incomplete
          createdAt: new Date().toISOString(),
        });
        created++;
      } catch (err) {
        console.error("Stub create failed:", email, err);
      }
    }

    showToast(`Imported ${created} user(s), skipped ${skipped} existing.`);
    setImportText("");
    setShowImport(false);
    loadUsers();
  };

  // ── Filters ───────────────────────────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    const matchSearch = !searchUser ||
      (u.email || "").toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.firstName || "").toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.lastName || "").toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.displayName || "").toLowerCase().includes(searchUser.toLowerCase());
    const matchPlan = !filterPlan || (u.plan || "free") === filterPlan;
    const matchAdmin = filterAdmin === "" || String(!!u.isAdmin) === filterAdmin;
    const matchAuthOnly = filterAuthOnly === "" || String(!!u.authOnly) === filterAuthOnly;
    return matchSearch && matchPlan && matchAdmin && matchAuthOnly;
  });

  const filteredCourses = courses.filter((c) => {
    const matchSearch = !courseSearch ||
      c.courseName?.toLowerCase().includes(courseSearch.toLowerCase()) ||
      c.institution?.toLowerCase().includes(courseSearch.toLowerCase());
    const matchFaculty = !filterFaculty || c.faculty === filterFaculty;
    const matchInstitution = !filterInstitution || c.institution === filterInstitution;
    const matchQualType = !filterQualType || c.qualificationType === filterQualType;
    const matchMinAPS = !filterMinAPS || c.minAPS >= Number(filterMinAPS);
    const matchMaxAPS = !filterMaxAPS || c.minAPS <= Number(filterMaxAPS);
    return matchSearch && matchFaculty && matchInstitution && matchQualType && matchMinAPS && matchMaxAPS;
  });

  // ── Sub-renders ───────────────────────────────────────────────────────────
  const planBadge = (plan) => {
    const styles = {
      free: "bg-gray-700 text-gray-300",
      apply_for_me: "bg-purple-900 text-purple-300",
    };
    const labels = { free: "Free", apply_for_me: "Apply R100" };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[plan] || styles.free}`}>{labels[plan] || "Free"}</span>;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === "error" ? "bg-red-600" : "bg-green-600"} text-white max-w-sm`}>
          {toast.msg}
        </div>
      )}

      {/* Import users modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div>
              <p className="text-lg font-bold text-white">Import Users from Firebase Console</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Go to Firebase Console → Authentication → Users, copy the email addresses
                (Identifier column) and paste them below — one per line or comma-separated.
                This creates Firestore stubs so they appear in the admin panel immediately.
              </p>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"user1@example.com\nuser2@example.com\nuser3@example.com"}
              rows={6}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowImport(false); setImportText(""); }}
                className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleImportUsers}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition">
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete user */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 text-center space-y-4">
            <p className="text-lg font-bold text-red-400">Delete User?</p>
            <p className="text-gray-400 text-sm">
              Permanently delete <span className="text-white font-medium">{confirmDeleteUser.email}</span> from Auth and Firestore.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteUser(null)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={() => handleDeleteUser(confirmDeleteUser.uid, confirmDeleteUser.email)} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete course */}
      {confirmDeleteCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 text-center space-y-4">
            <p className="text-lg font-bold text-red-400">Delete Course?</p>
            <p className="text-gray-400 text-sm">Remove <span className="text-white font-medium">"{confirmDeleteCourse.courseName}"</span> permanently?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteCourse(null)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={() => handleDeleteCourse(confirmDeleteCourse.id, confirmDeleteCourse.courseName)} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit course modal */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col">
            <h3 className="text-lg font-bold text-white px-6 pt-6 pb-3 shrink-0 border-b border-gray-800">Edit Course</h3>
            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
              <CourseFormFields data={editingCourse} onChange={(f, v) => setEditingCourse((p) => ({ ...p, [f]: v }))} />
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
              <button onClick={() => setEditingCourse(null)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleSaveCourse} className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add course modal */}
      {addingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col">
            <h3 className="text-lg font-bold text-white px-6 pt-6 pb-3 shrink-0 border-b border-gray-800">Add New Course</h3>
            <div className="overflow-y-auto flex-1 min-h-0 px-6 py-4">
              <CourseFormFields data={newCourse} onChange={(f, v) => setNewCourse((p) => ({ ...p, [f]: v }))} />
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
              <button onClick={() => setAddingCourse(false)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleAddCourse} className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-semibold transition">Add Course</button>
            </div>
          </div>
        </div>
      )}

      {/* Institution application-window editor */}
      {editingInstitutionDates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Application Window</h3>
            <p className="text-sm text-gray-300">{editingInstitutionDates}</p>
            <p className="text-xs text-gray-500">
              Leave both fields blank to keep this institution always open. While a student is
              selecting institutions to apply to, any institution outside its window shows as
              closed and can't be picked.
            </p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Opens on</label>
              <input type="date" value={datesForm.openDate}
                onChange={(e) => setDatesForm((f) => ({ ...f, openDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Closes on</label>
              <input type="date" value={datesForm.closeDate}
                onChange={(e) => setDatesForm((f) => ({ ...f, closeDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditingInstitutionDates(null)}
                className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleSaveInstitutionDates}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition">Save</button>
            </div>
            {(institutionSettings[editingInstitutionDates]?.openDate || institutionSettings[editingInstitutionDates]?.closeDate) && (
              <button onClick={handleClearInstitutionDates}
                className="w-full text-xs text-red-400 hover:text-red-300 transition">
                Clear dates (always open)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirm bulk delete */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 text-center space-y-4">
            <p className="text-lg font-bold text-red-400">Delete {bulkSelectedIds.size} Course{bulkSelectedIds.size !== 1 ? "s" : ""}?</p>
            <p className="text-gray-400 text-sm">This permanently removes all selected courses and can't be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting}
                className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition disabled:opacity-60">Cancel</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold transition disabled:opacity-60">
                {bulkDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top nav */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-sm font-bold">A</div>
          <span className="font-bold text-white text-lg">Admin Panel</span>
          <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">RESTRICTED</span>
        </div>
        <button onClick={() => navigate("/home")} className="text-gray-400 hover:text-white text-sm transition">← Back to App</button>
      </div>

      {/* Tabs — filtered by current user's role permissions */}
      <div className="flex border-b border-gray-800 px-6">
        {ALL_TABS
          .filter((t) => (PERMISSIONS[currentUserRole] || []).includes(t.toLowerCase()))
          .map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px
                ${tab === t ? "border-purple-500 text-purple-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
              {t}
            </button>
          ))}
      </div>

      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">

        {/* ── DASHBOARD ── */}
        {tab === "Dashboard" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={stats.total} icon="👥" color="from-blue-600 to-blue-800" />
              <StatCard label="Free Plan" value={stats.free} icon="✅" color="from-gray-600 to-gray-800" />
              <StatCard label="Apply For Me (R100)" value={stats.applyForMe} icon="🚀" color="from-purple-700 to-pink-700" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Total Courses" value={courses.length} icon="📚" color="from-green-700 to-teal-700" />
              <StatCard label="Auth-Only Accounts" value={stats.authOnly} icon="👤" color="from-orange-700 to-red-700" />
              <StatCard label="Est. Revenue" value={`R${stats.applyForMe * 150}`} icon="💰" color="from-yellow-600 to-orange-600" />
            </div>

            {/* Plan distribution */}
            {stats.total > 0 && (
              <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                <p className="text-sm font-semibold text-gray-300 mb-3">Plan Distribution</p>
                <div className="flex rounded-full overflow-hidden h-4 mb-3">
                  <div className="bg-gray-500" style={{ width: `${(stats.free/stats.total)*100}%` }} />
                  <div className="bg-purple-500" style={{ width: `${(stats.applyForMe/stats.total)*100}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span><span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1"/>Free ({Math.round((stats.free/stats.total)*100)}%)</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1"/>Apply ({Math.round((stats.applyForMe/stats.total)*100)}%)</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "Users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold text-white">
                Users <span className="text-gray-500 font-normal text-base">({filteredUsers.length})</span>
                {stats.authOnly > 0 && (
                  <span className="ml-2 text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded-full">
                    {stats.authOnly} auth-only
                  </span>
                )}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setShowImport(true)}
                  className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-900 px-3 py-1.5 rounded-lg transition">
                  ⬇ Import
                </button>
                <button onClick={loadUsers} className="text-xs text-purple-400 hover:text-purple-300 border border-gray-700 px-3 py-1.5 rounded-lg transition">
                  ↻ Refresh
                </button>
              </div>
            </div>

            <input value={searchUser} onChange={(e) => setSearchUser(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />

            {/* User filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">All Plans</option>
                <option value="free">Free</option>
                <option value="ad_free">Ad-Free (R30)</option>
                <option value="apply_for_me">Apply For Me (R100)</option>
              </select>
              <select value={filterAdmin} onChange={(e) => setFilterAdmin(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">All Roles</option>
                <option value="true">Admins Only</option>
                <option value="false">Non-Admins</option>
              </select>
              <select value={filterAuthOnly} onChange={(e) => setFilterAuthOnly(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">All Account Types</option>
                <option value="true">Auth-Only (no profile)</option>
                <option value="false">Has Profile</option>
              </select>
              {(filterPlan || filterAdmin || filterAuthOnly) && (
                <button onClick={() => { setFilterPlan(""); setFilterAdmin(""); setFilterAuthOnly(""); }}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-900 px-2 py-1 rounded-lg transition">
                  Clear filters
                </button>
              )}
              <span className="text-xs text-gray-600 ml-auto">{filteredUsers.length} of {users.length} users</span>
            </div>

            {loadingUsers ? (
              <p className="text-gray-500 text-sm py-8 text-center">Loading users…</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">No users found.</p>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <div key={user.uid} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-800/40 transition"
                      onClick={() => setExpandedUser(expandedUser === user.uid ? null : user.uid)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-purple-900 flex items-center justify-center text-sm font-bold text-purple-300 shrink-0">
                          {((user.firstName || user.displayName || user.email || "?")[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {user.firstName ? `${user.firstName} ${user.lastName || ""}` : (user.displayName || user.email || "Unknown")}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {user.authOnly && <span className="text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded-full">Auth-only</span>}
                        {user.isAdmin && (() => {
                          const ri = getRoleInfo(user.adminRole || "admin");
                          return <span className={`text-xs px-2 py-0.5 rounded-full ${ri?.bg || "bg-red-900"} ${ri?.color || "text-red-300"}`}>{ri?.badge} {ri?.label || "Admin"}</span>;
                        })()}
                        {planBadge(user.plan)}
                        <span className="text-gray-600">{expandedUser === user.uid ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {expandedUser === user.uid && (
                      <div className="border-t border-gray-800 px-5 py-4 space-y-4">

                        {/* Profile card */}
                        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Profile</p>
                          <div className="grid grid-cols-2 gap-3">
                            <InfoCell label="First Name" value={user.firstName || user.displayName?.split(" ")[0] || "—"} />
                            <InfoCell label="Last Name" value={user.lastName || user.displayName?.split(" ").slice(1).join(" ") || "—"} />
                            <InfoCell label="Email" value={user.email} />
                            <InfoCell label="Date of Birth" value={user.dob || "—"} />
                          </div>
                        </div>

                        {/* Account info */}
                        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Account</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <InfoCell label="UID" value={user.uid} mono />
                            <InfoCell label="Plan" value={user.plan || "free"} />
                            <InfoCell label="Admin" value={user.isAdmin ? "Yes" : "No"} />
                            <InfoCell label="Joined" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-ZA") : "—"} />
                            <InfoCell label="Last Login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("en-ZA") : "—"} />
                            <InfoCell label="Email Verified" value={user.emailVerified ? "Yes" : "No"} />
                          </div>
                        </div>

                        {user.subjects?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 mb-2 font-medium">Entered Subjects (APS: {user.aps || "—"})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {user.subjects.map((s, i) => (
                                <span key={i} className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-lg">
                                  {s.subject}: <span className="text-white font-semibold">{s.mark}%</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Apply For Me selections */}
                        {user.applySelections && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-gray-400 font-medium">
                                Apply For Me Selections
                                {user.applyStatus && (
                                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                    user.applyStatus === "complete" ? "bg-green-900 text-green-300" :
                                    user.applyStatus === "in_progress" ? "bg-blue-900 text-blue-300" :
                                    "bg-yellow-900 text-yellow-300"
                                  }`}>
                                    {user.applyStatus === "complete" ? "✓ Complete" :
                                     user.applyStatus === "in_progress" ? "In Progress" : "Pending"}
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="space-y-2">
                              {Object.entries(user.applySelections).map(([inst, choices]) => (
                                <div key={inst} className="bg-gray-800 rounded-xl p-3">
                                  <p className="text-white text-xs font-semibold mb-1">{inst}</p>
                                  {[1, 2, 3].map((r) => choices[r] && (
                                    <p key={r} className="text-gray-400 text-xs">
                                      <span className="text-purple-400">Choice {r}:</span> {choices[r].courseName}
                                    </p>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Application contact details */}
                        {(user.applyPhone || user.applyEmail) && (
                          <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Application Contact</p>
                            {user.applyPhone && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-white">📞 {user.applyPhone}</span>
                                <a href={"https://wa.me/" + user.applyPhone.replace(/[^0-9]/g, "")}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-xs bg-green-800 text-green-300 px-2 py-0.5 rounded-full hover:bg-green-700 transition">
                                  WhatsApp ↗
                                </a>
                              </div>
                            )}
                            {user.applyEmail && (
                              <p className="text-sm text-white">✉️ {user.applyEmail}</p>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-1">
                          {/* Quick grant Apply For Me */}
                          {user.plan !== "apply_for_me" ? (
                            <button
                              onClick={() => handleChangePlan(user.uid, "apply_for_me")}
                              className="bg-purple-800 hover:bg-purple-700 text-purple-200 text-xs px-3 py-1.5 rounded-lg transition font-medium"
                            >
                              🚀 Grant Apply For Me
                            </button>
                          ) : (
                            <button
                              onClick={() => handleChangePlan(user.uid, "free")}
                              className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition"
                            >
                              Revoke Apply For Me
                            </button>
                          )}
                          <select value={user.plan || "free"} onChange={(e) => handleChangePlan(user.uid, e.target.value)}
                            className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                            <option value="free">Set: Free</option>
                            <option value="apply_for_me">Set: Apply For Me (R100)</option>
                          </select>
                          <button onClick={() => handlePasswordReset(user.email)}
                            className="bg-blue-900 hover:bg-blue-800 text-blue-300 text-xs px-3 py-1.5 rounded-lg transition">
                            📧 Reset Password
                          </button>
                          {/* Role selector — only super admins can grant super role */}
                          {!isSuperAdmin(user.email) && (
                            <select
                              value={user.isAdmin ? (user.adminRole || "admin") : "none"}
                              onChange={(e) => handleSetRole(user.uid, e.target.value === "none" ? null : e.target.value)}
                              className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                            >
                              <option value="none">🚫 No Access</option>
                              <option value="moderator">🟡 Moderator (courses only)</option>
                              <option value="admin">🟠 Admin (full access)</option>
                              {isSuperAdmin(auth.currentUser?.email) && (
                                <option value="super">🔴 Super Admin</option>
                              )}
                            </select>
                          )}
                          {isSuperAdmin(user.email) && (
                            <span className="text-xs bg-red-900 text-red-300 px-3 py-1.5 rounded-lg">🔴 Super Admin (protected)</span>
                          )}
                          <button onClick={() => setConfirmDeleteUser({ uid: user.uid, email: user.email })}
                            className="bg-red-900 hover:bg-red-800 text-red-300 text-xs px-3 py-1.5 rounded-lg transition">
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── COURSES ── */}
        {tab === "Courses" && (
          <div className="space-y-4">

            {/* ═══ VARSITY GRID — landing view ═══ */}
            {!selectedVarsity && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-xl font-bold text-white">
                    Institutions <span className="text-gray-500 font-normal text-base">({courses.length} courses total)</span>
                  </h2>
                  <div className="flex gap-2">
                    <button onClick={handleSeedCourses}
                      className="text-xs bg-yellow-700 hover:bg-yellow-600 text-yellow-200 px-3 py-1.5 rounded-lg transition font-medium">
                      ⚡ Seed from JSON
                    </button>
                    <button onClick={handleSeedCollegeCourses}
                      className="text-xs bg-amber-700 hover:bg-amber-600 text-amber-200 px-3 py-1.5 rounded-lg transition font-medium">
                      🏫 Seed Colleges from JSON
                    </button>
                    <button onClick={async () => { await loadSeedExclusions(); setShowSeedExclusions((v) => !v); }}
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition font-medium">
                      🚫 Seed Exclusions
                    </button>
                    <button onClick={() => { setNewCourse(BLANK_COURSE); setAddingCourse(true); }}
                      className="text-xs bg-green-700 hover:bg-green-600 text-green-200 px-3 py-1.5 rounded-lg transition font-medium">
                      + Add Course
                    </button>
                    <button onClick={() => { setBulkMode((v) => !v); clearBulkSelection(); }}
                      className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${
                        bulkMode ? "bg-red-700 hover:bg-red-600 text-red-100" : "bg-red-900 hover:bg-red-800 text-red-300"
                      }`}>
                      {bulkMode ? "✕ Exit Bulk Delete" : "🗑️ Bulk Delete"}
                    </button>
                    <button onClick={loadCourses}
                      className="text-xs text-purple-400 hover:text-purple-300 border border-gray-700 px-3 py-1.5 rounded-lg transition">
                      ↻ Refresh
                    </button>
                  </div>
                </div>

                {bulkMode ? (
                  <BulkDeleteCoursesPanel
                    courses={filteredCourses}
                    allCourses={courses}
                    institutionSettings={institutionSettings}
                    filterFaculty={filterFaculty} setFilterFaculty={setFilterFaculty}
                    filterInstitution={filterInstitution} setFilterInstitution={setFilterInstitution}
                    filterQualType={filterQualType} setFilterQualType={setFilterQualType}
                    filterMinAPS={filterMinAPS} setFilterMinAPS={setFilterMinAPS}
                    filterMaxAPS={filterMaxAPS} setFilterMaxAPS={setFilterMaxAPS}
                    bulkSelectedIds={bulkSelectedIds}
                    toggleBulkSelected={toggleBulkSelected}
                    selectAllBulkMatches={selectAllBulkMatches}
                    clearBulkSelection={clearBulkSelection}
                    onDeleteClick={() => setConfirmBulkDelete(true)}
                  />
                ) : (
                <>

                {showSeedExclusions && (
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-300 mb-1">
                      Excluded from seeding ({seedExclusions.length})
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      Courses deleted from here are remembered, so seeding never silently re-adds them —
                      even if they're still in the local JSON file. Restore one if you want it back next
                      time you seed.
                    </p>
                    {seedExclusions.length === 0 ? (
                      <p className="text-sm text-gray-500">Nothing excluded right now.</p>
                    ) : (
                      <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                        {seedExclusions.map((key) => {
                          const [courseName, institution] = key.split("|||");
                          return (
                            <li key={key} className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
                              <span className="text-sm text-gray-300 truncate">
                                {courseName || "(unnamed)"} <span className="text-gray-500">· {institution}</span>
                              </span>
                              <button
                                onClick={() => handleRestoreSeedExclusion(key)}
                                className="text-xs text-purple-400 hover:text-purple-300 shrink-0 ml-3"
                              >
                                ↺ Restore
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                {loadingCourses ? (
                  <p className="text-gray-500 text-sm py-8 text-center">Loading courses…</p>
                ) : courses.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No courses found in Firestore.</p>
                    <p className="text-gray-500 text-sm mt-1">Use the "+ Add Course" button to add courses.</p>
                  </div>
                ) : (
                  <>
                    {/* Universities */}
                    {(() => {
                      const uniInstitutions = [...new Set(
                        courses.filter((c) => c.institutionType !== "college").map((c) => c.institution)
                      )].sort();
                      if (uniInstitutions.length === 0) return null;
                      return (
                        <div>
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">🎓 Universities</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {uniInstitutions.map((inst) => {
                              const count = courses.filter((c) => c.institution === inst).length;
                              const status = getInstitutionApplicationStatus(institutionSettings[inst]);
                              return (
                                <div key={inst} className="relative bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-purple-600 rounded-2xl p-4 transition group">
                                  <button onClick={() => setSelectedVarsity(inst)} className="text-left w-full">
                                    <p className="text-white font-semibold text-sm group-hover:text-purple-400 transition truncate pr-16">{inst}</p>
                                    <p className="text-gray-500 text-xs mt-1">{count} course{count !== 1 ? "s" : ""}</p>
                                  </button>
                                  <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                                    <InstitutionStatusBadge status={status} />
                                    <button onClick={() => openInstitutionDatesEditor(inst)}
                                      className="text-[10px] text-gray-500 hover:text-purple-400 underline">
                                      Set dates
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Colleges */}
                    {(() => {
                      const collegeInstitutions = [...new Set(
                        courses.filter((c) => c.institutionType === "college").map((c) => c.institution)
                      )].sort();
                      if (collegeInstitutions.length === 0) return null;
                      return (
                        <div className="mt-6">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">🏫 Colleges</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {collegeInstitutions.map((inst) => {
                              const count = courses.filter((c) => c.institution === inst).length;
                              const status = getInstitutionApplicationStatus(institutionSettings[inst]);
                              return (
                                <div key={inst} className="relative bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-amber-600 rounded-2xl p-4 transition group">
                                  <button onClick={() => setSelectedVarsity(inst)} className="text-left w-full">
                                    <p className="text-white font-semibold text-sm group-hover:text-amber-400 transition truncate pr-16">{inst}</p>
                                    <p className="text-gray-500 text-xs mt-1">{count} course{count !== 1 ? "s" : ""}</p>
                                  </button>
                                  <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
                                    <InstitutionStatusBadge status={status} />
                                    <button onClick={() => openInstitutionDatesEditor(inst)}
                                      className="text-[10px] text-gray-500 hover:text-amber-400 underline">
                                      Set dates
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
                </>
                )}
              </>
            )}

            {/* ═══ SINGLE VARSITY VIEW — courses for selectedVarsity ═══ */}
            {selectedVarsity && (() => {
              const varsityCourses = courses.filter((c) => c.institution === selectedVarsity);
              const filtered = varsityCourses.filter((c) =>
                !courseSearch || c.courseName?.toLowerCase().includes(courseSearch.toLowerCase())
              );
              return (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <button onClick={() => { setSelectedVarsity(null); setCourseSearch(""); }}
                        className="text-xs text-gray-400 hover:text-white transition mb-1">
                        ← All Institutions
                      </button>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
                        {selectedVarsity}
                        <InstitutionStatusBadge status={getInstitutionApplicationStatus(institutionSettings[selectedVarsity])} />
                        <button onClick={() => openInstitutionDatesEditor(selectedVarsity)}
                          className="text-xs font-normal text-gray-500 hover:text-purple-400 underline">
                          Set dates
                        </button>
                        <span className="text-gray-500 font-normal text-base ml-2">({filtered.length} of {varsityCourses.length})</span>
                      </h2>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setNewCourse({ ...BLANK_COURSE, institution: selectedVarsity,
                          institutionType: varsityCourses[0]?.institutionType || "university" });
                        setAddingCourse(true);
                      }}
                        className="text-xs bg-green-700 hover:bg-green-600 text-green-200 px-3 py-1.5 rounded-lg transition font-medium">
                        + Add Course Here
                      </button>
                    </div>
                  </div>

                  <input value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder={`Search courses at ${selectedVarsity}…`}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />

                  {filtered.length === 0 ? (
                    <p className="text-gray-500 text-sm py-8 text-center">No courses match your search.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-gray-800">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                          <tr>
                            <th className="text-left px-4 py-3">Course</th>
                            <th className="text-left px-4 py-3 hidden md:table-cell">Type</th>
                            <th className="text-left px-4 py-3">APS</th>
                            <th className="text-left px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {filtered.map((course) => (
                            <tr key={course.id} className="bg-gray-950 hover:bg-gray-900 transition">
                              <td className="px-4 py-3 font-medium text-white max-w-md">
                                <p className="truncate">
                                  {course.courseName}
                                  {course.campus && (
                                    <span className="ml-2 text-xs font-normal bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded">{course.campus}</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{course.faculty}</p>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{course.qualificationType}</span>
                              </td>
                              <td className="px-4 py-3 text-purple-400 font-semibold">{course.minAPS}</td>
                              <td className="px-4 py-3">
                                <InstitutionStatusBadge status={getInstitutionApplicationStatus(institutionSettings[course.institution])} />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => setEditingCourse({ ...course })}
                                    className="text-xs bg-purple-900 hover:bg-purple-800 text-purple-300 px-3 py-1 rounded-lg transition">
                                    Edit
                                  </button>
                                  <button onClick={() => setConfirmDeleteCourse(course)}
                                    className="text-xs bg-red-900 hover:bg-red-800 text-red-300 px-3 py-1 rounded-lg transition">
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {/* ── AUDIT LOG (super admin only) ── */}
        {tab === "Audit Log" && isSuperAdmin(auth.currentUser?.email) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold text-white">
                Course Audit Log
                <span className="text-gray-500 font-normal text-base ml-2">({auditLogs.length} recent changes)</span>
              </h2>
              <button onClick={loadAuditLogs}
                className="text-xs text-purple-400 hover:text-purple-300 border border-gray-700 px-3 py-1.5 rounded-lg transition">
                ↻ Refresh
              </button>
            </div>

            <p className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              🔒 This log is only visible to the super admin. Every course add, edit, and delete by any
              admin or moderator is recorded here with their email and the exact fields changed.
            </p>

            {loadingAuditLogs ? (
              <p className="text-gray-500 text-sm py-8 text-center">Loading audit log…</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">No course changes recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => {
                  const actionStyle = {
                    add:    { icon: "➕", label: "Added",  color: "bg-green-900 text-green-300" },
                    edit:   { icon: "✏️", label: "Edited", color: "bg-blue-900 text-blue-300" },
                    delete: { icon: "🗑️", label: "Deleted", color: "bg-red-900 text-red-300" },
                  }[log.action] || { icon: "•", label: log.action, color: "bg-gray-800 text-gray-300" };

                  return (
                    <div key={log.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionStyle.color}`}>
                            {actionStyle.icon} {actionStyle.label}
                          </span>
                          <p className="text-white text-sm font-medium">{log.courseName}</p>
                        </div>
                        <p className="text-gray-500 text-xs whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString("en-ZA") : "—"}
                        </p>
                      </div>

                      <p className="text-gray-400 text-xs mt-1">
                        {log.institution && <>at <span className="text-gray-300">{log.institution}</span> · </>}
                        by <span className="text-purple-400 font-medium">{log.adminEmail}</span>
                      </p>

                      {/* Show field-level diff for edits */}
                      {log.action === "edit" && log.changedFields && Object.keys(log.changedFields).length > 0 && (
                        <div className="mt-3 bg-gray-800 rounded-xl p-3 space-y-1.5">
                          {Object.entries(log.changedFields).map(([field, change]) => (
                            <div key={field} className="text-xs">
                              <span className="text-gray-400 font-medium">{field}:</span>{" "}
                              <span className="text-red-400 line-through">
                                {typeof change.from === "object" ? JSON.stringify(change.from) : String(change.from ?? "—")}
                              </span>
                              {" → "}
                              <span className="text-green-400">
                                {typeof change.to === "object" ? JSON.stringify(change.to) : String(change.to ?? "—")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "Settings" && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-xl font-bold text-white">Settings</h2>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <p className="font-semibold text-white">Grant Admin Access</p>
              <p className="text-xs text-gray-400">Enter the email of an existing user to give them admin access.</p>
              <div className="flex gap-2">
                <input value={adminEmailInput} onChange={(e) => setAdminEmailInput(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <button onClick={handleGrantAdminByEmail}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition font-medium">Grant</button>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <p className="font-semibold text-white">Current Admins</p>
              {users.filter((u) => u.isAdmin).length === 0
                ? <p className="text-gray-500 text-sm">No other admins.</p>
                : users.filter((u) => u.isAdmin).map((u) => (
                  <div key={u.uid} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-2">
                    <div>
                      <p className="text-sm text-white">{u.firstName ? `${u.firstName} ${u.lastName}` : u.email}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    <button onClick={() => handleToggleAdmin(u.uid, true)} className="text-xs text-red-400 hover:text-red-300">Revoke</button>
                  </div>
                ))
              }
            </div>

            <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-5 space-y-2">
              <p className="font-semibold text-red-400">Note on User Deletion</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                The Delete button removes the user's Firestore document and attempts to delete their Auth account via the REST API.
                If the REST delete fails (permissions), use the{" "}
                <a href="https://console.firebase.google.com/project/course-finder-214e7/authentication/users"
                  target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                  Firebase Console
                </a>{" "}as a fallback.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-4 space-y-1`}>
      <span className="text-2xl">{icon}</span>
      <p className="text-2xl font-extrabold text-white">{value}</p>
      <p className="text-xs text-white/70">{label}</p>
    </div>
  );
}

function InfoCell({ label, value, mono }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2">
      <p className="text-gray-500 text-xs mb-0.5">{label}</p>
      <p className={`text-white text-xs truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

function InstitutionStatusBadge({ status }) {
  return status === "open" ? (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-900 text-green-300 whitespace-nowrap">OPEN</span>
  ) : (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-900 text-red-300 whitespace-nowrap">CLOSED</span>
  );
}

// Faculty/qualification-type/min-APS filter panel + checkbox list used to
// select a batch of courses (across every institution) for bulk deletion.
function BulkDeleteCoursesPanel({
  courses, allCourses, institutionSettings,
  filterFaculty, setFilterFaculty,
  filterInstitution, setFilterInstitution,
  filterQualType, setFilterQualType,
  filterMinAPS, setFilterMinAPS,
  filterMaxAPS, setFilterMaxAPS,
  bulkSelectedIds, toggleBulkSelected, selectAllBulkMatches, clearBulkSelection,
  onDeleteClick,
}) {
  const faculties = [...new Set(allCourses.map((c) => c.faculty).filter(Boolean))].sort();
  const institutions = [...new Set(allCourses.map((c) => c.institution).filter(Boolean))].sort();
  const qualTypes = [...new Set(allCourses.map((c) => c.qualificationType).filter(Boolean))].sort();

  const allMatchesSelected = courses.length > 0 && courses.every((c) => bulkSelectedIds.has(c.id));

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
        Narrow down with the filters below, then use "Select all matching" (or tick individual
        rows) and delete them all at once. This deletes from Firestore immediately and tombstones
        each one so re-seeding from courses.json won't bring them back.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Faculties</option>
          {faculties.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filterInstitution} onChange={(e) => setFilterInstitution(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Institutions</option>
          {institutions.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filterQualType} onChange={(e) => setFilterQualType(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="">All Qualification Types</option>
          {qualTypes.map((q) => <option key={q} value={q}>{q}</option>)}
        </select>
        <div className="flex gap-2">
          <input type="number" placeholder="Min APS ≥" value={filterMinAPS}
            onChange={(e) => setFilterMinAPS(e.target.value)}
            className="w-1/2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <input type="number" placeholder="Max APS ≤" value={filterMaxAPS}
            onChange={(e) => setFilterMaxAPS(e.target.value)}
            className="w-1/2 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <button
          onClick={() => {
            setFilterFaculty("");
            setFilterInstitution("");
            setFilterQualType("");
            setFilterMinAPS("");
            setFilterMaxAPS("");
          }}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition">
          Reset Filters
        </button>
        <p className="text-sm text-gray-400">
          <span className="font-bold text-white">{courses.length}</span> course{courses.length !== 1 ? "s" : ""} match ·{" "}
          <span className="font-bold text-purple-400">{bulkSelectedIds.size}</span> selected
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => allMatchesSelected ? clearBulkSelection() : selectAllBulkMatches(courses)}
          className="text-xs bg-purple-900 hover:bg-purple-800 text-purple-300 px-3 py-1.5 rounded-lg transition font-medium">
          {allMatchesSelected ? "Deselect All Matching" : `Select All Matching (${courses.length})`}
        </button>
        {bulkSelectedIds.size > 0 && (
          <button onClick={onDeleteClick}
            className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition font-medium">
            🗑️ Delete Selected ({bulkSelectedIds.size})
          </button>
        )}
      </div>

      {courses.length === 0 ? (
        <p className="text-gray-500 text-sm py-8 text-center">No courses match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-800 max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="text-left px-4 py-3">Course</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Institution</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Type</th>
                <th className="text-left px-4 py-3">APS</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {courses.map((course) => {
                const selected = bulkSelectedIds.has(course.id);
                const status = getInstitutionApplicationStatus(institutionSettings[course.institution]);
                return (
                  <tr key={course.id}
                    onClick={() => toggleBulkSelected(course.id)}
                    className={`cursor-pointer transition ${selected ? "bg-red-950/40" : "bg-gray-950 hover:bg-gray-900"}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected} onChange={() => toggleBulkSelected(course.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-red-600" />
                    </td>
                    <td className="px-4 py-3 font-medium text-white max-w-xs">
                      <p className="truncate">{course.courseName}</p>
                      <p className="text-xs text-gray-500 truncate">{course.faculty}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-300 max-w-[16rem] truncate">{course.institution}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{course.qualificationType}</span>
                    </td>
                    <td className="px-4 py-3 text-purple-400 font-semibold">{course.minAPS}</td>
                    <td className="px-4 py-3">
                      <InstitutionStatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}