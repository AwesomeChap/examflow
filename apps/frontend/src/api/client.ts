import type { User } from "../types/user";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ErrorBody = { error?: string; message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    // Always send/receive the HttpOnly auth cookie. The token is never exposed
    // to JS, so the browser is solely responsible for attaching it.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as ErrorBody;
      message = body.error ?? body.message ?? message;
    } catch {
      // Non-JSON error body; fall back to the status text.
    }
    throw new ApiError(response.status, message);
  }

  // 204 / empty bodies are valid for endpoints like logout.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export type LoginPayload = {
  identifier: string;
  password: string;
};

export function login(payload: LoginPayload): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function fetchCurrentUser(): Promise<{ user: User }> {
  return request<{ user: User }>("/me", { method: "GET" });
}
