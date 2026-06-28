import { useState } from "react";

export default function OnboardingModal({ onClose }) {
  const [page, setPage] = useState(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header bar */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-500 px-6 py-4">
          <div className="flex justify-between items-center">
            <span className="text-white text-xs font-semibold tracking-widest uppercase">
              Welcome to Course Finder
            </span>
            <span className="text-white/60 text-xs">{page} / 2</span>
          </div>
        </div>

        {/* Page 1 — how it works */}
        {page === 1 && (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="text-5xl mb-3">🎓</div>
              <h2 className="text-xl font-bold text-gray-900">How Course Finder Works</h2>
              <p className="text-gray-500 text-sm mt-1">Find the right university course for your NSC results</p>
            </div>

            <div className="space-y-3 mt-2">
              <Step n="1" title="Enter your marks" desc="Add your NSC subject marks manually or use your exam number." />
              <Step n="2" title="We calculate your APS" desc="Each university uses its own scoring method — we handle that automatically." />
              <Step n="3" title="See your qualifying courses" desc="Browse courses you qualify for across South Africa's top universities." />
            </div>

            <button onClick={() => setPage(2)}
              className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition">
              Next →
            </button>
          </div>
        )}

        {/* Page 2 — free vs paid */}
        {page === 2 && (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="text-5xl mb-3">💡</div>
              <h2 className="text-xl font-bold text-gray-900">Free & Premium Options</h2>
              <p className="text-gray-500 text-sm mt-1">Start for free, upgrade when you're ready</p>
            </div>

            <div className="space-y-3">
              <PlanRow icon="✅" label="Free" desc="Browse all qualifying courses — always free, no ads." highlight={false} />
              <PlanRow icon="🚀" label="R150 — Apply For Me" desc="We apply to up to 6 institutions on your behalf." highlight={true} />
            </div>

            <button onClick={onClose}
              className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition">
              Get Started
            </button>
            <button onClick={() => setPage(1)}
              className="w-full text-gray-400 text-sm hover:text-gray-600 transition">
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ n, title, desc }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <p className="text-gray-500 text-xs">{desc}</p>
      </div>
    </div>
  );
}

function PlanRow({ icon, label, desc, highlight }) {
  return (
    <div className={`flex gap-3 items-start p-3 rounded-xl ${highlight ? "bg-purple-50 border border-purple-200" : "bg-gray-50"}`}>
      <span className="text-xl shrink-0">{icon}</span>
      <div>
        <p className={`font-semibold text-sm ${highlight ? "text-purple-700" : "text-gray-800"}`}>{label}</p>
        <p className="text-gray-500 text-xs">{desc}</p>
      </div>
    </div>
  );
}