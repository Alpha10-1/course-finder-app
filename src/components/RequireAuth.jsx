// src/components/RequireAuth.jsx
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (!currentUser) {
        navigate("/"); // 👈 redirect to Sign In if not logged in
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return <p className="text-center mt-10">Checking authentication...</p>;
  }

  return user ? children : null;
}