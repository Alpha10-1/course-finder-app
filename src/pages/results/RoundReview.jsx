import { ROUND_INFO } from "./roundInfo";

// Review screen shown between rounds (and before the final submit).
export default function RoundReview({ round, selections, saving, onEdit, onContinue }) {
  const isLastRound = round === 3;
  const roundChoices = Object.entries(selections).map(([inst, choices]) => ({
    inst,
    course: choices[round],
  })).filter((e) => e.course);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col items-center justify-center p-6">
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
            onClick={onEdit}
            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-3 rounded-xl font-medium transition text-sm"
          >
            ← Edit Choices
          </button>
          <button
            onClick={onContinue}
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
