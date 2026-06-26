import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import OnboardingModal from "../components/OnboardingModal";
import PricingModal from "../components/PricingModal";
import { isSuperAdmin, getRoleInfo } from "../utils/adminConfig";

export default function Home() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [plan, setPlan] = useState("free");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [adminRole, setAdminRole] = useState(null); // null | "super" | "admin" | "moderator"

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const name = user.displayName || user.email || "";
      setDisplayName(name.toUpperCase());

      try {
        // Super admin: always ensure Firestore doc has correct role
        if (isSuperAdmin(user.email)) {
          await setDoc(doc(db, "users", user.uid), {
            isAdmin: true,
            adminRole: "super",
            email: user.email,
          }, { merge: true });
          setAdminRole("super");
        }

        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setPlan(data.plan || "free");

          // Set admin role from Firestore (super admin already set above)
          if (!isSuperAdmin(user.email) && data.isAdmin === true) {
            setAdminRole(data.adminRole || "admin");
          }

          // Show onboarding for brand-new users
          if (data.newUser === true) {
            setShowOnboarding(true);
            await updateDoc(doc(db, "users", user.uid), { newUser: false });
          }
        }
      } catch (err) {
        console.error("Error loading user data:", err);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/");
  };

  const handlePlanSelected = (planId) => {
    setPlan(planId);
    setShowPricing(false);
  };

  const planLabel = {
    free: "Free Plan",
    ad_free: "Ad-Free ⭐",
    apply_for_me: "Apply For Me 🚀",
  }[plan] || "Free Plan";

  const roleInfo = adminRole ? getRoleInfo(adminRole) : null;

  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-gradient-to-br from-blue-100 to-purple-200 px-4">

      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
      {showPricing && (
        <PricingModal onClose={() => setShowPricing(false)} onSelect={handlePlanSelected} />
      )}

      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-purple-600 rounded-full shadow-lg">
          <span className="text-3xl">🎓</span>
        </div>

        <h1 className="text-4xl font-extrabold text-purple-700 mb-3">Find Your Future</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Finding courses has never been easier! Enter your marks and let us help you discover the best options for your future.
        </p>

        <button onClick={() => navigate("/enter-marks")}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold shadow-md transition-all mb-4">
          Enter marks manually
        </button>

        <button onClick={() => navigate("/exam-number")}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black py-3 rounded-xl font-semibold shadow-md transition-all mb-6">
          Use Examination Number
        </button>

        {/* Admin button — visible to anyone with isAdmin: true in Firestore */}
        {adminRole && (
          <button onClick={() => navigate("/admin")}
            className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 py-2.5 rounded-xl font-semibold text-sm transition-all mb-4 flex items-center justify-center gap-2">
            <span>{roleInfo?.badge}</span>
            <span className={roleInfo?.color}>{roleInfo?.label} Panel</span>
          </button>
        )}

        {/* Plan + upgrade */}
        <div className="border-t pt-5 flex items-center justify-between">
          <div className="text-left">
            <p className="text-xs text-gray-400">Current plan</p>
            <p className="text-sm font-semibold text-purple-700">{planLabel}</p>
          </div>
          {plan === "free" ? (
            <button onClick={() => setShowPricing(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition">
              Upgrade →
            </button>
          ) : (
            <span className="text-green-600 text-xs font-medium bg-green-50 px-3 py-1 rounded-full">Active</span>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-gray-600 font-medium text-sm">{displayName}</span>
        <button onClick={handleSignOut}
          className="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-purple-700 transition">
          Sign Out
        </button>
      </div>
    </div>
  );
}