import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { isSuperAdmin, PERMISSIONS } from "../utils/adminConfig";
import { ALL_TABS } from "./admin/constants";
import useToast from "./admin/useToast";
import useAdminUsers from "./admin/useAdminUsers";
import useAuditLog from "./admin/useAuditLog";
import useAdminCourses from "./admin/useAdminCourses";
import useApplicationWindows from "./admin/useApplicationWindows";
import DashboardTab from "./admin/DashboardTab";
import QuickCheckPanel from "./admin/QuickCheckPanel";
import UsersTab from "./admin/UsersTab";
import CoursesTab from "./admin/CoursesTab";
import AuditLogTab from "./admin/AuditLogTab";
import SettingsTab from "./admin/SettingsTab";

// Admin panel shell: tab navigation and toasts. Each area's state and actions
// live in a hook (src/pages/admin/use*.js) owned here rather than inside its
// tab component, so filters and searches survive switching tabs and data
// shared between tabs (users, courses) is loaded once.
export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Dashboard");
  const { toast, showToast } = useToast();
  const userAdmin = useAdminUsers(showToast);
  const audit = useAuditLog();
  const courseAdmin = useAdminCourses(showToast, audit);
  const windows = useApplicationWindows(showToast);
  const { currentUserRole } = userAdmin;
  const { courses } = courseAdmin;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === "error" ? "bg-red-600" : "bg-green-600"} text-white max-w-sm`}>
          {toast.msg}
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
        {tab === "Dashboard" && <DashboardTab stats={userAdmin.stats} courses={courses} />}

        {/* ── QUICK CHECK ── */}
        {/* Walk-in / no-account eligibility check: enter subjects + marks
            directly (no sign-up, no grade-selection step) and see which
            courses qualify — same matching rules as the learner-facing
            Results page, via the shared getQualifiedCourses() helper. */}
        {tab === "Quick Check" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Quick Check</h2>
            <p className="text-sm text-gray-400 -mt-2">
              Check qualifying courses for someone on the spot — no account needed. Enter subjects
              and marks below and hit Check.
            </p>
            <QuickCheckPanel courses={courses} />
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "Users" && <UsersTab admin={userAdmin} courses={courses} />}

        {/* ── COURSES ── */}
        {tab === "Courses" && <CoursesTab admin={courseAdmin} windows={windows} />}

        {/* ── AUDIT LOG (super admin only) ── */}
        {tab === "Audit Log" && isSuperAdmin(auth.currentUser?.email) && <AuditLogTab audit={audit} />}

        {/* ── SETTINGS ── */}
        {tab === "Settings" && <SettingsTab admin={userAdmin} />}
      </div>
    </div>
  );
}
