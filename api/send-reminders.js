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
import { sendToTokens, assignTokenOwners, ownedTokens } from "./_lib/push.js";
import { saToday } from "../src/utils/saDate.js";

const ONE_DAY = 24 * 60 * 60;
const CONCURRENCY = 10;
// A run that claimed today but never finished (timed out or crashed) can be
// re-run after this long; learners already reminded today are skipped.
const STALE_RUN_MS = 15 * 60 * 1000;

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
  let runRef = null;
  let claimed = false;
  let sendingStarted = false;

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    runRef = db.collection("system").doc("pushReminders");

    // Claim today's run, so a retry or a manual call can't send everything
    // twice — unless an earlier claim today never finished.
    if (!dryRun) {
      claimed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(runRef);
        const run = snap.exists ? snap.data() : {};
        if (run.lastRunDate === today) {
          const stale = !run.finishedAt && run.startedAt && Date.now() - Date.parse(run.startedAt) > STALE_RUN_MS;
          if (!stale) return false;
        }
        tx.set(runRef, { lastRunDate: today, startedAt: new Date().toISOString(), finishedAt: null }, { merge: true });
        return true;
      });
      if (!claimed) return res.status(200).json({ today, skipped: "Reminders were already sent (or are being sent) today." });
    }

    const [institutionSnap, facultySnap, usersSnap] = await Promise.all([
      db.collection("institutionSettings").get(),
      db.collection("facultySettings").get(),
      db.collection("users").where("reminders", "==", true).get(),
    ]);
    const optedIn = usersSnap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    const owners = assignTokenOwners(optedIn);
    const plan = planReminders({
      // Skip learners a retried run already reached today, and only use the
      // device tokens each learner owns.
      users: optedIn
        .filter((u) => u.lastReminderDate !== today)
        .map((u) => ({ ...u, pushTokens: ownedTokens(u, owners) })),
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
    sendingStarted = true;
    for (let i = 0; i < plan.length; i += CONCURRENCY) {
      await Promise.all(plan.slice(i, i + CONCURRENCY).map(async ({ uid, tokens, message }) => {
        try {
          const result = await sendToTokens(messaging, tokens, message, ONE_DAY);
          summary.sent += result.sent;
          summary.failed += result.failed;
          const update = { lastReminderDate: today };
          if (result.deadTokens.length) update.pushTokens = FieldValue.arrayRemove(...result.deadTokens);
          await db.collection("users").doc(uid).update(update);
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
    // Nothing was sent yet, so give the day back for a retry.
    if (claimed && !sendingStarted && runRef) {
      try {
        await runRef.set({ lastRunDate: FieldValue.delete() }, { merge: true });
      } catch (cleanupErr) {
        console.error("Couldn't release today's reminder run:", cleanupErr);
      }
    }
    return res.status(500).json({ error: "Sending reminders failed." });
  }
}
