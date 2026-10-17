// Vercel Serverless Function — api/notify-application.js
//
// Called from the admin panel right after an admin marks one of a learner's
// Apply For Me institutions as "applied". Sends that learner a push
// notification, if they've turned reminders on for at least one device.
//
// Only admins can call it: the request carries the admin's Firebase ID
// token, which is verified here. The message text is fixed on the server,
// and is only sent when the learner's record really shows that institution
// as applied, so the endpoint can't be used to send arbitrary messages.
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, FieldPath } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAdminApp } from "./_lib/firebaseAdmin.js";
import { applicationLodgedMessage } from "./_lib/reminders.js";
import { sendToTokens, removeDeadTokens, assignTokenOwners, ownedTokens } from "./_lib/push.js";
import { isSuperAdmin } from "../src/utils/adminConfig.js";

const APP_URL = "https://mycoursefinder.web.app";
const ONE_WEEK = 7 * 24 * 60 * 60;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": APP_URL,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function isAdminCaller(db, decoded) {
  // The super-admin email only counts once Google/Firebase has verified it.
  if (decoded.email_verified && isSuperAdmin(decoded.email)) return true;
  const snap = await db.collection("users").doc(decoded.uid).get();
  return snap.exists && snap.data().isAdmin === true;
}

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const idToken = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1];
  if (!idToken) return res.status(401).json({ error: "Sign in as an admin first." });

  const { uid, institution } = req.body || {};
  if (typeof uid !== "string" || !uid || uid.length > 128 || typeof institution !== "string" || !institution || institution.length > 200) {
    return res.status(400).json({ error: "Invalid request — expected a uid and an institution." });
  }

  try {
    const app = getAdminApp();
    const db = getFirestore(app);

    let decoded;
    try {
      decoded = await getAuth(app).verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: "Your sign-in has expired. Refresh the page and try again." });
    }
    if (!(await isAdminCaller(db, decoded))) return res.status(403).json({ error: "Admins only." });

    const learnerRef = db.collection("users").doc(uid);
    const learnerSnap = await learnerRef.get();
    if (!learnerSnap.exists) return res.status(404).json({ error: "Learner not found." });
    const learner = learnerSnap.data();

    const progress = learner.applicationProgress?.[institution];
    if (!progress?.applied) return res.status(409).json({ error: `${institution} isn't marked as applied for this learner.` });
    // Unticking and re-ticking "applied" gives a new appliedAt; only notify once per tick.
    if (progress.notifiedAt && progress.appliedAt && progress.notifiedAt >= progress.appliedAt) {
      return res.status(200).json({ sent: 0, reason: "already-notified" });
    }

    let tokens = Array.isArray(learner.pushTokens) ? learner.pushTokens.filter((t) => typeof t === "string" && t) : [];
    if (tokens.length === 0) return res.status(200).json({ sent: 0, reason: "no-devices" });
    // Leave out tokens a later account on a shared phone has taken over.
    const sharing = await db.collection("users").where("pushTokens", "array-contains-any", tokens.slice(0, 30)).get();
    const owners = assignTokenOwners([
      { uid, ...learner },
      ...sharing.docs.filter((d) => d.id !== uid).map((d) => ({ uid: d.id, ...d.data() })),
    ]);
    tokens = ownedTokens({ uid, pushTokens: tokens.slice(0, 30) }, owners);
    if (tokens.length === 0) return res.status(200).json({ sent: 0, reason: "no-devices" });

    const result = await sendToTokens(getMessaging(app), tokens, applicationLodgedMessage(institution), ONE_WEEK);
    await removeDeadTokens(db, FieldValue, uid, result.deadTokens);
    if (result.sent > 0) {
      await learnerRef.update(new FieldPath("applicationProgress", institution, "notifiedAt"), new Date().toISOString());
    }
    return res.status(200).json({ sent: result.sent, failed: result.failed });
  } catch (err) {
    console.error("notify-application failed:", err);
    return res.status(500).json({ error: "Couldn't send the notification." });
  }
}
