import { useState } from "react";
import { auth, googleProvider, db } from "../firebase";
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

async function saveUserProfile(user, { firstName, lastName, dob, email }) {
  await updateProfile(user, { displayName: `${firstName} ${lastName}` });
  await setDoc(doc(db, "users", user.uid), {
    firstName,
    lastName,
    dob,
    email: email || user.email,
    plan: "free",
    createdAt: new Date().toISOString(),
    newUser: true,
  }, { merge: true });
}

async function isNewUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return !snap.exists() || snap.data().newUser === true;
}

const inputClass =
  "w-full p-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-800 placeholder-gray-400";

export default function SignUp() {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [dob,       setDob]       = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const navigate = useNavigate();

  /* ── Email sign-up: collect everything at once ── */
  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    if (!dob) { setError("Please select your date of birth."); return; }
    setError(""); setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await saveUserProfile(cred.user, { firstName, lastName, dob, email });
      navigate("/home");
    } catch (err) {
      setError(friendlyError(err.code));
    } finally { setLoading(false); }
  };

  /* ── Google sign-up: auto-fill from Google, ask for DOB only if new ── */
  const handleGoogleSignUp = async () => {
    setError(""); setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const fresh = await isNewUser(cred.user.uid);
      if (fresh) {
        const parts = (cred.user.displayName || "").split(" ");
        await saveUserProfile(cred.user, {
          firstName: parts[0] || "",
          lastName:  parts.slice(1).join(" ") || "",
          dob:       "",          // Google doesn't provide DOB
          email:     cred.user.email || "",
        });
      }
      navigate("/home");
    } catch (err) {
      setError(friendlyError(err.code));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 space-y-5">

        <div className="text-center">
          <h1 className="text-2xl font-bold text-blue-700">Create Account</h1>
          <p className="text-gray-400 text-sm mt-1">Sign up to start finding your future</p>
        </div>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        {/* Email sign-up form */}
        <form onSubmit={handleEmailSignUp} className="space-y-3">
          <div className="flex gap-3">
            <input type="text" placeholder="First name" required value={firstName}
              onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            <input type="text" placeholder="Last name" required value={lastName}
              onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1 ml-1">Date of Birth</label>
            <input type="date" required value={dob}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setDob(e.target.value)}
              className={inputClass} />
          </div>

          <input type="email" placeholder="Email address" required value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputClass} />

          <input type="password" placeholder="Password (min 6 characters)" required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)} className={inputClass} />

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-60">
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-gray-400 text-xs">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Google */}
        <button onClick={handleGoogleSignUp} disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-medium transition disabled:opacity-60">
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="text-center text-xs text-gray-400">
          Already have an account?{" "}
          <button onClick={() => navigate("/signin")} className="text-blue-600 hover:underline font-medium">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Please check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}