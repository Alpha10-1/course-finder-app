import { useState } from "react";
import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

const PLANS = [
  {
    id: "ad_free",
    icon: "⭐",
    name: "Ad-Free",
    price: "R30",
    period: "once-off",
    color: "from-blue-500 to-purple-500",
    features: [
      "View all qualifying courses instantly",
      "No ads — ever",
      "Filter by faculty, institution & qualification",
      "Save your results",
    ],
  },
  {
    id: "apply_for_me",
    icon: "🚀",
    name: "Apply For Me",
    price: "R150",
    period: "once-off",
    color: "from-purple-600 to-pink-500",
    badge: "Best Value",
    features: [
      "Everything in Ad-Free",
      "We apply to up to 6 institutions on your behalf",
      "Application tracking",
      "Priority support",
    ],
  },
];

export default function PricingModal({ onClose, onSelect }) {
  const [loading, setLoading] = useState(null);

  const handleSelect = async (planId) => {
    setLoading(planId);
    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, "users", user.uid), { plan: planId });
      }
      onSelect(planId);
    } catch (err) {
      console.error("Plan update error:", err);
      onSelect(planId); // still proceed even if Firestore write fails
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-500 px-6 py-5 text-center">
          <h2 className="text-white text-xl font-bold">Upgrade Your Plan</h2>
          <p className="text-white/70 text-sm mt-1">Unlock the full Course Finder experience</p>
        </div>

        <div className="p-6 space-y-4">

          {/* Free tier reminder */}
          <div className="bg-gray-50 rounded-xl p-4 flex gap-3 items-center">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-gray-800 text-sm">Free — Always included</p>
              <p className="text-gray-500 text-xs">Check if you qualify + watch ads to unlock 3 courses at a time</p>
            </div>
          </div>

          {/* Paid plans */}
          {PLANS.map((plan) => (
            <div key={plan.id} className="border-2 border-purple-100 rounded-2xl overflow-hidden hover:border-purple-400 transition">
              {plan.badge && (
                <div className="bg-purple-600 text-white text-xs font-bold text-center py-1 tracking-widest">
                  {plan.badge.toUpperCase()}
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{plan.icon}</span>
                    <div>
                      <p className="font-bold text-gray-900">{plan.name}</p>
                      <p className="text-gray-400 text-xs">{plan.period}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-purple-700">{plan.price}</p>
                  </div>
                </div>

                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span> {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(plan.id)}
                  disabled={!!loading}
                  className={`w-full bg-gradient-to-r ${plan.color} text-white py-3 rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50`}
                >
                  {loading === plan.id ? "Processing…" : `Get ${plan.name} — ${plan.price}`}
                </button>
              </div>
            </div>
          ))}

          {/* Stay free */}
          <button onClick={onClose}
            className="w-full text-gray-400 text-sm hover:text-gray-600 transition py-2">
            Continue with Free plan
          </button>
        </div>
      </div>
    </div>
  );
}