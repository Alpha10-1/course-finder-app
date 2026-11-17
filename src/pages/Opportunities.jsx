import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import WorkProfileForm from "./opportunities/WorkProfileForm";
import {
  cleanWorkProfile, educationLabel, opportunitiesForLearner, typeLabel,
} from "../utils/opportunities";

function formatDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? isoDate : d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

// Learnerships, internships, apprenticeships and entry-level jobs the learner
// qualifies for — and only those. Listings are admin-verified (Firestore
// `opportunities`); the learner's answers live on their user doc (`workProfile`).
export default function Opportunities() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState({});
  const [subjects, setSubjects] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) return;
      Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDocs(collection(db, "opportunities")),
      ])
        .then(([userSnap, listingSnap]) => {
          if (cancelled) return;
          const data = userSnap.exists() ? userSnap.data() : {};
          setUid(user.uid);
          setProfile(data.workProfile || {});
          setEditing(!data.workProfile);
          setSubjects(Array.isArray(data.subjects) ? data.subjects : []);
          setListings(listingSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        })
        .catch((err) => { if (!cancelled) setLoadError(err.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  }, []);

  const { qualifying, notQualifying, unanswered } = useMemo(
    () => opportunitiesForLearner(listings, profile, subjects),
    [listings, profile, subjects]
  );

  const saveProfile = async (form) => {
    const cleaned = cleanWorkProfile(form);
    setSaving(true);
    setSaveError("");
    try {
      // Replaces the whole profile, so cleared answers are really removed.
      await setDoc(doc(db, "users", uid), { workProfile: cleaned }, { mergeFields: ["workProfile"] });
      setProfile(cleaned);
      setEditing(false);
    } catch (err) {
      console.error("Saving work profile failed:", err);
      setSaveError("Couldn't save your profile. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200"><p className="text-gray-700">Loading…</p></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Link to="/home" className="text-sm text-purple-700 hover:underline">← Home</Link>
        <header className="mt-3 mb-5">
          <h1 className="text-3xl font-bold text-gray-900">Learnerships & jobs</h1>
          <p className="text-gray-700 mt-2">
            Learnerships, internships, apprenticeships and entry-level jobs that need no experience. You only see the
            ones you meet every requirement for.
          </p>
        </header>

        <div role="note" className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 mb-4 text-sm text-amber-900">
          <strong>Never pay to apply.</strong> Real learnerships and jobs don't charge application, registration or
          training fees. If anyone asks you for money, it's a scam.
        </div>

        {loadError && (
          <p role="alert" className="bg-white rounded-2xl p-4 text-sm text-red-700 mb-4">Couldn't load listings: {loadError}</p>
        )}

        {/* ── Profile ── */}
        <section className="bg-white rounded-2xl shadow-sm p-5 mb-4" aria-labelledby="work-profile">
          <div className="flex items-start justify-between gap-3">
            <h2 id="work-profile" className="font-semibold text-gray-900">Your profile</h2>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-purple-700 hover:underline">Edit</button>
            )}
          </div>
          {editing ? (
            <div className="mt-3">
              <WorkProfileForm
                profile={profile}
                saving={saving}
                onSave={saveProfile}
                onCancel={Object.keys(profile).length ? () => setEditing(false) : undefined}
              />
              {saveError && <p role="alert" className="text-sm text-red-700 mt-2">{saveError}</p>}
            </div>
          ) : (
            <p className="text-sm text-gray-700 mt-1">
              {[
                profile.education && educationLabel(profile.education),
                profile.province,
                profile.dateOfBirth && `born ${formatDate(profile.dateOfBirth)}`,
              ].filter(Boolean).join(" · ") || "Not filled in yet."}
              {subjects.length > 0 && " · matric marks from your marks page"}
            </p>
          )}
        </section>

        {/* ── Results ── */}
        <section aria-labelledby="qualifying" aria-live="polite">
          <h2 id="qualifying" className="font-semibold text-gray-900 mb-2">
            {qualifying.length === 0 ? "Nothing you qualify for right now" : `You qualify for ${qualifying.length}`}
          </h2>
          {unanswered.length > 0 && (
            <p className="text-sm text-gray-700 bg-white rounded-xl px-4 py-3 mb-3">
              Answer {unanswered.map((u) => u.question).join(", ")} in your profile to check{" "}
              {unanswered.reduce((n, u) => Math.max(n, u.count), 0) === 1 ? "another listing" : "more listings"}.
            </p>
          )}
          {qualifying.length === 0 && (
            <p className="text-sm text-gray-700">
              New listings are added as we verify them.
              {notQualifying > 0 && ` ${notQualifying} open listing${notQualifying === 1 ? " asks" : "s ask"} for something your profile doesn't meet.`}
              {" "}In the meantime, <Link to="/free-courses" className="text-purple-700 font-medium hover:underline">free courses</Link> can
              add skills and certificates to your CV.
            </p>
          )}
          <ul className="space-y-3">
            {qualifying.map((o) => (
              <li key={o.id} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{o.title}</h3>
                    <p className="text-sm text-gray-600">{o.organisation} · {typeLabel(o.type)}{o.stipend && ` · ${o.stipend}`}</p>
                  </div>
                  <span className="text-xs font-medium text-purple-800 bg-purple-50 border border-purple-200 rounded-full px-2.5 py-0.5 shrink-0">
                    {o.closeDate ? `Closes ${formatDate(o.closeDate)}` : "No closing date"}
                  </span>
                </div>
                {o.description && <p className="text-sm text-gray-700 mt-2">{o.description}</p>}
                {o.met.length > 0 && (
                  <p className="text-xs text-green-800 mt-2">✓ You meet: {o.met.join(" · ")}</p>
                )}
                {o.otherRequirements && (
                  <p className="text-xs text-gray-700 mt-1"><span className="font-medium">Also check:</span> {o.otherRequirements}</p>
                )}
                <p className="text-xs text-gray-600 mt-1">Verified at: {o.source}</p>
                <a
                  href={o.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded-xl transition"
                >
                  Apply on their site ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
