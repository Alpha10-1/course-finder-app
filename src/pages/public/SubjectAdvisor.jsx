import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Seo from "../../components/Seo";
import { COURSES } from "../../utils/publicCourses";
import { courseQualifies } from "../../utils/matching";
import { SITE_URL, whatsAppShareUrl } from "../../utils/shareResults";
import {
  ADVISOR_PROFILE, APS_BLOCKER, ELECTIVES, HOME_LANGUAGES, MARK_LEVELS, MATHS_OPTIONS, PRESETS, SECOND_LANGUAGES,
  advisorParams, applyChange, buildSubjects, evaluateCourses, exampleCourses, languageOf, normalizeChoices,
  parseAdvisorParams, summarizeByField, topBlockers,
} from "../../utils/subjectAdvisor";
import useChangeSuggestions from "./useChangeSuggestions";

const UNIVERSITY_COURSES = COURSES.filter((c) => c.institutionType === "university");
const COLLEGE_COURSES = COURSES.filter((c) => c.institutionType === "college");
const MAX_LISTED = 25;

const selectClass =
  "w-full p-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400";

const plural = (n, word) => `${n.toLocaleString("en-ZA")} ${word}${n === 1 ? "" : "s"}`;

function describeChange(change) {
  return <>Take <strong>{change.to}</strong> instead of <strong>{change.from}</strong></>;
}

function FieldRow({ field }) {
  const [open, setOpen] = useState(false);
  const share = field.total ? field.open / field.total : 0;
  const ruledOut = field.total - field.open;
  return (
    <li className="py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={ruledOut === 0}
        className="w-full text-left disabled:cursor-default"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-gray-800">{field.label}</span>
          <span className="text-sm text-gray-600 shrink-0">
            <span className="font-semibold text-gray-900">{field.open}</span> of {field.total} open
            {ruledOut > 0 && <span className={`ml-1 text-purple-600 inline-block transition-transform ${open ? "rotate-180" : ""}`}>▾</span>}
          </span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
          <div className={`h-full rounded-full ${share >= 0.75 ? "bg-green-500" : share >= 0.35 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
      </button>
      {open && ruledOut > 0 && (
        <ul className="mt-3 space-y-1.5">
          {field.closed.slice(0, MAX_LISTED).map(({ course, gaps }) => (
            <li key={`${course.institutionSlug}/${course.courseSlug}`} className="text-xs bg-gray-50 rounded-lg px-3 py-2">
              <Link to={`/courses/${course.institutionSlug}/${course.courseSlug}`} className="font-medium text-gray-800 hover:text-purple-700 hover:underline">
                {course.courseName}
              </Link>
              <span className="text-gray-500"> — {course.institution}</span>
              <span className="block text-red-700 mt-0.5">
                Needs {gaps.map((g) => (g.type === "aps" ? "a higher APS" : g.label)).join(", ")}
              </span>
            </li>
          ))}
          {field.closed.length > MAX_LISTED && (
            <li className="text-xs text-gray-500 px-3">…and {field.closed.length - MAX_LISTED} more.</li>
          )}
        </ul>
      )}
    </li>
  );
}

// "Which subjects should I choose?" — for Grade 9 learners picking their
// Grade 10–12 subjects. Public and prerendered; the choices live in the query
// string so a combination can be shared.
export default function SubjectAdvisor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramKey = searchParams.toString();
  const { choices, mark } = useMemo(() => parseAdvisorParams(new URLSearchParams(paramKey)), [paramKey]);
  const stateKey = advisorParams(choices, mark).toString();

  const subjects = useMemo(() => buildSubjects(choices, mark), [choices, mark]);
  const result = useMemo(() => evaluateCourses(UNIVERSITY_COURSES, subjects), [subjects]);
  const openNow = useMemo(() => new Set(result.open), [result]);
  const fields = useMemo(() => summarizeByField(result), [result]);
  const blockers = useMemo(() => topBlockers(result.closed), [result]);
  const collegeOpen = useMemo(
    () => COLLEGE_COURSES.filter((c) => courseQualifies(c, subjects, ADVISOR_PROFILE)).length,
    [subjects]
  );
  const { loading, suggestions } = useChangeSuggestions(UNIVERSITY_COURSES, choices, mark, openNow, stateKey);

  const update = (nextChoices, nextMark = mark) => {
    setSearchParams(advisorParams(normalizeChoices(nextChoices), nextMark), { replace: true, preventScrollReset: true });
  };
  const setElective = (index, subject) => {
    const electives = [...choices.electives];
    electives[index] = subject;
    update({ ...choices, electives });
  };

  const openCount = result.open.length;
  const total = UNIVERSITY_COURSES.length;
  const shareText = [
    "Choosing Grade 10 subjects? 🎓",
    `${choices.maths}, ${choices.electives.join(", ")} keep ${openCount.toLocaleString("en-ZA")} of ${total.toLocaleString("en-ZA")} university courses open.`,
    `Try your own subjects: ${SITE_URL}/subject-choices?${stateKey}`,
  ].join("\n");

  return (
    <>
      <Seo
        title="Grade 10 Subject Choices: Which Courses Each Subject Keeps Open"
        path="/subject-choices"
        description="Choosing your subjects in Grade 9? See which South African university courses Mathematics, Maths Literacy, Physical Sciences and other subjects keep open, and what each choice rules out."
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <Link to="/courses" className="text-sm text-purple-700 hover:underline">← Browse all courses</Link>

          <header className="mt-3 mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Which subjects should I choose?</h1>
            <p className="text-gray-600 mt-2">
              Picking your Grade 10 subjects? See which university courses a subject combination keeps open,
              what it rules out, and which change would open the most doors.
            </p>
          </header>

          {/* Keeps the result in view while the subject pickers are scrolled on a phone. */}
          <div className="sticky top-2 z-10 mb-3 sm:hidden" aria-hidden="true">
            <div className="mx-auto w-fit bg-purple-700 text-white text-xs font-medium rounded-full px-4 py-1.5 shadow-md">
              {result.open.length.toLocaleString("en-ZA")} of {UNIVERSITY_COURSES.length.toLocaleString("en-ZA")} university courses open
            </div>
          </div>

          {/* ── Subjects ── */}
          <section className="bg-white rounded-2xl shadow-sm p-5 space-y-5" aria-labelledby="your-subjects">
            <div>
              <h2 id="your-subjects" className="font-semibold text-gray-900">Your subjects</h2>
              <p className="text-xs text-gray-500 mt-0.5">Start from a common combination, then change anything.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {PRESETS.map((p) => {
                  const active = choices.maths === p.maths && p.electives.every((e) => choices.electives.includes(e));
                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => update({ ...choices, maths: p.maths, electives: p.electives })}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                        active ? "bg-purple-600 border-purple-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:border-purple-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-gray-800 mb-2">Maths</legend>
              <div className="grid sm:grid-cols-3 gap-2">
                {MATHS_OPTIONS.map((m) => (
                  <button
                    key={m.subject}
                    type="button"
                    aria-pressed={choices.maths === m.subject}
                    onClick={() => update({ ...choices, maths: m.subject })}
                    className={`text-left px-3 py-2.5 rounded-xl border-2 transition ${
                      choices.maths === m.subject ? "border-purple-600 bg-purple-50" : "border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    <span className={`block text-sm font-medium ${choices.maths === m.subject ? "text-purple-700" : "text-gray-800"}`}>{m.subject}</span>
                    {" "}
                    <span className="block text-xs text-gray-500">{m.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium text-gray-800 mb-2">Your three other subjects</legend>
              <div className="grid sm:grid-cols-3 gap-2">
                {choices.electives.map((subject, index) => (
                  <label key={index} className="block">
                    <span className="sr-only">Subject {index + 1}</span>
                    <select value={subject} onChange={(e) => setElective(index, e.target.value)} className={selectClass}>
                      {ELECTIVES.filter((e) => e === subject || !choices.electives.includes(e)).map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-sm font-medium text-gray-800 mb-2">Home language</span>
                <select
                  value={choices.homeLanguage}
                  onChange={(e) => update({ ...choices, homeLanguage: e.target.value })}
                  className={selectClass}
                >
                  {HOME_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-800 mb-2">Second language</span>
                <select
                  value={choices.additionalLanguage}
                  onChange={(e) => update({ ...choices, additionalLanguage: e.target.value })}
                  className={selectClass}
                >
                  {SECOND_LANGUAGES.filter((l) => languageOf(l) !== languageOf(choices.homeLanguage)).map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-gray-500 -mt-2">Plus Life Orientation, which everyone takes.</p>

            <label className="block">
              <span className="block text-sm font-medium text-gray-800 mb-2">Marks</span>
              <select value={mark} onChange={(e) => update(choices, Number(e.target.value))} className={selectClass}>
                {MARK_LEVELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <span className="block text-xs text-gray-500 mt-1">
                Choose a mark to also check minimum marks and APS. Leave it on "any marks" to see only what your subjects allow.
              </span>
            </label>
          </section>

          {/* ── Summary ── */}
          <section className="bg-white rounded-2xl shadow-sm p-5 mt-4" aria-live="polite">
            <p className="text-sm text-gray-600">With these subjects{mark < 100 ? ` and about ${mark}% in each` : ""}, you could apply for</p>
            <p className="mt-1">
              <span className="text-4xl font-extrabold text-purple-700">{openCount.toLocaleString("en-ZA")}</span>
              <span className="text-gray-700"> of {total.toLocaleString("en-ZA")} university courses</span>
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {mark < 100 ? "" : "if your marks are good enough, "}and {collegeOpen.toLocaleString("en-ZA")} of {COLLEGE_COURSES.length.toLocaleString("en-ZA")} TVET and private college courses.
            </p>
            {blockers.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-800">Most of the university courses you'd miss out on need:</p>
                <ul className="flex flex-wrap gap-2 mt-2">
                  {blockers.map((b) => (
                    <li key={b.label} className="text-xs bg-red-50 text-red-800 border border-red-100 rounded-lg px-2.5 py-1">
                      {b.label === APS_BLOCKER ? "Higher marks" : b.label} · {plural(b.count, "course")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <a
              href={whatsAppShareUrl(shareText)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition"
            >
              Share these subjects on WhatsApp
            </a>
          </section>

          {/* ── Suggestions ── */}
          <section className="bg-white rounded-2xl shadow-sm p-5 mt-4" aria-labelledby="open-more">
            <h2 id="open-more" className="font-semibold text-gray-900">Changes that open the most courses</h2>
            {loading ? (
              <p className="text-sm text-gray-500 mt-2">Working out which changes would help most…</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-gray-600 mt-2">No single subject change opens more university courses than you have now.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {suggestions.map((s) => (
                  <li key={`${s.type}-${s.from}-${s.to}`} className="border border-gray-100 rounded-xl px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">{describeChange(s)}</p>
                      <p className="text-xs text-green-700 mt-0.5">
                        Opens {plural(s.gained.length, "more course")}{s.lost.length > 0 && <span className="text-red-700">, closes {s.lost.length}</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">e.g. {exampleCourses(s.gained).join(", ")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => update(applyChange(choices, s))}
                      className="text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg shrink-0"
                    >
                      Try it
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── By field ── */}
          <section className="bg-white rounded-2xl shadow-sm p-5 mt-4" aria-labelledby="by-field">
            <h2 id="by-field" className="font-semibold text-gray-900">By field of study</h2>
            <p className="text-xs text-gray-500 mt-0.5">Tap a field to see the courses these subjects rule out, and what they need.</p>
            <ul className="divide-y divide-gray-100 mt-2">
              {fields.map((f) => <FieldRow key={f.key} field={f} />)}
            </ul>
          </section>

          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            This is a guide, based on the subject requirements in our course catalogue. Requirements change from
            year to year, and many courses also need a minimum APS and minimum marks in specific subjects. Talk to
            your Life Orientation teacher or school counsellor before you decide, and check the latest prospectus
            of the institutions you're interested in.
          </p>

          <div className="mt-8 bg-gradient-to-r from-purple-600 to-blue-500 rounded-2xl p-6 text-center">
            <p className="text-white font-bold text-lg">Already have marks?</p>
            <p className="text-white/80 text-sm mt-1 mb-4">
              Enter your Grade 11 or 12 marks and Course Finder shows exactly which courses you qualify for.
            </p>
            <Link to="/signup" className="inline-block bg-white text-purple-700 font-semibold px-6 py-3 rounded-xl hover:bg-purple-50 transition">
              Check what you qualify for →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
