import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function Welcome() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) navigate("/home");
    });
    return () => unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-blue-200 to-blue-300 p-4">
      <div className="bg-white shadow-lg rounded-2xl p-10 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-blue-700 mb-3">
          Welcome to Course Finder
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          Find courses that match your subjects. Sign up or sign in to get started!
        </p>

        <div className="flex flex-col space-y-4">
          <Link
            to="/signup"
            className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-base font-medium transition duration-200 block"
          >
            Sign Up
          </Link>
          <Link
            to="/signin"
            className="border border-gray-300 text-blue-600 hover:bg-blue-50 py-3 rounded-xl text-base font-medium transition duration-200 block"
          >
            Sign In
          </Link>
        </div>
      </div>

      <p className="mt-8 text-sm text-gray-400">
        &copy; 2026 Course Finder. All rights reserved.
      </p>
    </div>
  );
}