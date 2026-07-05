import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import Home from "./pages/Home";
import Results from "./pages/Results";
import EnterMarks from "./pages/EnterMarks";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Welcome from "./pages/Welcome";
import ExamNumberEntry from "./pages/ExamNumberEntry";
import Admin from "./pages/Admin";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import PaymentSuccess from "./pages/PaymentSuccess";
import { trackPageview } from "./utils/analytics";

// Lazy-loaded: these pull in the full course dataset (~190KB of JSON), which
// no other route needs. Splitting them into their own chunk keeps that data
// out of the initial bundle for every other page (sign-in, sign-up, etc).
const CoursesDirectory = lazy(() => import("./pages/public/CoursesDirectory"));
const InstitutionCourses = lazy(() => import("./pages/public/InstitutionCourses"));
const CourseDetail = lazy(() => import("./pages/public/CourseDetail"));

function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-200">
      <p className="text-gray-500">Loading…</p>
    </div>
  );
}

// GA4's script (index.html) has send_page_view disabled — this fires a
// page_view on the initial load AND on every client-side navigation, since
// React Router doesn't trigger real page loads for route changes.
function AnalyticsListener() {
  const location = useLocation();

  useEffect(() => {
    // Deferred so react-helmet-async's <title> update (an effect itself)
    // has a chance to run first — otherwise this can fire with the
    // previous page's title still set.
    const id = setTimeout(() => {
      trackPageview(location.pathname + location.search);
    }, 0);
    return () => clearTimeout(id);
  }, [location.pathname, location.search]);

  return null;
}

function App() {
  return (
    <Router>
      <AnalyticsListener />
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/courses" element={<Suspense fallback={<PageLoading />}><CoursesDirectory /></Suspense>} />
        <Route path="/courses/:institutionSlug" element={<Suspense fallback={<PageLoading />}><InstitutionCourses /></Suspense>} />
        <Route path="/courses/:institutionSlug/:courseSlug" element={<Suspense fallback={<PageLoading />}><CourseDetail /></Suspense>} />
        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/enter-marks" element={<RequireAuth><EnterMarks /></RequireAuth>} />
        <Route path="/results" element={<RequireAuth><Results /></RequireAuth>} />
        <Route path="/exam-number" element={<RequireAuth><ExamNumberEntry /></RequireAuth>} />
        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
        <Route path="/payment-success" element={<RequireAuth><PaymentSuccess /></RequireAuth>} />
      </Routes>
    </Router>
  );
}

export default App;