import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError, fetchCurrentUser, login as loginRequest, logout as logoutRequest } from "../api/client";
import type { LoginPayload } from "../api/client";
import type { User } from "../types/user";
import { AuthContext, type AuthStatus } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // On mount, attempt to restore the session from the HttpOnly cookie by
  // asking the server who we are. A valid cookie yields the current user; a
  // missing/expired cookie returns 401 and we stay logged out.
  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser()
      .then(({ user: current }) => {
        if (cancelled) return;
        setUser(current);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (!(error instanceof ApiError) || error.status !== 401) {
          // Surface unexpected failures for debugging while still treating the
          // user as unauthenticated.
          console.error("Failed to restore session", error);
        }
        setUser(null);
        setStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const { user: loggedIn } = await loginRequest(payload);
    setUser(loggedIn);
    setStatus("authenticated");
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>
  );
}
