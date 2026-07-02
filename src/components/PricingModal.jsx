import { useState } from "react";
import { auth } from "../firebase";

// Your Vercel deployment URL — update after deploying to Vercel
const API_BASE = "https://course-finder-app-zeta.vercel.app";

// Final price — must stay in sync with the `amount` in api/create-checkout.js / functions/index.js
const APPLY_FOR_ME_PRICE = "R100";

export default function PricingModal({ onClose }) {
  const [step,    setStep]    = useState("main"); // main | confirm | loading | awaiting | error
  const [errMsg,  setErrMsg]  = useState("");

  const handlePay = async () => {
    const user = auth.currentUser;
    if (!user) { setErrMsg("You must be signed in."); return; }

    setStep("loading");

    try {
      console.log("[Payment] Calling:", `${API_BASE}/api/create-checkout`);
      const res = await fetch(`${API_BASE}/api/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid:       user.uid,
          planId:    "apply_for_me",
          userEmail: user.email || "",
        }),
      });

      console.log("[Payment] Response status:", res.status);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("[Payment] Error response:", data);
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      console.log("[Payment] Success, redirecting to:", data.redirectUrl);
      window.location.href = data.redirectUrl;
    } catch (err) {
      console.error("[Payment] Caught error:", err.message);
      setErrMsg(err.message || "Payment could not be started. Please try again.");
      setStep("error");
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (step === "loading") return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
        <p className="text-gray-600 font-medium">Redirecting to payment…</p>
      </div>
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────
  if (step === "error") return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-800 font-semibold">Something went wrong</p>
        <p className="text-red-500 text-sm">{errMsg}</p>
        <button onClick={() => setStep("confirm")}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition">
          Try Again
        </button>
        <button onClick={onClose} className="w-full text-gray-400 text-sm hover:text-gray-600 transition">
          Cancel
        </button>
      </div>
    </div>
  );

  // ── Confirm ──────────────────────────────────────────────────────────────
  if (step === "confirm") return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center space-y-5">
        <div className="text-5xl">🚀</div>
        <h2 className="text-xl font-bold text-gray-900">Apply For Me — {APPLY_FOR_ME_PRICE}</h2>
        <ul className="text-left space-y-2">
          {[
            "We apply to up to 6 institutions on your behalf",
            "Application tracking",
            "Priority support",
            "Everything else stays free",
          ].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-green-500 shrink-0">✓</span> {f}
            </li>
          ))}
        </ul>
        <button onClick={handlePay}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition">
          Pay {APPLY_FOR_ME_PRICE} with Yoco →
        </button>
        <button onClick={() => setStep("main")} className="w-full text-gray-400 text-sm hover:text-gray-600 transition">
          ← Back
        </button>
      </div>
    </div>
  );

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        <div className="bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-5 text-center">
          <h2 className="text-white text-xl font-bold">Apply For Me</h2>
          <p className="text-white/70 text-sm mt-1">Let us handle your university applications</p>
        </div>

        <div className="p-6 space-y-4">

          {/* Free */}
          <div className="bg-gray-50 rounded-xl p-4 flex gap-3 items-center">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Free — Always included</p>
              <p className="text-gray-500 text-xs">Browse all qualifying courses with no ads</p>
            </div>
          </div>

          {/* Apply For Me */}
          <div className="border-2 border-purple-400 rounded-2xl overflow-hidden">
            <div className="bg-purple-600 text-white text-xs font-bold text-center py-1.5 tracking-widest">
              PREMIUM
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🚀</span>
                  <div>
                    <p className="font-bold text-gray-900">Apply For Me</p>
                    <p className="text-gray-400 text-xs">once-off</p>
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-purple-700">{APPLY_FOR_ME_PRICE}</p>
              </div>

              <ul className="space-y-2 mb-5">
                {[
                  "We apply to up to 6 institutions on your behalf",
                  "Application tracking",
                  "Priority support",
                  "Everything else stays free",
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>

              <button onClick={() => setStep("confirm")}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 rounded-xl font-semibold hover:opacity-90 transition">
                Get Apply For Me — {APPLY_FOR_ME_PRICE}
              </button>
            </div>
          </div>

          {/* Yoco badge */}
          <div className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"
                fill="currentColor" opacity=".2" className="text-gray-400"/>
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"
                stroke="currentColor" strokeWidth="1.5" className="text-gray-400"/>
            </svg>
            <p className="text-xs text-gray-400">Payments secured by <span className="font-semibold">Yoco</span></p>
          </div>

          <button onClick={onClose} className="w-full text-gray-400 text-sm hover:text-gray-600 transition py-1">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}