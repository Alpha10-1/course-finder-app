// Run this ONCE after deploying to Vercel:
// node register-webhook.js

const YOCO_SECRET_KEY = "sk_live_5f057dca7me1L1k75d04f02bb8de";     // your regenerated secret key
const WEBHOOK_URL     = "https://course-finder-app-zeta.vercel.app/api/yoco-webhook"; // your Vercel URL

async function register() {
  console.log("Checking existing webhooks...");

  // First list existing webhooks
  const listRes = await fetch("https://payments.yoco.com/api/webhooks", {
    headers: { Authorization: `Bearer ${YOCO_SECRET_KEY}` },
  });
  const list = await listRes.json();
  console.log("Existing webhooks:", JSON.stringify(list, null, 2));

  const alreadyExists = (list.subscriptions || []).find((s) => s.url === WEBHOOK_URL);
  if (alreadyExists) {
    console.log("✅ Webhook already registered:", alreadyExists);
    return;
  }

  console.log("\nRegistering webhook...");
  const createRes = await fetch("https://payments.yoco.com/api/webhooks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${YOCO_SECRET_KEY}`,
    },
    body: JSON.stringify({
      name: "course-finder-webhook",
      url:  WEBHOOK_URL,
    }),
  });

  const data = await createRes.json();

  if (!createRes.ok) {
    console.error("❌ Failed to register webhook:", JSON.stringify(data, null, 2));
    return;
  }

  console.log("\n✅ Webhook registered successfully!");
  console.log(JSON.stringify(data, null, 2));
  console.log("\n⚠️  IMPORTANT NEXT STEPS:");
  console.log("1. Copy the 'secret' value from above");
  console.log("2. Go to Vercel → your project → Settings → Environment Variables");
  console.log("3. Add: YOCO_WEBHOOK_SECRET = <the secret value>");
  console.log("4. Redeploy on Vercel (it redeploys automatically on env var change)");
}

register().catch(console.error);