import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const PLAN_LABELS = {
  ad_free:      { name: "Ad-Free",      icon: "⭐" },
  apply_for_me: { name: "Apply For Me", icon: "🚀" },
};

export default function PaymentSuccess() {
  const [status,  setStatus]  = useState("upgrading"); // upgrading | done | error
  const [planId,  setPlanId]  = useState("");
  const [searchParams]        = useSearchParams();
  const navigate              = useNavigate();

  useEffect(() => {
    const uid    = searchParams.get("uid");
    const plan   = searchParams.get("plan");

    if (!uid || !plan) {
      setStatus("error");
      return;
    }

    setPlanId(plan);

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user || user.uid !== uid) {
        // User not signed in or uid mismatch — redirect to sign in
        navigate("/signin");
        return;
      }

      try {
        await updateDoc(doc(db, "users", uid), {
          plan,
          paidAt: new Date().toISOString(),
        });
        setStatus("done");
      } catch (err) {
        console.error("Plan upgrade error:", err);
        setStatus("error");
      }
    });

    return () => unsub();
  }, [navigate, searchParams]);

  const plan = PLAN_LABELS[planId];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-5">

        {status === "upgrading" && (
          <>
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto" />
            <h1 className="text-xl font-bold text-gray-900">Activating your plan…</h1>
            <p className="text-gray-400 text-sm">Just a moment.</p>
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
              Your payment may have gone through but we couldn't update your account.
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