import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { User } from "../src/types/user";

const API = "http://localhost:3000";

export const TEST_USERS: Record<"admin" | "teacher" | "student", User & { password: string }> = {
  admin: {
    id: "u-admin",
    name: "Ada Admin",
    email: "admin@examflow.test",
    role: "admin",
    matriculationNumber: null,
    password: "admin-pass",
  },
  teacher: {
    id: "u-teacher",
    name: "Tom Teacher",
    email: "teacher@examflow.test",
    role: "teacher",
    matriculationNumber: null,
    password: "teacher-pass",
  },
  student: {
    id: "u-student",
    name: "Sam Student",
    email: "student@examflow.test",
    role: "student",
    matriculationNumber: "MAT-1001",
    password: "student-pass",
  },
};

function publicUser(user: User & { password: string }): User {
  const { password: _password, ...rest } = user;
  return rest;
}

/**
 * Server-side session state. Because the real auth cookie is HttpOnly, JS can
 * never read it; the only way the client knows it is signed in is by asking the
 * server (`GET /me`). We model that here: `login` opens a session, `logout`
 * closes it, and `/me` reflects it. This lets tests exercise true
 * cookie-backed persistence without the token ever touching client storage.
 */
let activeSession: User | null = null;

/** Records the `credentials` mode of the most recent request per path. */
export const requestCredentials: Record<string, RequestCredentials> = {};

export function seedSession(user: User | null) {
  activeSession = user;
}

export function resetSession() {
  activeSession = null;
  for (const key of Object.keys(requestCredentials)) {
    delete requestCredentials[key];
  }
}

function findUser(identifier: string, password: string): User | null {
  const id = identifier.trim().toLowerCase();
  const match = Object.values(TEST_USERS).find(
    (user) =>
      (user.email.toLowerCase() === id ||
        user.matriculationNumber?.toLowerCase() === id) &&
      user.password === password,
  );
  return match ? publicUser(match) : null;
}

export const handlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    requestCredentials["/auth/login"] = request.credentials;
    const { identifier, password } = (await request.json()) as {
      identifier: string;
      password: string;
    };

    const user = findUser(identifier, password);
    if (!user) {
      return HttpResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    activeSession = user;
    return HttpResponse.json(
      { user },
      {
        // Emulate the backend issuing an HttpOnly cookie. jsdom will not expose
        // it to JS, which is exactly the behaviour we rely on.
        headers: { "Set-Cookie": "examflow_token=signed-token; HttpOnly; Path=/; SameSite=Lax" },
      },
    );
  }),

  http.post(`${API}/auth/logout`, ({ request }) => {
    requestCredentials["/auth/logout"] = request.credentials;
    activeSession = null;
    return HttpResponse.json(
      { success: true },
      { headers: { "Set-Cookie": "examflow_token=; Path=/; Max-Age=0" } },
    );
  }),

  http.get(`${API}/me`, ({ request }) => {
    requestCredentials["/me"] = request.credentials;
    if (!activeSession) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ user: activeSession });
  }),
];

export const server = setupServer(...handlers);
