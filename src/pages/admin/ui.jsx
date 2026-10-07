export function StatCard({ label, value, icon, color }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-4 space-y-1`}>
      <span className="text-2xl">{icon}</span>
      <p className="text-2xl font-extrabold text-white">{value}</p>
      <p className="text-xs text-white/70">{label}</p>
    </div>
  );
}

export function InfoCell({ label, value, mono }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2">
      <p className="text-gray-500 text-xs mb-0.5">{label}</p>
      <p className={`text-white text-xs truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

// status: "open" | "closing-soon" | "closed". Institution-level callers only
// ever pass "open"/"closed" (2-state); course/faculty-level callers can also
// pass "closing-soon" from getCourseDisplayStatus.
export function InstitutionStatusBadge({ status }) {
  if (status === "closing-soon") {
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-900 text-amber-300 whitespace-nowrap">CLOSING SOON</span>;
  }
  return status === "open" ? (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-900 text-green-300 whitespace-nowrap">OPEN</span>
  ) : (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-900 text-red-300 whitespace-nowrap">CLOSED</span>
  );
}
