import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, getDoc } from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "../../firebase";
import { isSuperAdmin } from "../../utils/adminConfig";

// Users tab state and actions (plus the stats/admin list Dashboard and
// Settings read). Owned by Admin rather than the tab so filters survive
// switching tabs.
export default function useAdminUsers(showToast) {
  // Users state — merged Auth + Firestore
  const [currentUserRole, setCurrentUserRole] = useState("admin"); // safe default; upgraded to "super" only after verified
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchUser, setSearchUser] = useState("");
  const [expandedUser, setExpandedUser] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  // User filters
  const [filterPlan, setFilterPlan] = useState("");
  const [filterAdmin, setFilterAdmin] = useState("");
  const [filterAuthOnly, setFilterAuthOnly] = useState("");
  const [filterEnteredMarks, setFilterEnteredMarks] = useState("");
  const [userSortBy, setUserSortBy] = useState(""); // "" | "lastActivityAt" | "lastLoginAt"

  // Settings
  const [adminEmailInput, setAdminEmailInput] = useState("");

  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  // ── Load users from Firestore ────────────────────────────────────────────
  // Note: Firebase Auth user listing requires Admin SDK (server-side).
  // Users appear here as soon as they sign in (SignIn.jsx writes their doc).
  // For pre-existing Auth accounts, use "Import users" below.
  //
  // fetchUsers only sets state from promise callbacks, so the initial-load
  // effect never sets state synchronously; loadUsers (refresh) also flips the
  // loading flag, which already starts out true for the first load.
  const fetchUsers = useCallback(() =>
    getDocs(collection(db, "users"))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
        setUsers(list);
        // Detect current user's role
        const me = auth.currentUser;
        if (me) {
          if (isSuperAdmin(me.email)) {
            setCurrentUserRole("super");
          } else {
            const myDoc = list.find((u) => u.uid === me.uid);
            setCurrentUserRole(myDoc?.adminRole || "admin");
          }
        }
      })
      .catch((err) => showToast("Failed to load users: " + err.message, "error"))
      .finally(() => setLoadingUsers(false)),
  [showToast]);

  const loadUsers = useCallback(() => {
    setLoadingUsers(true);
    return fetchUsers();
  }, [fetchUsers]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    total: users.length,
    free: users.filter((u) => !u.plan || u.plan === "free").length,

    applyForMe: users.filter((u) => u.plan === "apply_for_me").length,
    admins: users.filter((u) => u.isAdmin).length,
    authOnly: users.filter((u) => u.authOnly).length,

    // Real revenue, summed from each paying user's actual amountPaid (set by
    // api/yoco-webhook.js from the real Yoco payment event) rather than a
    // flat "count × price" guess. A flat guess goes stale the moment pricing
    // changes and can't reflect promos/refunds — worse, the previous flat
    // figure here (R150) didn't even match the real checkout price (R100,
    // see PLAN_CONFIG.apply_for_me in api/create-checkout.js), so it was
    // overstating revenue by 50% on every paying user.
    // Fallback to R100 only for the rare legacy paid user whose record
    // predates the amountPaid field being written.
    revenue: users
      .filter((u) => u.plan === "apply_for_me")
      .reduce((sum, u) => sum + (u.amountPaid != null ? parseFloat(u.amountPaid) || 0 : 100), 0),
  };

  // ── User actions ─────────────────────────────────────────────────────────
  const handlePasswordReset = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(`Password reset sent to ${email}`);
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleDeleteUser = async (uid, email) => {
    try {
      // Delete Firestore doc
      await deleteDoc(doc(db, "users", uid));
      // Also call Auth REST delete (requires admin token)
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        await fetch(`https://identitytoolkit.googleapis.com/v1/projects/course-finder-214e7/accounts/${uid}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${idToken}` },
        });
      }
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      showToast(`User ${email} deleted`);
      setConfirmDeleteUser(null);
    } catch (err) { showToast(err.message, "error"); }
  };

  // Set a user's admin role. Pass role=null to revoke all admin access.
  const handleSetRole = async (uid, role) => {
    // Never allow modifying the super admin via UI
    const target = users.find((u) => u.uid === uid);
    if (target && isSuperAdmin(target.email)) {
      showToast("Super admin cannot be modified.", "error"); return;
    }
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      const updates = role
        ? { isAdmin: true, adminRole: role }
        : { isAdmin: false, adminRole: null };
      if (snap.exists()) { await updateDoc(ref, updates); }
      else { await setDoc(ref, { uid, ...updates }); }
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, ...updates } : u));
      showToast(role ? `Role set to "${role}"` : "Admin access revoked");
    } catch (err) { showToast(err.message, "error"); }
  };

  // Legacy alias used in Settings tab
  const handleToggleAdmin = (uid, isCurrentlyAdmin) =>
    handleSetRole(uid, isCurrentlyAdmin ? null : "admin");

  const handleChangePlan = async (uid, plan) => {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (snap.exists()) { await updateDoc(ref, { plan }); }
      else { await setDoc(ref, { plan, uid }); }
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, plan } : u));
      showToast("Plan updated");
    } catch (err) { showToast(err.message, "error"); }
  };

  // Mark (or unmark) a specific institution as "applied for" on the user's
  // behalf, as part of the paid Apply For Me concierge flow. Stored under
  // applicationProgress so it's independent of the learner's own
  // applyStatus (draft/submitted), which only tracks whether *they've*
  // finished picking courses, not whether an admin has actually applied.
  const handleToggleInstitutionApplied = async (uid, institution, applied) => {
    const target = users.find((u) => u.uid === uid);
    const entry = { applied, appliedAt: applied ? new Date().toISOString() : null };
    const nextProgress = { ...(target?.applicationProgress || {}), [institution]: entry };
    try {
      await setDoc(doc(db, "users", uid), { applicationProgress: nextProgress }, { merge: true });
      setUsers((prev) => prev.map((u) => u.uid === uid ? { ...u, applicationProgress: nextProgress } : u));
      showToast(applied ? `Marked ${institution} as applied` : `Unmarked ${institution}`);
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleGrantAdminByEmail = async () => {
    const email = adminEmailInput.trim().toLowerCase();
    if (!email) return;
    const found = users.find((u) => (u.email || "").toLowerCase() === email);
    if (!found) { showToast("User not found", "error"); return; }
    await handleToggleAdmin(found.uid, false);
    setAdminEmailInput("");
  };

  // ── Import pre-existing Auth users by pasting emails ────────────────────
  // Since we can't list Firebase Auth users client-side, paste their emails
  // (one per line) from the Firebase Console to create Firestore stubs.
  const handleImportUsers = async () => {
    const emails = importText
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) { showToast("No valid emails found", "error"); return; }

    let created = 0, skipped = 0;
    for (const email of emails) {
      const exists = users.find((u) => (u.email || "").toLowerCase() === email);
      if (exists) { skipped++; continue; }
      // Create a stub — uid will be filled when they next sign in
      const stubId = `stub_${email.replace(/[^a-z0-9]/g, "_")}`;
      try {
        await setDoc(doc(db, "users", stubId), {
          uid: stubId,
          email,
          firstName: "",
          lastName: "",
          dob: "",
          plan: "free",
          isAdmin: false,
          stub: true, // flag so we know it's incomplete
          createdAt: new Date().toISOString(),
        });
        created++;
      } catch (err) {
        console.error("Stub create failed:", email, err);
      }
    }

    showToast(`Imported ${created} user(s), skipped ${skipped} existing.`);
    setImportText("");
    setShowImport(false);
    loadUsers();
  };

  // ── Filters ───────────────────────────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    const matchSearch = !searchUser ||
      (u.email || "").toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.firstName || "").toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.lastName || "").toLowerCase().includes(searchUser.toLowerCase()) ||
      (u.displayName || "").toLowerCase().includes(searchUser.toLowerCase());
    const matchPlan = !filterPlan || (u.plan || "free") === filterPlan;
    const matchAdmin = filterAdmin === "" || String(!!u.isAdmin) === filterAdmin;
    const matchAuthOnly = filterAuthOnly === "" || String(!!u.authOnly) === filterAuthOnly;
    // "Entered marks" = they've been through EnterMarks.jsx at least once,
    // which always writes a `subjects` array alongside the aps/grade fields.
    const hasEnteredMarks = Array.isArray(u.subjects) && u.subjects.length > 0;
    const matchEnteredMarks =
      filterEnteredMarks === "" ||
      (filterEnteredMarks === "true" ? hasEnteredMarks : !hasEnteredMarks);
    return matchSearch && matchPlan && matchAdmin && matchAuthOnly && matchEnteredMarks;
  });

  // Most-recent-first sort, applied on top of the filters above. Both fields
  // are ISO date strings (or absent) — users missing the field sort last
  // rather than crashing Date parsing or floating to the top as "newest".
  const sortedFilteredUsers = userSortBy
    ? [...filteredUsers].sort((a, b) => {
        const aTime = a[userSortBy] ? new Date(a[userSortBy]).getTime() : -Infinity;
        const bTime = b[userSortBy] ? new Date(b[userSortBy]).getTime() : -Infinity;
        return bTime - aTime;
      })
    : filteredUsers;

  return {
    currentUserRole, users, loadingUsers, searchUser, setSearchUser, expandedUser, setExpandedUser,
    showImport, setShowImport, importText, setImportText, filterPlan, setFilterPlan, filterAdmin,
    setFilterAdmin, filterAuthOnly, setFilterAuthOnly, filterEnteredMarks, setFilterEnteredMarks,
    userSortBy, setUserSortBy, adminEmailInput, setAdminEmailInput, confirmDeleteUser,
    setConfirmDeleteUser, loadUsers, stats, handlePasswordReset, handleDeleteUser, handleSetRole,
    handleToggleAdmin, handleChangePlan, handleToggleInstitutionApplied, handleGrantAdminByEmail,
    handleImportUsers, filteredUsers, sortedFilteredUsers,
  };
}
