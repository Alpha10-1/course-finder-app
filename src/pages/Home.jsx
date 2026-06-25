import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate("/enter-marks");
  };

  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-gradient-to-br from-blue-100 to-purple-200 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-6">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-purple-600 text-white text-3xl font-bold rounded-full shadow-lg">
          🎓
        </div>

        <h1 className="text-4xl font-extrabold text-purple-800 mb-2 text-center">
          Find Your Future
        </h1>

        <p className="text-gray-600 mb-8 text-sm text-center leading-relaxed">
          Enter your South African Examination subject marks to discover which courses you're eligible for at universities and colleges.
        </p>

        <button
          onClick={handleStart}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 rounded-xl font-semibold shadow-md transition-all"
        >
          Find Courses
        </button>
        <a
            href="/exam-number"
            className="mt-4 block w-full text-center bg-yellow-400 hover:bg-yellow-500 text-black py-3 rounded-xl font-semibold shadow-md transition-all"
            >
            Use Examination Number
        </a>
      </div>
    </div>
  );
}