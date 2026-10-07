import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, addDoc, query, orderBy, limit } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { isSuperAdmin } from "../../utils/adminConfig";

// Course audit log: records every course change with who, what, when. Only
// the super admin can read this (enforced by Firestore rules), but any
// admin/moderator who makes a change still gets logged — they just can't
// view the log.
export default function useAuditLog() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(true);

  const writeAuditLog = async (action, course, changedFields) => {
    const me = auth.currentUser;
    if (!me) return;
    try {
      await addDoc(collection(db, "courseAuditLogs"), {
        action,              // "add" | "edit" | "delete"
        courseId: course.id || null,
        courseName: course.courseName || "(unnamed course)",
        institution: course.institution || "",
        changedFields: changedFields || null, // for edits: { field: { from, to } }
        adminUid: me.uid,
        adminEmail: me.email || "unknown",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // Never block the actual course operation if logging fails
      console.error("Audit log write failed:", err);
    }
  };

  // Same fetch/load split as useAdminUsers: fetchAuditLogs only sets state
  // from promise callbacks; loadAuditLogs is the refresh that also flips loading.
  const fetchAuditLogs = useCallback(() => {
    if (!isSuperAdmin(auth.currentUser?.email)) return Promise.resolve();
    const q = query(collection(db, "courseAuditLogs"), orderBy("timestamp", "desc"), limit(200));
    return getDocs(q)
      .then((snap) => setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((err) => console.error("Failed to load audit logs:", err))
      .finally(() => setLoadingAuditLogs(false));
  }, []);

  const loadAuditLogs = useCallback(() => {
    setLoadingAuditLogs(true);
    return fetchAuditLogs();
  }, [fetchAuditLogs]);

  useEffect(() => { fetchAuditLogs(); }, [fetchAuditLogs]);

  return {
    auditLogs, loadingAuditLogs, writeAuditLog, loadAuditLogs,
  };
}
