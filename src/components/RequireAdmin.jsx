import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { isSuperAdmin } from "../utils/adminConfig";
import { useNavigate } from "react-router-dom";

export default function RequireAdmin({ children }) {
  const [status, setStatus] = useState("loading");
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate("/"); return; }

      // Super admin — always allowed, even if Firestore doc doesn't exist
      if (isSuperAdmin(user.email)) {
        // Ensure super admin always has the correct role in Firestore
        try {
          await setDoc(doc(db, "users", user.uid), {
            isAdmin: true,
            adminRole: "super",
            email: user.email,
          }, { merge: true });
        } catch (_) {}
        setStatus("allowed");
        return;
      }

      // Other users — check Firestore for isAdmin flag
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().isAdmin === true) {
          setStatus("allowed");
        } else {
          setStatus("denied");
        }
      } catch {
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
      <p className="text-gray-500 text-sm">You don't have admin privileges.</p>
      <button onClick={() => navigate("/home")} className="text-gray-400 hover:text-white text-sm">
        ← Go back
      </button>
    </div>
  );

  return children;
}