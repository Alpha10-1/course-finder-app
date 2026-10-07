export default function AuditLogTab({ audit }) {
  const {
    auditLogs, loadingAuditLogs, loadAuditLogs,
  } = audit;

  return (
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
  );
}
