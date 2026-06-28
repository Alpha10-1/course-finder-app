import { useEffect, useState } from "react";
import { onAuthStateChanged, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function RequireAuth({ children }) {
  const [status, setStatus] = useState("loading"); // loading | verified | unverified | unauthenticated
  const [user, setUser] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState(""); // "" | "sent" | "error"
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setStatus("unauthenticated");
        navigate("/");
        return;
      }

      setUser(currentUser);

      // Phone auth users have no email — always let them through
      const isPhoneUser = currentUser.providerData.some(
        (p) => p.providerId === "phone"
      );

      if (isPhoneUser || currentUser.emailVerified) {
        setStatus("verified");
      } else {
        setStatus("unverified");
      }
    });
    return () => unsub();
  }, [navigate]);

  const startCooldown = () => {
    setResendCooldown(60);
    const t = setInterval(() => {
      setResendCooldown((n) => {
        if (n <= 1) { clearInterval(t); return 0; }
        return n - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !user) return;
    try {
      await sendEmailVerification(user);
      setResendStatus("sent");
      startCooldown();
    } catch {
      setResendStatus("error");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/");
  };

  const handleRefresh = () => {
    // Reload page so onAuthStateChanged re-fires with fresh emailVerified state
    window.location.reload();
  };

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
      <p className="text-gray-500">Loading…</p>
    </div>
  );

  if (status === "unverified") return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center space-y-5">
        <div className="text-5xl">📧</div>
        <h1 className="text-xl font-bold text-gray-900">Verify your email</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          We sent a verification link to{" "}
          <span className="font-semibold text-gray-800">{user?.email}</span>.
          Please click the link in that email to continue.
        </p>

        {resendStatus === "sent" && (
          <p className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl px-3 py-2">
            ✓ Verification email resent. Check your inbox and spam folder.
          </p>
        )}
        {resendStatus === "error" && (
          <p className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2">
            Failed to resend. Please try again.
          </p>
        )}

        {/* Once they've clicked the link in their email, they reload here */}
        <button onClick={handleRefresh}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition">
          I've verified — continue
        </button>

        <button
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="w-full border border-gray-200 hover:bg-gray-50 text-gray-600 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          {resendCooldown > 0
            ? `Resend in ${resendCooldown}s`
            : "Resend verification email"}
        </button>

        <button onClick={handleSignOut}
          className="text-xs text-gray-400 hover:text-gray-600 transition">
          Sign out
        </button>
      </div>
    </div>
  );

  return status === "verified" ? children : null;
}