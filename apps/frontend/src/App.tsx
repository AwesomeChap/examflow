import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/useAuth";
import { Layout } from "./components/Layout";
import { CreateExamPage } from "./pages/CreateExamPage";
import { CreateUserPage } from "./pages/CreateUserPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExamDetailPage } from "./pages/ExamDetailPage";
import { ExamEditorPage } from "./pages/ExamEditorPage";
import { ExamPreviewPage } from "./pages/ExamPreviewPage";
import { LoginPage } from "./pages/LoginPage";
import { StudentExamPage } from "./pages/StudentExamPage";
import { StudentResultPage } from "./pages/StudentResultPage";
import { StudentResultsPage } from "./pages/StudentResultsPage";

const STAFF = ["admin", "teacher"] as const;
const ADMIN = ["admin"] as const;
const STUDENT = ["student"] as const;

// Landing redirect for `/` and unknown paths. Waits for the session check to
// finish, then sends the visitor to their dashboard (authenticated) or to
// login (not), avoiding a visible detour through the protected /dashboard.
function LandingRedirect() {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route
          path="/exams/new"
          element={
            <ProtectedRoute allowedRoles={[...STAFF]}>
              <CreateExamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/new"
          element={
            <ProtectedRoute allowedRoles={[...ADMIN]}>
              <CreateUserPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam/:examId/edit"
          element={
            <ProtectedRoute allowedRoles={[...STAFF]}>
              <ExamEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam/:examId/details"
          element={
            <ProtectedRoute allowedRoles={[...STAFF]}>
              <ExamDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam/:examId/preview"
          element={
            <ProtectedRoute allowedRoles={[...STAFF]}>
              <ExamPreviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam/:examId"
          element={
            <ProtectedRoute allowedRoles={[...STUDENT]}>
              <StudentExamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results"
          element={
            <ProtectedRoute allowedRoles={[...STUDENT]}>
              <StudentResultsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:examId/:attemptId"
          element={
            <ProtectedRoute allowedRoles={[...STUDENT]}>
              <StudentResultPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/" element={<LandingRedirect />} />
      <Route path="*" element={<LandingRedirect />} />
    </Routes>
  );
}
