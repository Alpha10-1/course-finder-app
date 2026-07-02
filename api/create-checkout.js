const YOCO_SECRET_KEY = process.env.YOCO_SECRET_KEY;
const APP_URL         = "https://mycoursefinder.web.app";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  APP_URL,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PLAN_CONFIG = {
  apply_for_me: { amount: 1000, name: "Course Finder – Apply For Me" }, // TEMP: R10 for Yoco testing — was 15000 (R150)
};

export default async function handler(req, res) {
  // Set CORS on every response
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Handle OPTIONS preflight — must return 200 with no body
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!YOCO_SECRET_KEY) {
    console.error("YOCO_SECRET_KEY not configured");
    return res.status(500).json({ error: "Payment not configured on server." });
  }

  const { uid, planId, userEmail } = req.body || {};
  const plan = PLAN_CONFIG[planId];

  if (!uid || !plan) {
    return res.status(400).json({ error: "Invalid request — missing uid or planId." });
  }

  try {
    const yocoRes = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${YOCO_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount:     plan.amount,
        currency:   "ZAR",
        successUrl: `${APP_URL}/payment-success?uid=${uid}&plan=${planId}`,
        cancelUrl:  `${APP_URL}/home`,
        failureUrl: `${APP_URL}/home?payment=failed`,
        metadata:   { uid, planId, userEmail: userEmail || "" },
      }),
    });

    const data = await yocoRes.json();

    if (!yocoRes.ok) {
      console.error("Yoco API error:", JSON.stringify(data));
      return res.status(502).json({ error: data.message || "Payment provider error." });
    }

    return res.status(200).json({ redirectUrl: data.redirectUrl });
  } catch (err) {
    console.error("create-checkout exception:", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }
}