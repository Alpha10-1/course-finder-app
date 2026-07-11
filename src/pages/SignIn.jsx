import { useState } from "react";
import { auth, googleProvider, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo";

async function ensureFirestoreDoc(user) {
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const parts = (user.displayName || "").split(" ");
      await setDoc(ref, {
        uid: user.uid,
        email: user.email || "",
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
        dob: "",
        plan: "free",
        createdAt: new Date().toISOString(),
        newUser: false,
        lastActivityAt: new Date().toISOString(),
      });
    } else {
      await setDoc(ref, {
        email: user.email || snap.data().email || "",
        lastLoginAt: new Date().toISOString(),
        // Kept alongside (not instead of) lastLoginAt: EnterMarks.jsx also
        // stamps this field, so "most recent activity" can reflect either
        // logging in OR entering marks, whichever happened more recently —
        // a genuinely different signal from "most recent login" alone.
        lastActivityAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (err) {
    console.error("Firestore sync error:", err);
  }
}

function friendlyError(code) {
  const map = {
    "auth/user-not-found":        "No account found with this email.",
    "auth/wrong-password":        "Incorrect password. Try again.",
    "auth/invalid-credential":    "Incorrect email or password.",
    "auth/invalid-email":         "Please enter a valid email address.",
    "auth/too-many-requests":     "Too many attempts. Please wait a moment.",
    "auth/network-request-failed":"Network error. Check your connection.",
    "auth/popup-closed-by-user":  "Google sign-in was cancelled.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

const inputCls = "w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800";

export default function SignIn() {
  const [email,              setEmail]              = useState("");
  const [password,           setPassword]           = useState("");
  const [phone,              setPhone]              = useState("");
  const [otp,                setOtp]                = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [error,              setError]              = useState("");
  const [loading,            setLoading]            = useState(false);

  // Forgot password state
  const [showForgot,        setShowForgot]        = useState(false);
  const [forgotEmail,       setForgotEmail]       = useState("");
  const [forgotStatus,      setForgotStatus]      = useState(""); // "" | "sent" | "error"
  const [forgotLoading,     setForgotLoading]     = useState(false);

  const navigate = useNavigate();

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureFirestoreDoc(cred.user);
      navigate("/home");
    } catch (err) {
      setError(friendlyError(err.code));
    } finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setError(""); setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureFirestoreDoc(cred.user);
      navigate("/home");
    } catch (err) {
      setError(friendlyError(err.code));
    } finally { setLoading(false); }
  };

  const handleSendOtp = async () => {
    setError(""); setLoading(true);
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth, "recaptcha-container", { size: "invisible" }
        );
      }
      const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(result);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    setError(""); setLoading(true);
    try {
      const cred = await confirmationResult.confirm(otp);
      await ensureFirestoreDoc(cred.user);
      navigate("/home");
    } catch (err) {
      setError(friendlyError(err.code));
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true); setForgotStatus("");
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotStatus("sent");
    } catch (err) {
      setForgotStatus("error");
    } finally { setForgotLoading(false); }
  };

  // ── Forgot password overlay ──────────────────────────────────────────────
  if (showForgot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 p-6">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-2">🔑</div>
            <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-gray-400 text-sm mt-1">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          {forgotStatus === "sent" ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-green-700 font-semibold text-sm">✓ Reset email sent!</p>
                <p className="text-green-600 text-xs mt-1">
                  Check your inbox at <span className="font-medium">{forgotEmail}</span> and follow the link to reset your password.
                </p>
              </div>
              <button
                onClick={() => { setShowForgot(false); setForgotStatus(""); setForgotEmail(""); }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {forgotStatus === "error" && (
                <p className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2">
                  No account found with that email address.
                </p>
              )}
              <input
                type="email"
                placeholder="Your email address"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className={inputCls}
              />
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-60"
              >
                {forgotLoading ? "Sending…" : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForgot(false); setForgotStatus(""); }}
                className="w-full text-gray-400 hover:text-gray-600 text-sm transition"
              >
                ← Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Main sign-in form ────────────────────────────────────────────────────
  return (
    <>
      <Seo
        title="Sign In"
        path="/signin"
        description="Sign in to Course Finder to view the university and college courses you qualify for based on your marks."
      />
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl space-y-5">
        <h1 className="text-3xl font-bold text-center text-gray-900">Sign In</h1>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        {/* Email sign-in */}
        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <input type="email" placeholder="Email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          <input type="password" placeholder="Password" required value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputCls} />

          {/* Forgot password link */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => { setShowForgot(true); setForgotEmail(email); }}
              className="text-sm text-purple-600 hover:text-purple-800 hover:underline transition"
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition disabled:opacity-60">
            {loading ? "Signing in…" : "Sign in with Email"}
          </button>
        </form>

        <div className="text-center text-gray-400 text-sm font-medium">OR</div>

        {/* Google sign-in */}
        <button onClick={handleGoogleSignIn} disabled={loading}
          className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition disabled:opacity-60">
          Sign in with Google
        </button>

        <div className="text-center text-gray-400 text-sm font-medium">OR</div>

        {/* Phone sign-in */}
        <div className="space-y-3">
          <input type="tel" placeholder="Phone (e.g. +27123456789)" value={phone}
            onChange={(e) => setPhone(e.target.value)} className={inputCls} />

          {!confirmationResult ? (
            <button onClick={handleSendOtp} disabled={loading || !phone}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-60">
              {loading ? "Sending…" : "Send OTP"}
            </button>
          ) : (
            <>
              <p className="text-xs text-green-600 text-center">✓ OTP sent to {phone}</p>
              <input type="text" placeholder="Enter OTP" value={otp}
                onChange={(e) => setOtp(e.target.value)} className={inputCls} />
              <button onClick={handleVerifyOtp} disabled={loading || !otp}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60">
                {loading ? "Verifying…" : "Verify OTP & Sign In"}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">
          Don't have an account?{" "}
          <button onClick={() => navigate("/signup")} className="text-purple-600 hover:underline font-medium">
            Sign up
          </button>
        </p>

        <div id="recaptcha-container"></div>
      </div>
    </div>
    </>
  );
}