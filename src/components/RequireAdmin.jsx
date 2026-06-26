import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { isAdminEmail } from "../utils/adminConfig";
import { useNavigate } from "react-router-dom";

export default function RequireAdmin({ children }) {
  const [status, setStatus] = useState("loading"); // loading | allowed | denied
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { navigate("/"); return; }
      if (isAdminEmail(user.email)) {
        setStatus("allowed");
      } else {
        setStatus("denied");
      }
    });
    return () => unsub();
  }, [navigate]);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <p className="text-gray-400">Verifying access…</p>
    </div>
  );

  if (status === "denied") return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 gap-4">
      <p className="text-red-400 text-xl font-bold">⛔ Access Denied</p>
      <button onClick={() => navigate("/home")} className="text-gray-400 hover:text-white text-sm">
        ← Go back
      </button>
    </div>
  );

  return children;
}