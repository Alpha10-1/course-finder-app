import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const PLAN_LABELS = {
  ad_free:      { name: "Ad-Free",      icon: "⭐" },
  apply_for_me: { name: "Apply For Me", icon: "🚀" },
};

// How long to wait for the signature-verified webhook to land before telling
// the user activation is taking longer than usual. The webhook is normally
// near-instant, but Yoco can occasionally take a little while to deliver it.
const WEBHOOK_TIMEOUT_MS = 45000;

export default function PaymentSuccess() {
  const [status,  setStatus]  = useState("upgrading"); // upgrading | done | pending | error
  const [planId,  setPlanId]  = useState("");
  const [searchParams]        = useSearchParams();
  const navigate              = useNavigate();
  const uidRef                = useRef(null);

  const checkNow = async () => {
    const uid = uidRef.current;
    if (!uid || !planId) return;
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists() && snap.data().plan === planId) {
        setStatus("done");
      } else {
        setStatus("pending");
      }
    } catch {
      setStatus("pending");
    }
  };

  useEffect(() => {
    const uid  = searchParams.get("uid");
    const plan = searchParams.get("plan");

    if (!uid || !plan) {
      setStatus("error");
      return;
    }

    uidRef.current = uid;
    setPlanId(plan);

    let unsubSnapshot = null;
    let timeoutId      = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user || user.uid !== uid) {
        // User not signed in or uid mismatch — redirect to sign in
        navigate("/signin");
        return;
      }

      // IMPORTANT: we never write `plan` ourselves here. Access is only ever
      // granted by the signature-verified Yoco webhook (api/yoco-webhook.js /
      // functions/index.js), which updates this same Firestore doc once it
      // has confirmed the payment is genuine. We just listen for that write —
      // trusting the redirect's query params alone would let anyone unlock
      // the paid feature without actually paying.
      unsubSnapshot = onSnapshot(doc(db, "users", uid), (snap) => {
        if (snap.exists() && snap.data().plan === plan) {
          setStatus("done");
          if (timeoutId) clearTimeout(timeoutId);
        }
      });

      timeoutId = setTimeout(() => {
        setStatus((s) => (s === "done" ? s : "pending"));
      }, WEBHOOK_TIMEOUT_MS);
    });

    return () => {
      unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [navigate, searchParams]);

  const plan = PLAN_LABELS[planId];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-5">

        {status === "upgrading" && (
          <>
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
            <h1 className="text-xl font-bold text-gray-900">Confirming your payment…</h1>
            <p className="text-gray-400 text-sm">We're verifying with Yoco — this only takes a moment.</p>
          </>
        )}

        {status === "pending" && (
          <>
            <div className="text-5xl">⏳</div>
            <h1 className="text-xl font-bold text-gray-900">Still confirming…</h1>
            <p className="text-gray-500 text-sm">
              Your payment may have gone through, but confirmation is taking longer than usual.
              This can happen if Yoco is briefly delayed — it should resolve on its own.
            </p>
            <button
              onClick={checkNow}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition"
            >
              Check again
            </button>
            <button
              onClick={() => navigate("/home")}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition"
            >
              I'll check back later
            </button>
          </>
        )}

        {status === "done" && (
          <>
            <div className="text-5xl">{plan?.icon || "🎉"}</div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-purple-700 font-semibold">
                {plan?.name || "Premium"} unlocked
              </p>
              <p className="text-purple-500 text-xs mt-1">
                Your account has been upgraded. All features are now active.
              </p>
            </div>
            <button
              onClick={() => navigate("/home")}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition"
            >
              Go to App →
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
            <p className="text-gray-500 text-sm">
              Your payment may have gone through but we couldn't confirm your account update.
              Please contact support with your email and we'll sort it out.
            </p>
            <button
              onClick={() => navigate("/home")}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-semibold transition"
            >
              Go to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}