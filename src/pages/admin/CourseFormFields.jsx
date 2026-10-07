import { useState } from "react";
import { NSC_LEVEL_OPTIONS, levelToMinMark, markToLevel } from "../../utils/marksToAPS";
import { FAL_SUBJECTS } from "../../utils/languages";
import { INSTITUTIONS, COLLEGE_QUAL_TYPES, UNI_QUAL_TYPES, SUBJECT_OPTIONS } from "./constants";

export default function CourseFormFields({ data, onChange }) {
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
