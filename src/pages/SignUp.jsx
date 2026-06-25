import { useState } from "react";
import { auth, googleProvider } from "../firebase";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate("/home");
    } catch (error) {
      alert(error.message);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/home");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4">
      <h1 className="text-2xl font-bold mb-6 text-blue-700">Sign Up</h1>

      <form onSubmit={handleSignUp} className="flex flex-col space-y-4 w-72">
        <input
          type="email"
          placeholder="Email"
          className="p-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="p-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          Sign Up
        </button>
      </form>

      <p className="mt-4 text-gray-500 text-sm">or</p>

      <button
        onClick={handleGoogleSignUp}
        className="mt-4 bg-red-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-red-700 transition"
      >
        Sign Up with Google
      </button>
    </div>
  );
}