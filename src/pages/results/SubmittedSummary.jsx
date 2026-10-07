import { getApplicationProgress } from "../../utils/applySelection";

const formatDate = (iso) => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

// Shown once a learner has submitted their Apply For Me choices: the choices
// per institution, plus which applications the team has already lodged
// (applicationProgress, which admins update from the admin panel).
export default function SubmittedSummary({ selections, applicationProgress, onEdit }) {
  const progress = getApplicationProgress({ applySelections: selections, applicationProgress });
  const started = progress.appliedCount > 0;

  const headline =
    progress.status === "complete"
      ? `We've applied to all ${progress.total} of your institutions. Watch your email and phone for their responses.`
      : started
        ? `We've applied to ${progress.appliedCount} of ${progress.total} institutions so far.`
        : "Our team will begin applying to your chosen institutions.";

  return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
      <p className="text-green-800 font-bold">✅ Selections submitted!</p>
      <p className="text-green-600 text-sm mt-1">{headline}</p>
      <div className="mt-3 space-y-2">
        {Object.entries(selections).map(([inst, choices]) => {
          const entry = applicationProgress?.[inst];
          return (
            <div key={inst} className="bg-white rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-800 text-sm">{inst}</p>
                {entry?.applied ? (
                  <span className="shrink-0 bg-green-100 text-green-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
                    ✓ Applied{entry.appliedAt ? ` ${formatDate(entry.appliedAt)}` : ""}
                  </span>
                ) : (
                  <span className="shrink-0 bg-gray-100 text-gray-500 text-[11px] font-medium px-2 py-0.5 rounded-full">
                    ⏳ Not yet applied
                  </span>
                )}
              </div>
              {[1, 2, 3].map((r) => choices[r] && (
                <p key={r} className="text-xs text-gray-500 mt-0.5">
                  <span className="text-purple-600 font-medium">Choice {r}:</span> {choices[r].courseName}
                </p>
              ))}
            </div>
          );
        })}
      </div>
      {/* Once applications have been lodged, changing choices here would no
          longer match what the institutions received. */}
      {started ? (
        <p className="mt-3 text-xs text-gray-500">Need to change something? Message us on WhatsApp.</p>
      ) : (
        <button onClick={onEdit} className="mt-3 text-sm text-purple-600 hover:underline">
          Edit selections
        </button>
      )}
    </div>
  );
}
