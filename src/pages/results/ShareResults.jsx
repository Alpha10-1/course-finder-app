import { buildShareText, whatsAppShareUrl } from "../../utils/shareResults";

const canUseShareSheet = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

// Share or save the courses currently on screen (after search and filters),
// so learners can narrow the list down first and send exactly what they want.
export default function ShareResults({ aps, courses, onSavePdf }) {
  const text = buildShareText({ aps, courses });

  const openShareSheet = async () => {
    try {
      await navigator.share({ title: "My Course Finder results", text });
    } catch {
      // Cancelled or unsupported target — nothing to do.
    }
  };

  const buttonCls = "text-xs font-medium px-3 py-1.5 rounded-lg transition";
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={whatsAppShareUrl(text)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonCls} bg-green-600 hover:bg-green-700 text-white`}
      >
        Share on WhatsApp
      </a>
      {canUseShareSheet() && (
        <button onClick={openShareSheet} className={`${buttonCls} bg-gray-100 hover:bg-gray-200 text-gray-700`}>
          Share…
        </button>
      )}
      <button onClick={onSavePdf} className={`${buttonCls} bg-gray-100 hover:bg-gray-200 text-gray-700`}>
        Save as PDF
      </button>
    </div>
  );
}
