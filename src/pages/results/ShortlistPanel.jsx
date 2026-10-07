import { buildShareText, whatsAppShareUrl } from "../../utils/shareResults";

// The learner's starred courses, with sharing and — for free users — an
// offer to have the team apply for them.
export default function ShortlistPanel({ shortlist, aps, offerApplyForMe, onRemove, onApplyForMe }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-bold text-amber-900">★ My shortlist ({shortlist.length})</p>
        <a
          href={whatsAppShareUrl(buildShareText({ aps, courses: shortlist }))}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition"
        >
          Share shortlist on WhatsApp
        </a>
      </div>
      <ul className="mt-3 space-y-1.5">
        {shortlist.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-800 truncate">{entry.courseName}</span>
              <span className="block text-xs text-gray-500 truncate">
                {entry.institution}{entry.campus && ` — ${entry.campus}`}
              </span>
            </span>
            <button
              onClick={() => onRemove(entry)}
              aria-label={`Remove from shortlist: ${entry.courseName}`}
              className="text-amber-500 hover:text-amber-700 text-lg leading-none shrink-0"
            >
              ★
            </button>
          </li>
        ))}
      </ul>
      {offerApplyForMe && (
        <p className="text-sm text-amber-900 mt-3">
          Want us to apply to these for you?{" "}
          <button onClick={onApplyForMe} className="font-semibold text-purple-700 hover:underline">
            Apply For Me →
          </button>
        </p>
      )}
    </div>
  );
}
