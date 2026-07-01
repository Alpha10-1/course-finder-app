import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load service account key
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync("./serviceAccountKey.json", "utf8"));
} catch {
  console.error("❌ serviceAccountKey.json not found in project root.");
  console.error("   Go to Firebase Console → Project Settings → Service Accounts → Generate new private key");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function deduplicate() {
  console.log("Fetching all courses from Firestore…");
  const snap = await db.collection("courses").get();
  const all  = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`Found ${all.length} total course documents.`);

  const seen     = new Map();
  const toDelete = [];

  for (const course of all) {
    const key = [
      (course.courseName  || "").trim().toLowerCase(),
      (course.institution || "").trim().toLowerCase(),
      (course.faculty     || "").trim().toLowerCase(),
    ].join("|||");

    if (seen.has(key)) {
      toDelete.push({ id: course.id, name: course.courseName, inst: course.institution });
    } else {
      seen.set(key, course.id);
    }
  }

  console.log(`\nKeeping  : ${seen.size} unique courses`);
  console.log(`Deleting : ${toDelete.length} duplicates\n`);

  if (toDelete.length === 0) {
    console.log("✅ No duplicates found — Firestore is already clean.");
    process.exit(0);
  }

  toDelete.slice(0, 10).forEach((c) =>
    console.log(`  🗑  ${c.name} @ ${c.inst} (${c.id})`)
  );
  if (toDelete.length > 10) console.log(`  … and ${toDelete.length - 10} more`);

  console.log("\nDeleting duplicates…");
  let deleted = 0;
  // Firestore Admin supports batch deletes — use batches of 400
  const BATCH_SIZE = 400;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    toDelete.slice(i, i + BATCH_SIZE).forEach((item) => {
      batch.delete(db.collection("courses").doc(item.id));
    });
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, toDelete.length - i);
    process.stdout.write(`\r  ${deleted}/${toDelete.length} deleted`);
  }

  console.log(`\n✅ Done — removed ${deleted} duplicates. ${seen.size} courses remain.`);
  process.exit(0);
}

deduplicate().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});