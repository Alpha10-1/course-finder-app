// ─── Super Admin ──────────────────────────────────────────────────────────────
// This email ALWAYS has full admin access, even if their Firestore doc is
// deleted or their isAdmin field is removed. Cannot be revoked from the UI.
export const SUPER_ADMIN_EMAIL = "lubisialpha@gmail.com";

// ─── Admin Roles ─────────────────────────────────────────────────────────────
// role: "super"     — full access to everything (auto-assigned to SUPER_ADMIN_EMAIL)
// role: "admin"     — full admin panel: users + courses + settings
// role: "moderator" — courses tab only; cannot manage users or grant roles
export const ADMIN_ROLES = {
  super:     { label: "Super Admin", color: "text-red-400",    bg: "bg-red-900",    badge: "🔴" },
  admin:     { label: "Admin",       color: "text-orange-400", bg: "bg-orange-900", badge: "🟠" },
  moderator: { label: "Moderator",   color: "text-yellow-400", bg: "bg-yellow-900", badge: "🟡" },
};

// What each role can access
export const PERMISSIONS = {
  super:     ["dashboard", "quick check", "users", "courses", "settings", "audit log"],
  admin:     ["dashboard", "quick check", "users", "courses", "settings"],
  moderator: ["quick check", "courses"],
};

export function isSuperAdmin(email) {
  return (email || "").toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();
}

export function hasPermission(role, tab) {
  const perms = PERMISSIONS[role] || [];
  return perms.includes(tab.toLowerCase());
}

export function getRoleInfo(role) {
  return ADMIN_ROLES[role] || null;
}