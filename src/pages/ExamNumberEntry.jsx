import { useState } from "react";

export default function ExamNumberEntry() {
  const [examNumber, setExamNumber] = useState("");

  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-gradient-to-br from-blue-100 to-purple-200 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl overflow-hidden">
        {/* Coming Soon Banner */}
        <div className="bg-yellow-400 text-black text-center text-sm font-semibold py-2 px-4">
          Coming Soon: Auto-Fetch Subjects with Exam Number!
        </div>

        <div className="p-8 space-y-4">
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Enter Your Examination Number
          </h1>

          <input
            type="text"
            value={examNumber}
            onChange={(e) => setExamNumber(e.target.value)}
            disabled
            maxLength={13}
            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-100 cursor-not-allowed text-gray-400 focus:outline-none"
            placeholder="e.g., 0102030456789"
          />

          <button
            type="button"
            disabled
            className="w-full bg-purple-400 text-white py-3 rounded-xl font-semibold shadow-md opacity-60 cursor-not-allowed"
          >
            Find My Subjects (Coming Soon)
          </button>
        </div>
      </div>
    </div>
  );
}