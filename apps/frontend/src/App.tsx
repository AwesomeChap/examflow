import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { CreateExamPage } from "./pages/CreateExamPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExamDetailPage } from "./pages/ExamDetailPage";
import { ExamEditorPage } from "./pages/ExamEditorPage";
import { LoginPage } from "./pages/LoginPage";

const STAFF = ["admin", "teacher"] as const;

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
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
