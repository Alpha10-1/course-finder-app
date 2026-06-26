import { useState } from "react";
import { auth, googleProvider, db } from "../firebase";
import { createUserWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

async function saveUserProfile(user, { firstName, lastName, dob }) {
  await updateProfile(user, { displayName: `${firstName} ${lastName}` });
  await setDoc(doc(db, "users", user.uid), {
    firstName,
    lastName,
    dob,
    email: user.email,
    plan: "free",
    createdAt: new Date().toISOString(),
    newUser: true,
  }, { merge: true });
}

async function isNewUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return !snap.exists() || snap.data().newUser === true;
}

export default function SignUp() {
  const [step, setStep] = useState(1); // 1 = credentials, 2 = profile
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [dob, setDob]             = useState("");
  const [pendingUser, setPendingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const navigate = useNavigate();

  /* ── Step 1: email/password ── */
  const handleEmailNext = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      setPendingUser(cred.user);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  /* ── Step 1: Google ── */
  const handleGoogleSignUp = async () => {
    setError(""); setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const fresh = await isNewUser(cred.user.uid);
      if (fresh) {
        // Pre-fill name from Google
        const parts = (cred.user.displayName || "").split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
        setPendingUser(cred.user);
        setStep(2);
      } else {
        navigate("/home");
      }
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  /* ── Step 2: save profile ── */
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!dob) { setError("Please select your date of birth."); return; }
    setError(""); setLoading(true);
    try {
      await saveUserProfile(pendingUser, { firstName, lastName, dob });
      navigate("/home");
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4">

      {step === 1 && (
        <>
          <h1 className="text-2xl font-bold mb-6 text-blue-700">Sign Up</h1>
          {error && <p className="text-red-500 text-sm mb-3 w-72">{error}</p>}

          <form onSubmit={handleEmailNext} className="flex flex-col space-y-4 w-72">
            <input type="email" placeholder="Email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="p-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <input type="password" placeholder="Password (min 6 chars)" required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="p-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <button type="submit" disabled={loading}
              className="bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-60">
              {loading ? "Creating account…" : "Continue →"}
            </button>
          </form>

          <p className="mt-4 text-gray-500 text-sm">or</p>
          <button onClick={handleGoogleSignUp} disabled={loading}
            className="mt-4 bg-red-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-60">
            Sign Up with Google
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-2xl font-bold mb-2 text-blue-700">Your Profile</h1>
          <p className="text-gray-500 text-sm mb-6">Just a few more details</p>
          {error && <p className="text-red-500 text-sm mb-3 w-72">{error}</p>}

          <form onSubmit={handleProfileSubmit} className="flex flex-col space-y-4 w-72">
            <input type="text" placeholder="First name" required value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="p-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <input type="text" placeholder="Last name" required value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="p-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <div>
              <label className="block text-xs text-gray-500 mb-1 ml-1">Date of Birth</label>
              <input type="date" required value={dob}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setDob(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-700" />
            </div>
            <button type="submit" disabled={loading}
              className="bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-60">
              {loading ? "Saving…" : "Create Account"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}