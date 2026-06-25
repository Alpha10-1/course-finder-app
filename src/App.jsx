import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Results from "./pages/Results";
import EnterMarks from "./pages/EnterMarks";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Welcome from "./pages/Welcome";
import ExamNumberEntry from "./pages/ExamNumberEntry";
import RequireAuth from "./components/RequireAuth";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Welcome />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Protected routes */}
        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/enter-marks" element={<RequireAuth><EnterMarks /></RequireAuth>} />
        <Route path="/results" element={<RequireAuth><Results /></RequireAuth>} />
        <Route path="/exam-number" element={<RequireAuth><ExamNumberEntry /></RequireAuth>} />
      </Routes>
    </Router>
  );
}

export default App;