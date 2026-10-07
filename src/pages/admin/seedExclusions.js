import { doc, updateDoc, setDoc, getDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../firebase";

// ─── Seed exclusions ("tombstones") ────────────────────────────────────────
//
// Deleting a course from the admin panel only removes it from the `courses`
// collection — the seed scripts have no other memory of that deletion. Since
// seeding just diffs "what's in the local JSON" against "what's currently in
// Firestore", a deleted course that's still in courses.json / 
// college-courses.json looks indistinguishable from a never-seeded one, and
// silently comes back on the next seed. This doc is the fix: every deletion
// records its dedupe key here, and both seed functions skip anything listed,
// regardless of whether it's still present in the JSON file.
export const SEED_EXCLUSIONS_DOC = doc(db, "meta", "seedExclusions");

export async function getSeedExclusions() {
  const snap = await getDoc(SEED_EXCLUSIONS_DOC);
  return new Set(snap.exists() ? snap.data().keys || [] : []);
}

export async function addSeedExclusion(key) {
  await setDoc(SEED_EXCLUSIONS_DOC, { keys: arrayUnion(key) }, { merge: true });
}

export async function removeSeedExclusion(key) {
  await updateDoc(SEED_EXCLUSIONS_DOC, { keys: arrayRemove(key) }).catch(() =>
    // doc might not exist yet if nothing's ever been excluded — fine, no-op
    null
  );
}
