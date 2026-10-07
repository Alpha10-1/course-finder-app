import { useMemo } from "react";
import { auth } from "../../firebase";
import { isSuperAdmin, getRoleInfo } from "../../utils/adminConfig";
import { getQualifiedCourses, getApplicationProgress } from "./helpers";
import { InfoCell } from "./ui";
import QualifiedCoursesPanel from "./QualifiedCoursesPanel";

function planBadge(plan) {
  const styles = {
    free: "bg-gray-700 text-gray-300",
    apply_for_me: "bg-purple-900 text-purple-300",
  };
  const labels = { free: "Free", apply_for_me: "Apply R100" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[plan] || styles.free}`}>{labels[plan] || "Free"}</span>;
}

export default function UsersTab({ admin, courses }) {
  const {
    users, loadingUsers, searchUser, setSearchUser, expandedUser, setExpandedUser, showImport,
    setShowImport, importText, setImportText, filterPlan, setFilterPlan, filterAdmin, setFilterAdmin,
    filterAuthOnly, setFilterAuthOnly, filterEnteredMarks, setFilterEnteredMarks, userSortBy,
    setUserSortBy, confirmDeleteUser, setConfirmDeleteUser, loadUsers, stats, handlePasswordReset,
    handleDeleteUser, handleSetRole, handleChangePlan, handleToggleInstitutionApplied,
    handleImportUsers, filteredUsers, sortedFilteredUsers,
  } = admin;

  // Only computed for whichever user row is currently expanded — the full
  // catalog × matching rules isn't worth recomputing for every user on load.
  const expandedUserQualified = useMemo(() => {
    const user = users.find((u) => u.uid === expandedUser);
    return getQualifiedCourses(user, courses);
  }, [expandedUser, users, courses]);

  return (
    <>
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
            <option value="apply_for_me">Apply For Me (R100)</option>
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
          <select value={filterEnteredMarks} onChange={(e) => setFilterEnteredMarks(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="">All (Marks or Not)</option>
            <option value="true">Entered Marks</option>
            <option value="false">Haven't Entered Marks</option>
          </select>
          <select value={userSortBy} onChange={(e) => setUserSortBy(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="">Sort: Default</option>
            <option value="lastActivityAt">Most Recent Activity</option>
            <option value="lastLoginAt">Most Recent Login</option>
          </select>
          {(filterPlan || filterAdmin || filterAuthOnly || filterEnteredMarks || userSortBy) && (
            <button onClick={() => {
              setFilterPlan(""); setFilterAdmin(""); setFilterAuthOnly("");
              setFilterEnteredMarks(""); setUserSortBy("");
            }}
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
            {sortedFilteredUsers.map((user) => (
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
                        <InfoCell label="Last Activity" value={user.lastActivityAt ? new Date(user.lastActivityAt).toLocaleDateString("en-ZA") : "—"} />
                        <InfoCell label="Entered Marks" value={Array.isArray(user.subjects) && user.subjects.length > 0 ? "Yes" : "No"} />
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

                    {/* Qualified courses — computed live from this user's subjects/grade
                        against the full course catalog, same rules as the learner-facing
                        Results page. Only calculated for the expanded user. */}
                    {user.subjects?.length > 0 && (
                      <QualifiedCoursesPanel
                        courses={expandedUser === user.uid ? expandedUserQualified : []}
                      />
                    )}

                    {/* Apply For Me selections */}
                    {user.applySelections && (() => {
                      const progress = getApplicationProgress(user);
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-gray-400 font-medium">
                              Apply For Me Selections
                              {user.applyStatus && (
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                  user.applyStatus === "submitted" ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"
                                }`}>
                                  {user.applyStatus === "submitted" ? "Submitted by learner" : "Draft"}
                                </span>
                              )}
                            </p>
                            {progress.status && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                progress.status === "complete" ? "bg-green-900 text-green-300" :
                                progress.status === "in_progress" ? "bg-blue-900 text-blue-300" :
                                "bg-yellow-900 text-yellow-300"
                              }`}>
                                {progress.status === "complete" ? "✓ Applications complete" :
                                 progress.status === "in_progress" ? `Applied ${progress.appliedCount}/${progress.total}` :
                                 "Not started"}
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {Object.entries(user.applySelections).map(([inst, choices]) => {
                              const applied = !!user.applicationProgress?.[inst]?.applied;
                              const appliedAt = user.applicationProgress?.[inst]?.appliedAt;
                              return (
                                <div key={inst} className="bg-gray-800 rounded-xl p-3">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className="text-white text-xs font-semibold">{inst}</p>
                                    <button
                                      onClick={() => handleToggleInstitutionApplied(user.uid, inst, !applied)}
                                      className={`text-xs px-2 py-1 rounded-lg transition font-medium shrink-0 ${
                                        applied
                                          ? "bg-green-900 text-green-300 hover:bg-green-800"
                                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                      }`}
                                    >
                                      {applied ? "✓ Applied" : "Mark as Applied"}
                                    </button>
                                  </div>
                                  {[1, 2, 3].map((r) => choices[r] && (
                                    <p key={r} className="text-gray-400 text-xs">
                                      <span className="text-purple-400">Choice {r}:</span> {choices[r].courseName}
                                    </p>
                                  ))}
                                  {applied && appliedAt && (
                                    <p className="text-green-500 text-[10px] mt-1">
                                      Applied on {new Date(appliedAt).toLocaleDateString("en-ZA")}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Application contact details */}
                    {(user.applyPhone || user.applyEmail) && (
                      <div className="bg-gray-800 rounded-xl p-4 space-y-2">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Application Contact</p>
                        {user.applyPhone && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white">📞 {user.applyPhone}</span>
                            <a href={"https://wa.me/" + user.applyPhone.replace(/[^0-9]/g, "")}
                              target="_blank" rel="noopener noreferrer"
                              className="text-xs bg-green-800 text-green-300 px-2 py-0.5 rounded-full hover:bg-green-700 transition">
                              WhatsApp ↗
                            </a>
                          </div>
                        )}
                        {user.applyEmail && (
                          <p className="text-sm text-white">✉️ {user.applyEmail}</p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {/* Quick grant Apply For Me */}
                      {user.plan !== "apply_for_me" ? (
                        <button
                          onClick={() => handleChangePlan(user.uid, "apply_for_me")}
                          className="bg-purple-800 hover:bg-purple-700 text-purple-200 text-xs px-3 py-1.5 rounded-lg transition font-medium"
                        >
                          🚀 Grant Apply For Me
                        </button>
                      ) : (
                        <button
                          onClick={() => handleChangePlan(user.uid, "free")}
                          className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition"
                        >
                          Revoke Apply For Me
                        </button>
                      )}
                      <select value={user.plan || "free"} onChange={(e) => handleChangePlan(user.uid, e.target.value)}
                        className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                        <option value="free">Set: Free</option>
                        <option value="apply_for_me">Set: Apply For Me (R100)</option>
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
    </>
  );
}
