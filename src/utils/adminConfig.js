// Only accounts whose email appears here can access the admin panel.
// To grant admin to another account, add their email below AND set
// isAdmin: true on their Firestore user document.
export const ADMIN_EMAILS = ["lubisialpha@gmail.com"];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes((email || "").toLowerCase().trim());
}