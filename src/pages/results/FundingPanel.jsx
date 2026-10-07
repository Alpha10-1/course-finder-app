import { useState } from "react";
import { checkNsfasFinancialEligibility, INCOME_BANDS, NSFAS_URL } from "../../utils/funding";

const RESULT_TEXT = {
  likely: {
    tone: "bg-green-50 border-green-200 text-green-800",
    text: "You probably meet NSFAS's financial criteria. Apply on the NSFAS website as early as you can — it funds study at public universities and TVET colleges.",
  },
  unlikely: {
    tone: "bg-amber-50 border-amber-200 text-amber-900",
    text: "Your household income is probably above NSFAS's limit. Look for bursaries from companies, government departments and the institutions themselves, and ask each institution's financial aid office what's available.",
  },
  unknown: {
    tone: "bg-gray-50 border-gray-200 text-gray-700",
    text: "Ask a parent or guardian roughly what your household earns in a year (everyone's income combined, before tax), then check again.",
  },
};

// "Can I get funding?" — a quick check against NSFAS's published financial
// criteria, with a pointer to the official site for current rules and dates.
export default function FundingPanel() {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState({ sassaGrant: null, disability: null, incomeBand: "" });
  const answered = answers.sassaGrant === true ||
    (answers.sassaGrant === false && answers.disability !== null && answers.incomeBand !== "");
  const result = answered ? RESULT_TEXT[checkNsfasFinancialEligibility(answers)] : null;
  const set = (field, value) => setAnswers((prev) => ({ ...prev, [field]: value }));

  const choice = (field, value, label) => (
    <button
      key={`${field}-${value}`}
      type="button"
      onClick={() => set(field, value)}
      aria-pressed={answers[field] === value}
      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
        answers[field] === value ? "bg-purple-600 border-purple-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:border-purple-300"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
      >
        <span>
          <span className="block font-semibold text-emerald-900">💰 Can I get funding to study?</span>
          <span className="block text-xs text-emerald-800/80 mt-0.5">Quick check for an NSFAS bursary — 3 questions</span>
        </span>
        <span className={`text-emerald-700 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div>
            <p className="text-sm text-gray-800 mb-2">Do you or your parent/guardian receive a SASSA grant?</p>
            <div className="flex gap-2">
              {choice("sassaGrant", true, "Yes")}
              {choice("sassaGrant", false, "No")}
            </div>
          </div>

          {answers.sassaGrant === false && (
            <>
              <div>
                <p className="text-sm text-gray-800 mb-2">Do you live with a disability?</p>
                <div className="flex gap-2">
                  {choice("disability", true, "Yes")}
                  {choice("disability", false, "No")}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-800 mb-2">What does your whole household earn in a year, before tax?</p>
                <div className="flex flex-wrap gap-2">
                  {INCOME_BANDS.map((band) => choice("incomeBand", band.value, band.label))}
                </div>
              </div>
            </>
          )}

          {result && (
            <p role="status" className={`text-sm border rounded-xl px-4 py-3 ${result.tone}`}>{result.text}</p>
          )}

          <p className="text-xs text-gray-500">
            This only covers NSFAS's financial rules. NSFAS also checks citizenship and academic results, and its
            rules and application dates change each year — confirm everything on{" "}
            <a href={NSFAS_URL} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">nsfas.org.za</a>.
          </p>
        </div>
      )}
    </section>
  );
}
