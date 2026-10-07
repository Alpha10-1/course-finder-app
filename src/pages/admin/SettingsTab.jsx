export default function SettingsTab({ admin }) {
  const {
    users, adminEmailInput, setAdminEmailInput, handleToggleAdmin, handleGrantAdminByEmail,
  } = admin;

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-xl font-bold text-white">Settings</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <p className="font-semibold text-white">Grant Admin Access</p>
        <p className="text-xs text-gray-400">Enter the email of an existing user to give them admin access.</p>
        <div className="flex gap-2">
          <input value={adminEmailInput} onChange={(e) => setAdminEmailInput(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <button onClick={handleGrantAdminByEmail}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition font-medium">Grant</button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <p className="font-semibold text-white">Current Admins</p>
        {users.filter((u) => u.isAdmin).length === 0
          ? <p className="text-gray-500 text-sm">No other admins.</p>
          : users.filter((u) => u.isAdmin).map((u) => (
            <div key={u.uid} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-2">
              <div>
                <p className="text-sm text-white">{u.firstName ? `${u.firstName} ${u.lastName}` : u.email}</p>
                <p className="text-xs text-gray-400">{u.email}</p>
              </div>
              <button onClick={() => handleToggleAdmin(u.uid, true)} className="text-xs text-red-400 hover:text-red-300">Revoke</button>
            </div>
          ))
        }
      </div>

      <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-5 space-y-2">
        <p className="font-semibold text-red-400">Note on User Deletion</p>
        <p className="text-xs text-gray-400 leading-relaxed">
          The Delete button removes the user's Firestore document and attempts to delete their Auth account via the REST API.
          If the REST delete fails (permissions), use the{" "}
          <a href="https://console.firebase.google.com/project/course-finder-214e7/authentication/users"
            target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
            Firebase Console
          </a>{" "}as a fallback.
        </p>
      </div>
    </div>
  );
}
