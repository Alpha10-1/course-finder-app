import { useState } from "react";

export default function ExamNumberEntry() {
  const [examNumber, setExamNumber] = useState("");

  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-gradient-to-br from-blue-100 to-purple-200 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-6 relative">
        {/* Coming Soon Banner */}
        <div className="absolute top-0 left-0 right-0 bg-yellow-400 text-black text-center text-sm font-semibold py-1 rounded-t-2xl">
          Coming Soon: Auto-Fetch Subjects with Exam Number!
        </div>

        <h1 className="text-2xl font-bold text-center mt-6 mb-4 text-gray-800">Enter Your Examination Number</h1>

        <form className="space-y-4">
          <input
            type="text"
            value={examNumber}
            onChange={(e) => setExamNumber(e.target.value)}
            disabled
            maxLength={13}
            className="w-full p-3 rounded-xl border bg-gray-100 cursor-not-allowed text-gray-400"
            placeholder="e.g., 0102030456789"
          />

          <button
            type="button"
            disabled
            className="w-full bg-gradient-to-r from-purple-400 to-indigo-400 text-white py-3 rounded-xl font-semibold shadow-md opacity-50 cursor-not-allowed"
          >
            Find My Subjects (Coming Soon)
          </button>
        </form>
      </div>
    </div>
  );
}