import { auth } from "../firebase";

// The Vercel deployment that hosts the api/ functions.
export const API_BASE = "https://course-finder-app-zeta.vercel.app";

/**
 * Asks the server to tell a learner (by push notification) that the team
 * has lodged their application at `institution`. Best effort: returns
 * `{ sent: 0 }` when the admin isn't signed in, and the server decides
 * whether the learner has a device to notify.
 */
export async function notifyApplicationLodged(uid, institution) {
  const idToken = await auth.currentUser?.getIdToken?.();
  if (!idToken) return { sent: 0 };
  const res = await fetch(`${API_BASE}/api/notify-application`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ uid, institution }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}
