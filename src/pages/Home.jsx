import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";

export default function Home() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const name = user.displayName || user.email || "";
        setDisplayName(name.toUpperCase());
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-gradient-to-br from-blue-100 to-purple-200 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 text-center">
        {/* Graduation cap icon */}
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-purple-600 rounded-full shadow-lg">
          <span className="text-3xl">🎓</span>
        </div>

        <h1 className="text-4xl font-extrabold text-purple-700 mb-3">
          Find Your Future
        </h1>

        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Finding courses has never been easier! Enter your marks and let us help you discover the best options for your future.
        </p>

        <button
          onClick={() => navigate("/enter-marks")}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold shadow-md transition-all mb-4"
        >
          Enter marks manually
        </button>

        <button
          onClick={() => navigate("/exam-number")}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black py-3 rounded-xl font-semibold shadow-md transition-all"
        >
          Use Examination Number
        </button>
      </div>

      {/* User info & sign out bar */}
      <div className="mt-6 flex items-center gap-3">
        <span className="text-gray-600 font-medium text-sm">{displayName}</span>
        <button
          onClick={handleSignOut}
          className="bg-purple-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-purple-700 transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}