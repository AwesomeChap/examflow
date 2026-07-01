import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/useAuth";
import { Layout } from "./components/Layout";

// Route-level code splitting: each page is its own chunk, so the initial bundle
// only carries the shell + whichever page the visitor lands on. `named` exports
// are mapped to the default export React.lazy expects.
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const CreateExamPage = lazy(() =>
  import("./pages/CreateExamPage").then((m) => ({ default: m.CreateExamPage })),
);
const CreateUserPage = lazy(() =>
  import("./pages/CreateUserPage").then((m) => ({ default: m.CreateUserPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const ExamDetailPage = lazy(() =>
  import("./pages/ExamDetailPage").then((m) => ({ default: m.ExamDetailPage })),
);
const ExamEditorPage = lazy(() =>
  import("./pages/ExamEditorPage").then((m) => ({ default: m.ExamEditorPage })),
);
const ExamPreviewPage = lazy(() =>
  import("./pages/ExamPreviewPage").then((m) => ({
    default: m.ExamPreviewPage,
  })),
);
const StudentExamPage = lazy(() =>
  import("./pages/StudentExamPage").then((m) => ({
    default: m.StudentExamPage,
  })),
);
const StudentResultPage = lazy(() =>
  import("./pages/StudentResultPage").then((m) => ({
    default: m.StudentResultPage,
  })),
);
const StudentResultsPage = lazy(() =>
  import("./pages/StudentResultsPage").then((m) => ({
    default: m.StudentResultsPage,
  })),
);

const STAFF = ["admin", "teacher"] as const;
const ADMIN = ["admin"] as const;
const STUDENT = ["student"] as const;

function PageFallback() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center text-slate-500">
      Loading…
    </div>
  );
}

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
    <Suspense fallback={<PageFallback />}>
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
    </Suspense>
  );
}
