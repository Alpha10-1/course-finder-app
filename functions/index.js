const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();

const APP_URL = "https://mycoursefinder.web.app";

const PLAN_CONFIG = {
  ad_free:      { amount: 3000,  name: "Course Finder – Ad-Free"      },
  apply_for_me: { amount: 10000,  name: "Course Finder – Apply For Me" },
};

// ── Verify Yoco webhook signature ─────────────────────────────────────────────
// Yoco signs: HMAC-SHA256( webhookId + "." + timestamp + "." + rawBody )
// then base64 encodes. Header format: "v1,<base64sig>"
function verifyYocoSignature(rawBody, headers, secret) {
  const id        = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const sigHeader = headers["webhook-signature"] || "";

  if (!id || !timestamp || !sigHeader) return false;

  // Reject replays older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    console.warn("Webhook timestamp too old");
    return false;
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expectedSig   = crypto
    .createHmac("sha256", secret)
    .update(signedContent)
    .digest("base64");

  return sigHeader.split(" ").some((s) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(s.replace(/^v1,/, ""), "base64"),
        Buffer.from(expectedSig,           "base64")
      );
    } catch { return false; }
  });
}

// ── 1. Create Yoco checkout ───────────────────────────────────────────────────
exports.createYocoCheckout = onRequest(
  { cors: [APP_URL] },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const YOCO_SECRET_KEY     = process.env.YOCO_SECRET_KEY;
    const YOCO_WEBHOOK_SECRET = process.env.YOCO_WEBHOOK_SECRET;

    if (!YOCO_SECRET_KEY) {
      console.error("YOCO_SECRET_KEY not set in .env");
      res.status(500).json({ error: "Payment not configured" });
      return;
    }

    const { uid, planId } = req.body;
    const plan = PLAN_CONFIG[planId];

    if (!uid || !plan) {
      res.status(400).json({ error: "Invalid uid or planId" });
      return;
    }

    const checksum = crypto
      .createHmac("sha256", YOCO_WEBHOOK_SECRET || "no-secret")
      .update(`${uid}:${planId}`)
      .digest("hex");

    try {
      const yocoRes = await fetch("https://payments.yoco.com/api/checkouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${YOCO_SECRET_KEY}`,
        },
        body: JSON.stringify({
          amount:     plan.amount,
          currency:   "ZAR",
          successUrl: `${APP_URL}/payment-success?uid=${uid}&plan=${planId}`,
          cancelUrl:  `${APP_URL}/home`,
          failureUrl: `${APP_URL}/home?payment=failed`,
          metadata:   { uid, planId, checksum },
        }),
      });

      if (!yocoRes.ok) {
        const err = await yocoRes.text();
        console.error("Yoco API error:", err);
        res.status(502).json({ error: "Payment provider error. Please try again." });
        return;
      }

      const data = await yocoRes.json();
      res.status(200).json({ redirectUrl: data.redirectUrl });
    } catch (err) {
      console.error("createYocoCheckout error:", err);
      res.status(500).json({ error: "Internal error" });
    }
  }
);

// ── 2. Yoco webhook receiver ──────────────────────────────────────────────────
exports.yocoWebhook = onRequest(
  { cors: false },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

    const YOCO_WEBHOOK_SECRET = process.env.YOCO_WEBHOOK_SECRET;
    const rawBody = req.rawBody?.toString() || JSON.stringify(req.body);

    // Verify signature if secret is configured
    if (YOCO_WEBHOOK_SECRET) {
      if (!verifyYocoSignature(rawBody, req.headers, YOCO_WEBHOOK_SECRET)) {
        console.error("Webhook signature invalid");
        res.status(401).send("Unauthorized");
        return;
      }
    }

    const event = req.body;
    console.log(`Yoco event received: ${event.type}`);

    // Only process successful payments
    if (event.type !== "payment.succeeded") {
      res.status(200).send("OK");
      return;
    }

    const { uid, planId, checksum } = event.payload?.metadata || {};

    if (!uid || !planId) {
      console.error("Missing uid/planId in webhook metadata");
      res.status(400).send("Missing metadata");
      return;
    }

    // Verify our checksum to prevent metadata tampering
    if (YOCO_WEBHOOK_SECRET) {
      const expected = crypto
        .createHmac("sha256", YOCO_WEBHOOK_SECRET)
        .update(`${uid}:${planId}`)
        .digest("hex");
      try {
        if (!crypto.timingSafeEqual(
          Buffer.from(checksum || "", "hex"),
          Buffer.from(expected,       "hex")
        )) {
          console.error("Metadata checksum mismatch");
          res.status(400).send("Invalid checksum");
          return;
        }
      } catch {
        res.status(400).send("Invalid checksum format");
        return;
      }
    }

    if (!PLAN_CONFIG[planId]) {
      res.status(400).send("Unknown plan");
      return;
    }

    try {
      await db.collection("users").doc(uid).update({
        plan:       planId,
        paidAt:     new Date().toISOString(),
        paymentId:  event.id,
        amountPaid: ((event.payload?.amount ?? 0) / 100).toFixed(2),
      });
      console.log(`✓ Upgraded | uid=${uid} | plan=${planId}`);
      res.status(200).send("OK");
    } catch (err) {
      console.error("Firestore update failed:", err);
      res.status(500).send("Database error");
    }
  }
);