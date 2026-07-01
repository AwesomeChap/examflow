import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useDispatch } from "react-redux";
import {
  ApiError,
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from "../api/client";
import type { LoginPayload } from "../api/client";
import { api } from "../store/api";
import type { User } from "@examflow/shared-types";
import { AuthContext, type AuthStatus } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
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

  const login = useCallback(
    async (payload: LoginPayload) => {
      // Drop any cached data from a previous session so a new account never
      // sees the prior user's dashboard/results/exams (RTK Query caches are
      // keyed only by request args, which are identical across users).
      dispatch(api.util.resetApiState());
      const { user: loggedIn } = await loginRequest(payload);
      setUser(loggedIn);
      setStatus("authenticated");
      return loggedIn;
    },
    [dispatch],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      dispatch(api.util.resetApiState());
      setUser(null);
      setStatus("unauthenticated");
    }
  }, [dispatch]);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>
  );
}
