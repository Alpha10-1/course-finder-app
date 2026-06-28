// Vercel Serverless Function — api/yoco-webhook.js
// Yoco POSTs here when payment succeeds
// Verifies the signature then upgrades the user's plan in Firestore

import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const YOCO_WEBHOOK_SECRET    = process.env.YOCO_WEBHOOK_SECRET;
const FIREBASE_PROJECT_ID    = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL  = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY   = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

// Initialise Firebase Admin (reuse across warm invocations)
function getDB() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey:  FIREBASE_PRIVATE_KEY,
      }),
    });
  }
  return getFirestore();
}

// Verify Yoco webhook signature
// Format: HMAC-SHA256( webhookId + "." + timestamp + "." + rawBody ) → base64
function verifySignature(rawBody, headers) {
  if (!YOCO_WEBHOOK_SECRET) return true; // skip if not configured yet

  const id        = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const sigHeader = headers["webhook-signature"] || "";

  if (!id || !timestamp || !sigHeader) return false;

  // Reject replays older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const expected = crypto
    .createHmac("sha256", YOCO_WEBHOOK_SECRET)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  return sigHeader.split(" ").some((s) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(s.replace(/^v1,/, ""), "base64"),
        Buffer.from(expected, "base64")
      );
    } catch { return false; }
  });
}

export const config = {
  api: { bodyParser: false }, // need raw body for signature verification
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end",  () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const rawBody = await getRawBody(req);
  const event   = JSON.parse(rawBody);

  // Verify the request is genuinely from Yoco
  if (!verifySignature(rawBody, req.headers)) {
    console.error("Webhook signature verification failed");
    return res.status(401).send("Unauthorized");
  }

  console.log(`Yoco event: ${event.type}`);

  // Only act on successful payments
  if (event.type !== "payment.succeeded") {
    return res.status(200).send("OK");
  }

  const { uid, planId } = event.payload?.metadata || {};

  if (!uid || !planId) {
    console.error("Missing uid or planId in metadata");
    return res.status(400).send("Missing metadata");
  }

  try {
    const db = getDB();
    await db.collection("users").doc(uid).update({
      plan:       planId,
      paidAt:     new Date().toISOString(),
      paymentId:  event.id,
      amountPaid: ((event.payload?.amount ?? 0) / 100).toFixed(2),
    });
    console.log(`✓ Plan upgraded | uid=${uid} | plan=${planId}`);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("Firestore update failed:", err);
    return res.status(500).send("Database error");
  }
}