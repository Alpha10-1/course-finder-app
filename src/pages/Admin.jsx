import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, doc, updateDoc, deleteDoc, setDoc, addDoc, getDoc
} from "firebase/firestore";
import { sendPasswordResetEmail, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { isSuperAdmin, PERMISSIONS, ADMIN_ROLES, getRoleInfo } from "../utils/adminConfig";

const FIREBASE_API_KEY = "AIzaSyDgSKlh9_3pBI9_IggS3C9aGh7I2edX484";
const ALL_TABS = ["Dashboard", "Users", "Courses", "Settings"];

const QUAL_TYPES = ["Bachelor", "Bachelor (Extended)", "Diploma", "Extended Diploma", "Higher Certificate"];
const INSTITUTIONS = [
  "University of the Witwatersrand",
  "University of Johannesburg",
  "University of Pretoria",
  "Stellenbosch University",
  "University of Cape Town",
  "University of KwaZulu-Natal",
  "University of the Free State",
  "North-West University",
  "University of Limpopo",
  "University of Zululand",
  "University of South Africa",
  "University of the Western Cape",
  "Nelson Mandela University",
  "Rhodes University",
  "Walter Sisulu University",
  "Tshwane University of Technology",
  "Durban University of Technology",
  "Central University of Technology",
  "Cape Peninsula University of Technology",
  "Vaal University of Technology",
  "Mangosuthu University of Technology",
  "University of Venda",
  "University of Fort Hare",
  "University of Mpumalanga",
  "Sefako Makgatho Health Sciences University",
  "Sol Plaatje University",
];

const BLANK_COURSE = {
  courseName: "", institution: INSTITUTIONS[0], faculty: "",
  duration: "", qualificationType: "Bachelor", minAPS: 0, keySubjects: [],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchAllAuthUsers(idToken) {
  // Uses Firebase Identity Toolkit API to list all Auth users (admin only via token)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/course-finder-214e7/accounts:lookup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({}),
    }
  );
  // fallback: use download API
  const res2 = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:query?key=${FIREBASE_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnSecureToken: false }) }
  );
  return null; // handled below
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Dashboard");

  // Users state — merged Auth + Firestore
  const [currentUserRole, setCurrentUserRole] = useState("super");
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

  // Course filters
  const [filterInstitution, setFilterInstitution] = useState("");
  const [filterQualType, setFilterQualType] = useState("");
  const [filterMinAPS, setFilterMinAPS] = useState("");
  const [filterMaxAPS, setFilterMaxAPS] = useState("");

  // Courses state — Firestore
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseSearch, setCourseSearch] = useState("");
  const [editingCourse, setEditingCourse] = useState(null); // null | course obj with id
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState(BLANK_COURSE);
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(null);

  // Settings
  const [adminEmailInput, setAdminEmailInput] = useState("");

  // UI
  const [toast, setToast] = useState(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load users from Firestore ────────────────────────────────────────────
  // Note: Firebase Auth user listing requires Admin SDK (server-side).
  // Users appear here as soon as they sign in (SignIn.jsx writes their doc).
  // For pre-existing Auth accounts, use "Import users" below.
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "users"));
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
    } catch (err) {
      showToast("Failed to load users: " + err.message, "error");
    } finally {
      setLoadingUsers(false);
    }
  }, []);


  // ── Load Firestore courses ───────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const snap = await getDocs(collection(db, "courses"));
      if (snap.empty) {
        // First run: seed from local JSON
        showToast("No courses in Firestore yet. Seed from local JSON first.", "error");
        setCourses([]);
      } else {
        setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      showToast("Failed to load courses: " + err.message, "error");
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  // Seed courses from local JSON into Firestore (one-time operation)
  const handleSeedCourses = async () => {
    try {
      showToast("Seeding courses to Firestore… this may take a moment.", "success");
      const { default: localCourses } = await import("../data/courses.json");
      let count = 0;
      for (const course of localCourses) {
        await addDoc(collection(db, "courses"), course);
        count++;
      }
      showToast(`✓ Seeded ${count} courses to Firestore`);
      loadCourses();
    } catch (err) {
      showToast("Seed failed: " + err.message, "error");
    }
  };

  useEffect(() => { loadUsers(); loadCourses(); }, [loadUsers, loadCourses]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    total: users.length,
    free: users.filter((u) => !u.plan || u.plan === "free").length,
    adFree: users.filter((u) => u.plan === "ad_free").length,
    applyForMe: users.filter((u) => u.plan === "apply_for_me").length,
    admins: users.filter((u) => u.isAdmin).length,
    authOnly: users.filter((u) => u.authOnly).length,
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

  // ── Course actions ────────────────────────────────────────────────────────
  const handleSaveCourse = async () => {
    try {
      const { id, ...data } = editingCourse;
      await updateDoc(doc(db, "courses", id), data);
      setCourses((prev) => prev.map((c) => c.id === id ? { id, ...data } : c));
      setEditingCourse(null);
      showToast("Course updated");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleAddCourse = async () => {
    try {
      const ref = await addDoc(collection(db, "courses"), newCourse);
      setCourses((prev) => [...prev, { id: ref.id, ...newCourse }]);
      setNewCourse(BLANK_COURSE);
      setAddingCourse(false);
      showToast("Course added");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleDeleteCourse = async (id, name) => {
    try {
      await deleteDoc(doc(db, "courses", id));
      setCourses((prev) => prev.filter((c) => c.id !== id));
      setConfirmDeleteCourse(null);
      showToast(`"${name}" deleted`);
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
    return matchSearch && matchPlan && matchAdmin && matchAuthOnly;
  });

  const filteredCourses = courses.filter((c) => {
    const matchSearch = !courseSearch ||
      c.courseName?.toLowerCase().includes(courseSearch.toLowerCase()) ||
      c.institution?.toLowerCase().includes(courseSearch.toLowerCase());
    const matchInstitution = !filterInstitution || c.institution === filterInstitution;
    const matchQualType = !filterQualType || c.qualificationType === filterQualType;
    const matchMinAPS = !filterMinAPS || c.minAPS >= Number(filterMinAPS);
    const matchMaxAPS = !filterMaxAPS || c.minAPS <= Number(filterMaxAPS);
    return matchSearch && matchInstitution && matchQualType && matchMinAPS && matchMaxAPS;
  });

  // ── Sub-renders ───────────────────────────────────────────────────────────
  const planBadge = (plan) => {
    const styles = {
      free: "bg-gray-700 text-gray-300",
      ad_free: "bg-blue-900 text-blue-300",
      apply_for_me: "bg-purple-900 text-purple-300",
    };
    const labels = { free: "Free", ad_free: "Ad-Free R30", apply_for_me: "Apply R150" };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[plan] || styles.free}`}>{labels[plan] || "Free"}</span>;
  };

  const CourseFormFields = ({ data, onChange }) => {
    const keySubjects = data.keySubjects || [];

    const updateKeySubject = (i, field, value) => {
      const updated = keySubjects.map((k, idx) =>
        idx === i ? { ...k, [field]: field === "minMark" ? Number(value) : value } : k
      );
      onChange("keySubjects", updated);
    };

    const addKeySubject = () => {
      onChange("keySubjects", [...keySubjects, { subject: "", minMark: 50 }]);
    };

    const removeKeySubject = (i) => {
      onChange("keySubjects", keySubjects.filter((_, idx) => idx !== i));
    };

    return (
      <div className="space-y-3">
        {[["courseName","Course Name"],["faculty","Faculty"],["duration","Duration (e.g. 3 years)"]].map(([field, label]) => (
          <div key={field}>
            <label className="text-xs text-gray-400 mb-1 block">{label}</label>
            <input value={data[field] || ""} onChange={(e) => onChange(field, e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Institution</label>
          <select value={data.institution || ""} onChange={(e) => onChange("institution", e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
            {INSTITUTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Qualification Type</label>
          <select value={data.qualificationType || ""} onChange={(e) => onChange("qualificationType", e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
            {QUAL_TYPES.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Minimum APS</label>
          <input type="number" value={data.minAPS || ""} onChange={(e) => onChange("minAPS", Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>

        {/* Key Subjects */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Required Subjects</label>
            <button type="button" onClick={addKeySubject}
              className="text-xs bg-green-800 hover:bg-green-700 text-green-300 px-2 py-1 rounded-lg transition">
              + Add Subject
            </button>
          </div>
          {keySubjects.length === 0 ? (
            <p className="text-xs text-gray-600 italic px-1">No required subjects — open to all with qualifying APS.</p>
          ) : (
            <div className="space-y-2">
              {keySubjects.map((ks, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={ks.subject || ""}
                    onChange={(e) => updateKeySubject(i, "subject", e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-gray-500 text-xs">≥</span>
                    <input
                      type="number"
                      value={ks.minMark ?? 50}
                      min={0} max={100}
                      onChange={(e) => updateKeySubject(i, "minMark", e.target.value)}
                      className="w-16 bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-gray-500 text-xs">%</span>
                  </div>
                  <button type="button" onClick={() => removeKeySubject(i)}
                    className="text-red-500 hover:text-red-400 font-bold text-base px-1 transition">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === "error" ? "bg-red-600" : "bg-green-600"} text-white max-w-sm`}>
          {toast.msg}
        </div>
      )}

      {/* Import users modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div>
              <p className="text-lg font-bold text-white">Import Users from Firebase Console</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Go to Firebase Console → Authentication → Users, copy the email addresses
                (Identifier column) and paste them below — one per line or comma-separated.
                This creates Firestore stubs so they appear in the admin panel immediately.
              </p>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"user1@example.com\nuser2@example.com\nuser3@example.com"}
              rows={6}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowImport(false); setImportText(""); }}
                className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleImportUsers}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition">
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete user */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 text-center space-y-4">
            <p className="text-lg font-bold text-red-400">Delete User?</p>
            <p className="text-gray-400 text-sm">
              Permanently delete <span className="text-white font-medium">{confirmDeleteUser.email}</span> from Auth and Firestore.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteUser(null)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={() => handleDeleteUser(confirmDeleteUser.uid, confirmDeleteUser.email)} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete course */}
      {confirmDeleteCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 text-center space-y-4">
            <p className="text-lg font-bold text-red-400">Delete Course?</p>
            <p className="text-gray-400 text-sm">Remove <span className="text-white font-medium">"{confirmDeleteCourse.courseName}"</span> permanently?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteCourse(null)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={() => handleDeleteCourse(confirmDeleteCourse.id, confirmDeleteCourse.courseName)} className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit course modal */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4 my-8">
            <h3 className="text-lg font-bold text-white">Edit Course</h3>
            <CourseFormFields data={editingCourse} onChange={(f, v) => setEditingCourse((p) => ({ ...p, [f]: v }))} />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditingCourse(null)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleSaveCourse} className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add course modal */}
      {addingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4 my-8">
            <h3 className="text-lg font-bold text-white">Add New Course</h3>
            <CourseFormFields data={newCourse} onChange={(f, v) => setNewCourse((p) => ({ ...p, [f]: v }))} />
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAddingCourse(false)} className="flex-1 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm transition">Cancel</button>
              <button onClick={handleAddCourse} className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-sm font-semibold transition">Add Course</button>
            </div>
          </div>
        </div>
      )}

      {/* Top nav */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-sm font-bold">A</div>
          <span className="font-bold text-white text-lg">Admin Panel</span>
          <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">RESTRICTED</span>
        </div>
        <button onClick={() => navigate("/home")} className="text-gray-400 hover:text-white text-sm transition">← Back to App</button>
      </div>

      {/* Tabs — filtered by current user's role permissions */}
      <div className="flex border-b border-gray-800 px-6">
        {ALL_TABS
          .filter((t) => (PERMISSIONS[currentUserRole] || []).includes(t.toLowerCase()))
          .map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px
                ${tab === t ? "border-purple-500 text-purple-400" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
              {t}
            </button>
          ))}
      </div>

      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">

        {/* ── DASHBOARD ── */}
        {tab === "Dashboard" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={stats.total} icon="👥" color="from-blue-600 to-blue-800" />
              <StatCard label="Free Plan" value={stats.free} icon="✅" color="from-gray-600 to-gray-800" />
              <StatCard label="Ad-Free (R30)" value={stats.adFree} icon="⭐" color="from-blue-700 to-purple-700" />
              <StatCard label="Apply For Me (R150)" value={stats.applyForMe} icon="🚀" color="from-purple-700 to-pink-700" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Total Courses" value={courses.length} icon="📚" color="from-green-700 to-teal-700" />
              <StatCard label="Auth-Only Accounts" value={stats.authOnly} icon="👤" color="from-orange-700 to-red-700" />
              <StatCard label="Est. Revenue" value={`R${stats.adFree * 30 + stats.applyForMe * 150}`} icon="💰" color="from-yellow-600 to-orange-600" />
            </div>

            {/* Plan distribution */}
            {stats.total > 0 && (
              <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                <p className="text-sm font-semibold text-gray-300 mb-3">Plan Distribution</p>
                <div className="flex rounded-full overflow-hidden h-4 mb-3">
                  <div className="bg-gray-500" style={{ width: `${(stats.free/stats.total)*100}%` }} />
                  <div className="bg-blue-500" style={{ width: `${(stats.adFree/stats.total)*100}%` }} />
                  <div className="bg-purple-500" style={{ width: `${(stats.applyForMe/stats.total)*100}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span><span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1"/>Free ({Math.round((stats.free/stats.total)*100)}%)</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"/>Ad-Free ({Math.round((stats.adFree/stats.total)*100)}%)</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1"/>Apply ({Math.round((stats.applyForMe/stats.total)*100)}%)</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "Users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold text-white">
                Users <span className="text-gray-500 font-normal text-base">({filteredUsers.length})</span>
                {stats.authOnly > 0 && (
                  <span className="ml-2 text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded-full">
                    {stats.authOnly} auth-only
                  </span>
                )}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setShowImport(true)}
                  className="text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-900 px-3 py-1.5 rounded-lg transition">
                  ⬇ Import
                </button>
                <button onClick={loadUsers} className="text-xs text-purple-400 hover:text-purple-300 border border-gray-700 px-3 py-1.5 rounded-lg transition">
                  ↻ Refresh
                </button>
              </div>
            </div>

            <input value={searchUser} onChange={(e) => setSearchUser(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />

            {/* User filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">All Plans</option>
                <option value="free">Free</option>
                <option value="ad_free">Ad-Free (R30)</option>
                <option value="apply_for_me">Apply For Me (R150)</option>
              </select>
              <select value={filterAdmin} onChange={(e) => setFilterAdmin(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">All Roles</option>
                <option value="true">Admins Only</option>
                <option value="false">Non-Admins</option>
              </select>
              <select value={filterAuthOnly} onChange={(e) => setFilterAuthOnly(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">All Account Types</option>
                <option value="true">Auth-Only (no profile)</option>
                <option value="false">Has Profile</option>
              </select>
              {(filterPlan || filterAdmin || filterAuthOnly) && (
                <button onClick={() => { setFilterPlan(""); setFilterAdmin(""); setFilterAuthOnly(""); }}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-900 px-2 py-1 rounded-lg transition">
                  Clear filters
                </button>
              )}
              <span className="text-xs text-gray-600 ml-auto">{filteredUsers.length} of {users.length} users</span>
            </div>

            {loadingUsers ? (
              <p className="text-gray-500 text-sm py-8 text-center">Loading users…</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">No users found.</p>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <div key={user.uid} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-800/40 transition"
                      onClick={() => setExpandedUser(expandedUser === user.uid ? null : user.uid)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-purple-900 flex items-center justify-center text-sm font-bold text-purple-300 shrink-0">
                          {((user.firstName || user.displayName || user.email || "?")[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {user.firstName ? `${user.firstName} ${user.lastName || ""}` : (user.displayName || user.email || "Unknown")}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {user.authOnly && <span className="text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded-full">Auth-only</span>}
                        {user.isAdmin && (() => {
                          const ri = getRoleInfo(user.adminRole || "admin");
                          return <span className={`text-xs px-2 py-0.5 rounded-full ${ri?.bg || "bg-red-900"} ${ri?.color || "text-red-300"}`}>{ri?.badge} {ri?.label || "Admin"}</span>;
                        })()}
                        {planBadge(user.plan)}
                        <span className="text-gray-600">{expandedUser === user.uid ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {expandedUser === user.uid && (
                      <div className="border-t border-gray-800 px-5 py-4 space-y-4">

                        {/* Profile card */}
                        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Profile</p>
                          <div className="grid grid-cols-2 gap-3">
                            <InfoCell label="First Name" value={user.firstName || user.displayName?.split(" ")[0] || "—"} />
                            <InfoCell label="Last Name" value={user.lastName || user.displayName?.split(" ").slice(1).join(" ") || "—"} />
                            <InfoCell label="Email" value={user.email} />
                            <InfoCell label="Date of Birth" value={user.dob || "—"} />
                          </div>
                        </div>

                        {/* Account info */}
                        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Account</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <InfoCell label="UID" value={user.uid} mono />
                            <InfoCell label="Plan" value={user.plan || "free"} />
                            <InfoCell label="Admin" value={user.isAdmin ? "Yes" : "No"} />
                            <InfoCell label="Joined" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-ZA") : "—"} />
                            <InfoCell label="Last Login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("en-ZA") : "—"} />
                            <InfoCell label="Email Verified" value={user.emailVerified ? "Yes" : "No"} />
                          </div>
                        </div>

                        {user.subjects?.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 mb-2 font-medium">Entered Subjects (APS: {user.aps || "—"})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {user.subjects.map((s, i) => (
                                <span key={i} className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-lg">
                                  {s.subject}: <span className="text-white font-semibold">{s.mark}%</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-1">
                          <select value={user.plan || "free"} onChange={(e) => handleChangePlan(user.uid, e.target.value)}
                            className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                            <option value="free">Set: Free</option>
                            <option value="ad_free">Set: Ad-Free (R30)</option>
                            <option value="apply_for_me">Set: Apply For Me (R150)</option>
                          </select>
                          <button onClick={() => handlePasswordReset(user.email)}
                            className="bg-blue-900 hover:bg-blue-800 text-blue-300 text-xs px-3 py-1.5 rounded-lg transition">
                            📧 Reset Password
                          </button>
                          {/* Role selector — only super admins can grant super role */}
                          {!isSuperAdmin(user.email) && (
                            <select
                              value={user.isAdmin ? (user.adminRole || "admin") : "none"}
                              onChange={(e) => handleSetRole(user.uid, e.target.value === "none" ? null : e.target.value)}
                              className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                            >
                              <option value="none">🚫 No Access</option>
                              <option value="moderator">🟡 Moderator (courses only)</option>
                              <option value="admin">🟠 Admin (full access)</option>
                              {isSuperAdmin(auth.currentUser?.email) && (
                                <option value="super">🔴 Super Admin</option>
                              )}
                            </select>
                          )}
                          {isSuperAdmin(user.email) && (
                            <span className="text-xs bg-red-900 text-red-300 px-3 py-1.5 rounded-lg">🔴 Super Admin (protected)</span>
                          )}
                          <button onClick={() => setConfirmDeleteUser({ uid: user.uid, email: user.email })}
                            className="bg-red-900 hover:bg-red-800 text-red-300 text-xs px-3 py-1.5 rounded-lg transition">
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── COURSES ── */}
        {tab === "Courses" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-xl font-bold text-white">
                Courses <span className="text-gray-500 font-normal text-base">({filteredCourses.length})</span>
              </h2>
              <div className="flex gap-2">
                {courses.length === 0 && (
                  <button onClick={handleSeedCourses}
                    className="text-xs bg-yellow-700 hover:bg-yellow-600 text-yellow-200 px-3 py-1.5 rounded-lg transition font-medium">
                    ⚡ Seed from JSON
                  </button>
                )}
                <button onClick={() => { setNewCourse(BLANK_COURSE); setAddingCourse(true); }}
                  className="text-xs bg-green-700 hover:bg-green-600 text-green-200 px-3 py-1.5 rounded-lg transition font-medium">
                  + Add Course
                </button>
                <button onClick={loadCourses}
                  className="text-xs text-purple-400 hover:text-purple-300 border border-gray-700 px-3 py-1.5 rounded-lg transition">
                  ↻ Refresh
                </button>
              </div>
            </div>

            <input value={courseSearch} onChange={(e) => setCourseSearch(e.target.value)}
              placeholder="Search by course name or institution…"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />

            {/* Course filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <select value={filterInstitution} onChange={(e) => setFilterInstitution(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">All Institutions</option>
                {[...new Set(courses.map((c) => c.institution))].sort().map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
              <select value={filterQualType} onChange={(e) => setFilterQualType(e.target.value)}
                className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="">All Qualifications</option>
                {QUAL_TYPES.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 text-xs">APS</span>
                <input type="number" value={filterMinAPS} onChange={(e) => setFilterMinAPS(e.target.value)}
                  placeholder="Min" min={0} max={100}
                  className="w-16 bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <span className="text-gray-600 text-xs">–</span>
                <input type="number" value={filterMaxAPS} onChange={(e) => setFilterMaxAPS(e.target.value)}
                  placeholder="Max" min={0} max={100}
                  className="w-16 bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              {(filterInstitution || filterQualType || filterMinAPS || filterMaxAPS) && (
                <button onClick={() => { setFilterInstitution(""); setFilterQualType(""); setFilterMinAPS(""); setFilterMaxAPS(""); }}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-900 px-2 py-1 rounded-lg transition">
                  Clear filters
                </button>
              )}
              <span className="text-xs text-gray-600 ml-auto">{filteredCourses.length} of {courses.length} courses</span>
            </div>

            {loadingCourses ? (
              <p className="text-gray-500 text-sm py-8 text-center">Loading courses…</p>
            ) : courses.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <p className="text-gray-400">No courses in Firestore yet.</p>
                <p className="text-gray-600 text-sm">Click "Seed from JSON" to import your 300 courses, then you can add, edit and delete them here.</p>
                <button onClick={handleSeedCourses} className="bg-yellow-600 hover:bg-yellow-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition">
                  ⚡ Seed Courses from JSON
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-4 py-3">Course</th>
                      <th className="text-left px-4 py-3 hidden md:table-cell">Institution</th>
                      <th className="text-left px-4 py-3 hidden md:table-cell">Type</th>
                      <th className="text-left px-4 py-3">APS</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredCourses.map((course) => (
                      <tr key={course.id} className="bg-gray-950 hover:bg-gray-900 transition">
                        <td className="px-4 py-3 font-medium text-white max-w-xs">
                          <p className="truncate">{course.courseName}</p>
                          <p className="text-xs text-gray-500 md:hidden truncate">{course.institution}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-400 hidden md:table-cell max-w-xs">
                          <p className="truncate">{course.institution}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{course.qualificationType}</span>
                        </td>
                        <td className="px-4 py-3 text-purple-400 font-semibold">{course.minAPS}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingCourse({ ...course })}
                              className="text-xs bg-purple-900 hover:bg-purple-800 text-purple-300 px-3 py-1 rounded-lg transition">
                              Edit
                            </button>
                            <button onClick={() => setConfirmDeleteCourse(course)}
                              className="text-xs bg-red-900 hover:bg-red-800 text-red-300 px-3 py-1 rounded-lg transition">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "Settings" && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-xl font-bold text-white">Settings</h2>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <p className="font-semibold text-white">Grant Admin Access</p>
              <p className="text-xs text-gray-400">Enter the email of an existing user to give them admin access.</p>
              <div className="flex gap-2">
                <input value={adminEmailInput} onChange={(e) => setAdminEmailInput(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <button onClick={handleGrantAdminByEmail}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition font-medium">Grant</button>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
              <p className="font-semibold text-white">Current Admins</p>
              {users.filter((u) => u.isAdmin).length === 0
                ? <p className="text-gray-500 text-sm">No other admins.</p>
                : users.filter((u) => u.isAdmin).map((u) => (
                  <div key={u.uid} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-2">
                    <div>
                      <p className="text-sm text-white">{u.firstName ? `${u.firstName} ${u.lastName}` : u.email}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                    <button onClick={() => handleToggleAdmin(u.uid, true)} className="text-xs text-red-400 hover:text-red-300">Revoke</button>
                  </div>
                ))
              }
            </div>

            <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-5 space-y-2">
              <p className="font-semibold text-red-400">Note on User Deletion</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                The Delete button removes the user's Firestore document and attempts to delete their Auth account via the REST API.
                If the REST delete fails (permissions), use the{" "}
                <a href="https://console.firebase.google.com/project/course-finder-214e7/authentication/users"
                  target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                  Firebase Console
                </a>{" "}as a fallback.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-4 space-y-1`}>
      <span className="text-2xl">{icon}</span>
      <p className="text-2xl font-extrabold text-white">{value}</p>
      <p className="text-xs text-white/70">{label}</p>
    </div>
  );
}

function InfoCell({ label, value, mono }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2">
      <p className="text-gray-500 text-xs mb-0.5">{label}</p>
      <p className={`text-white text-xs truncate ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}