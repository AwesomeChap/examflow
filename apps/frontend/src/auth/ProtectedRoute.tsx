import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { UserRole } from "../types/user";
import { useAuth } from "./useAuth";

type ProtectedRouteProps = {
  children: ReactNode;
  /** When set, only these roles may view the route; others are redirected. */
  allowedRoles?: UserRole[];
};

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    // Remember where the user wanted to go so we can send them back after login.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Authenticated but lacking the required role: bounce to their dashboard.
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
