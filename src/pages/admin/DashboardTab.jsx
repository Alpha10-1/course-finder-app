import { StatCard } from "./ui";

export default function DashboardTab({ stats, courses }) {

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.total} icon="👥" color="from-blue-600 to-blue-800" />
        <StatCard label="Free Plan" value={stats.free} icon="✅" color="from-gray-600 to-gray-800" />
        <StatCard label="Apply For Me (R100)" value={stats.applyForMe} icon="🚀" color="from-purple-700 to-pink-700" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Courses" value={courses.length} icon="📚" color="from-green-700 to-teal-700" />
        <StatCard label="Auth-Only Accounts" value={stats.authOnly} icon="👤" color="from-orange-700 to-red-700" />
        <StatCard label="Revenue" value={`R${stats.revenue.toLocaleString()}`} icon="💰" color="from-yellow-600 to-orange-600" />
      </div>

      {/* Plan distribution */}
      {stats.total > 0 && (
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <p className="text-sm font-semibold text-gray-300 mb-3">Plan Distribution</p>
          <div className="flex rounded-full overflow-hidden h-4 mb-3">
            <div className="bg-gray-500" style={{ width: `${(stats.free/stats.total)*100}%` }} />
            <div className="bg-purple-500" style={{ width: `${(stats.applyForMe/stats.total)*100}%` }} />
          </div>
          <div className="flex gap-4 text-xs text-gray-400">
            <span><span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1"/>Free ({Math.round((stats.free/stats.total)*100)}%)</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1"/>Apply ({Math.round((stats.applyForMe/stats.total)*100)}%)</span>
          </div>
        </div>
      )}
    </div>
  );
}
