// Vercel Serverless Function — api/send-reminders.js
//
// Runs once a day from Vercel Cron (see "crons" in vercel.json) and sends
// learners a push notification when an institution they're interested in
// opens applications, closes in 7 days, or closes tomorrow.
//
// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. Without
// CRON_SECRET set, the endpoint refuses every request, so nobody else can
// trigger a round of notifications.
//
// Add `?dryRun=1` to see what would be sent without sending anything (still
// needs the secret), e.g.:
//   curl -H "Authorization: Bearer $CRON_SECRET" "https://<vercel-app>/api/send-reminders?dryRun=1"
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAdminApp, hasBearerSecret } from "./_lib/firebaseAdmin.js";
import { planReminders } from "./_lib/reminders.js";
import { sendToTokens, removeDeadTokens } from "./_lib/push.js";
import { saToday } from "../src/utils/saDate.js";

const ONE_DAY = 24 * 60 * 60;
const CONCURRENCY = 10;

const mapById = (snap) => Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to send reminders");
    return res.status(500).json({ error: "Reminders are not configured on the server." });
  }
  if (!hasBearerSecret(req, secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const dryRun = req.query?.dryRun === "1";
  const today = saToday();

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    const runRef = db.collection("system").doc("pushReminders");

    // Claim today's run, so a retry or a manual call can't send everything twice.
    if (!dryRun) {
      const claimed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(runRef);
        if (snap.exists && snap.data().lastRunDate === today) return false;
        tx.set(runRef, { lastRunDate: today, startedAt: new Date().toISOString() }, { merge: true });
        return true;
      });
      if (!claimed) return res.status(200).json({ today, skipped: "Reminders were already sent today." });
    }

    const [institutionSnap, facultySnap, usersSnap] = await Promise.all([
      db.collection("institutionSettings").get(),
      db.collection("facultySettings").get(),
      db.collection("users").where("reminders", "==", true).get(),
    ]);
    const plan = planReminders({
      users: usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() })),
      institutionSettings: mapById(institutionSnap),
      facultySettings: mapById(facultySnap),
      today,
    });

    if (dryRun) {
      return res.status(200).json({
        today,
        dryRun: true,
        optedIn: usersSnap.size,
        notifications: plan.map((p) => ({ uid: p.uid, devices: p.tokens.length, ...p.message })),
      });
    }

    const messaging = getMessaging(app);
    const summary = { today, optedIn: usersSnap.size, learners: plan.length, sent: 0, failed: 0, removedTokens: 0 };
    for (let i = 0; i < plan.length; i += CONCURRENCY) {
      await Promise.all(plan.slice(i, i + CONCURRENCY).map(async ({ uid, tokens, message }) => {
        try {
          const result = await sendToTokens(messaging, tokens, message, ONE_DAY);
          summary.sent += result.sent;
          summary.failed += result.failed;
          await removeDeadTokens(db, FieldValue, uid, result.deadTokens);
          summary.removedTokens += result.deadTokens.length;
        } catch (err) {
          summary.failed += tokens.length;
          console.error(`Reminder to ${uid} failed:`, err);
        }
      }));
    }

    await runRef.set({ finishedAt: new Date().toISOString(), lastSummary: summary }, { merge: true });
    console.log("Reminders sent:", JSON.stringify(summary));
    return res.status(200).json(summary);
  } catch (err) {
    console.error("send-reminders failed:", err);
    return res.status(500).json({ error: "Sending reminders failed." });
  }
}
