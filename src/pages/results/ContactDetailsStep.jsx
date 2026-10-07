// Final step before submitting "Apply For Me" selections: collects the
// phone number and email the team will use for the applications.
export default function ContactDetailsStep({
  phone, email, error, saving, selections,
  onPhoneChange, onEmailChange, onBack, onSubmit,
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">📞</div>
          <h2 className="text-2xl font-bold text-gray-900">Contact Details</h2>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">
            These details will be used for your university applications and WhatsApp communication.
          </p>
        </div>

        {error && (
          <p className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp / Phone Number
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🇿🇦</span>
              <input
                type="tel"
                placeholder="e.g. +27 81 234 5678"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">We'll use WhatsApp to send you application updates</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address for Applications
            </label>
            <input
              type="email"
              placeholder="e.g. your@email.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800"
            />
            <p className="text-xs text-gray-400 mt-1">Universities will contact you at this email</p>
          </div>
        </div>

        {/* Summary of selections */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Your Selections Summary</p>
          <div className="space-y-1.5">
            {Object.entries(selections).map(([inst, choices]) => (
              <div key={inst} className="text-xs text-gray-600">
                <span className="font-medium text-gray-800">{inst.replace("University of ", "U of ")}:</span>{" "}
                {[1,2,3].filter(r => choices[r]).map(r => choices[r].courseName).join(" · ")}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 py-3 rounded-xl font-medium transition text-sm"
          >
            ← Back
          </button>
          <button
            onClick={onSubmit}
            disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-60"
          >
            {saving ? "Submitting…" : "Submit Applications ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}
