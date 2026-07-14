// Light-themed "open" / "closing soon" / "closed" pill for learner-facing
// pages (Results page course cards, public course/institution pages).
//
// status is display-only — it comes from getCourseDisplayStatus() in
// utils/institutionStatus.js, which already handles the faculty-overrides-
// institution fallback. This component just renders whatever it's given.
export default function CourseStatusBadge({ status, className = "" }) {
  if (!status) return null;

  const styles = {
    open: "bg-green-100 text-green-700",
    "closing-soon": "bg-amber-100 text-amber-700",
    closed: "bg-red-100 text-red-700",
  };
  const labels = {
    open: "Open",
    "closing-soon": "Closing soon",
    closed: "Closed",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${styles[status] || styles.open} ${className}`}
    >
      {status === "closing-soon" && "⏳ "}
      {status === "closed" && "🔒 "}
      {labels[status] || "Open"}
    </span>
  );
}