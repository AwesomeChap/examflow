import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
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

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
