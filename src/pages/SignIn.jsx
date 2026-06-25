import { useState } from "react";
import { auth, googleProvider } from "../firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const navigate = useNavigate();

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/home");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/home");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSendOtp = async () => {
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          "recaptcha-container",
          { size: "invisible" }
        );
      }
      const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(result);
      alert("OTP sent!");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      await confirmationResult.confirm(otp);
      navigate("/home");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200 p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl space-y-5">
        <h1 className="text-3xl font-bold text-center text-gray-900">Sign In</h1>

        {/* Email Sign In */}
        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
            required
          />
          <button
            type="submit"
            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition"
          >
            Sign in with Email
          </button>
        </form>

        <div className="text-center text-gray-400 text-sm font-medium">OR</div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition"
        >
          Sign in with Google
        </button>

        <div className="text-center text-gray-400 text-sm font-medium">OR</div>

        {/* Phone Sign In */}
        <div className="space-y-3">
          <input
            type="tel"
            placeholder="Phone (e.g. +27123456789)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={handleSendOtp}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
          >
            Send OTP
          </button>

          {confirmationResult && (
            <>
              <input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <button
                onClick={handleVerifyOtp}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
              >
                Verify OTP & Sign In
              </button>
            </>
          )}
        </div>

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}