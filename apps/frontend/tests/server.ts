import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ExamListItem } from "../src/types/exam";
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

/** In-memory exam fixtures, scoped per-role in the handlers below. */
let examFixtures: ExamListItem[] = [];

export function seedExams(exams: ExamListItem[]) {
  examFixtures = exams;
}

export function resetSession() {
  activeSession = null;
  examFixtures = [];
  for (const key of Object.keys(requestCredentials)) {
    delete requestCredentials[key];
  }
}

/** Convenience builder for an exam list item with sensible defaults. */
export function makeExam(overrides: Partial<ExamListItem> & { id: string }): ExamListItem {
  return {
    title: `Exam ${overrides.id}`,
    description: null,
    durationMin: 60,
    status: "draft",
    startsAt: null,
    createdAt: new Date().toISOString(),
    createdById: TEST_USERS.teacher.id,
    createdBy: {
      id: TEST_USERS.teacher.id,
      name: TEST_USERS.teacher.name,
      email: TEST_USERS.teacher.email,
    },
    _count: { questions: 0, attempts: 0, assignments: 0 },
    ...overrides,
  };
}

/** Mirrors the backend's role-scoped exam visibility. */
function visibleExams(): ExamListItem[] {
  if (!activeSession) return [];
  if (activeSession.role === "admin") return examFixtures;
  if (activeSession.role === "teacher") {
    return examFixtures.filter((exam) => exam.createdById === activeSession!.id);
  }
  return [];
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

  http.get(`${API}/exams`, ({ request }) => {
    requestCredentials["/exams"] = request.credentials;
    if (!activeSession) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "10");

    const all = visibleExams();
    const start = (page - 1) * pageSize;
    const exams = all.slice(start, start + pageSize);

    return HttpResponse.json({ exams, total: all.length, page, pageSize });
  }),

  http.get(`${API}/exams/:examId`, ({ params, request }) => {
    requestCredentials["/exams/:examId"] = request.credentials;
    if (!activeSession) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const exam = visibleExams().find((e) => e.id === params.examId);
    if (!exam) {
      // Same 404 for missing-or-unauthorized, mirroring the backend.
      return HttpResponse.json({ error: "Exam not found" }, { status: 404 });
    }
    return HttpResponse.json({ exam });
  }),

  http.get(`${API}/admin/dashboard`, ({ request }) => {
    requestCredentials["/admin/dashboard"] = request.credentials;
    if (!activeSession || activeSession.role !== "admin") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return HttpResponse.json({
      users: { admins: 1, teachers: 3, students: 25 },
      exams: examFixtures.length,
    });
  }),
];

export const server = setupServer(...handlers);
