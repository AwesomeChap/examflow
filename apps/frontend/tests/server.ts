import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ExamListItem } from "../src/types/exam";
import type { Attempt, AttemptResult } from "../src/types/attempt";
import type { Question } from "../src/types/question";
import type { Student } from "../src/types/student";
import type { StudentDashboardExam } from "../src/types/studentDashboard";
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

/** Captured request payloads, for asserting exactly what the client sent. */
export const capturedRequests: { questionCreate: unknown[] } = { questionCreate: [] };

export function seedSession(user: User | null) {
  activeSession = user;
}

/** In-memory exam fixtures, scoped per-role in the handlers below. */
let examFixtures: ExamListItem[] = [];
/** Questions keyed by exam id. */
const questionsByExam = new Map<string, Question[]>();
/** All student accounts (for the assign multi-select). */
let studentFixtures: Student[] = [];
/** Assigned student ids keyed by exam id. */
const assignmentsByExam = new Map<string, Set<string>>();
/** In-progress or submitted attempts keyed by `userId:examId`. */
const attemptsByKey = new Map<string, Attempt>();
let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function seedExams(exams: ExamListItem[]) {
  examFixtures = exams;
}

export function seedQuestions(examId: string, questions: Question[]) {
  questionsByExam.set(examId, questions);
}

export function seedStudents(students: Student[]) {
  studentFixtures = students;
}

export function seedAssignments(examId: string, studentIds: string[]) {
  assignmentsByExam.set(examId, new Set(studentIds));
}

function attemptKey(userId: string, examId: string) {
  return `${userId}:${examId}`;
}

/** Assign an exam (+ optional questions) to the test student for dashboard/taking flows. */
export function seedStudentExam(
  exam: ExamListItem,
  questions: Question[] = [],
  studentId: string = TEST_USERS.student.id,
) {
  examFixtures = [exam, ...examFixtures.filter((e) => e.id !== exam.id)];
  seedQuestions(exam.id, questions);
  seedAssignments(exam.id, [studentId]);
}

function gradeAttempt(examId: string, attempt: Attempt): AttemptResult {
  const questions = questionsByExam.get(examId) ?? [];
  const answerByQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
  let score = 0;
  let correctCount = 0;
  const breakdown = questions.map((q) => {
    const ans = answerByQ.get(q.id);
    const isCorrect = ans ? ans.value === q.correctAnswer : null;
    const awarded = isCorrect ? q.points : 0;
    if (isCorrect) {
      score += q.points;
      correctCount += 1;
    }
    return {
      questionId: q.id,
      points: q.points,
      awardedPoints: awarded,
      answered: ans !== undefined,
      value: ans?.value ?? null,
      isCorrect,
      correctAnswer: q.correctAnswer,
    };
  });
  const maxScore = questions.reduce((s, q) => s + q.points, 0);
  return {
    attemptId: attempt.id,
    examId,
    submittedAt: attempt.submittedAt,
    score,
    maxScore,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0,
    totalQuestions: questions.length,
    correctCount,
    breakdown,
  };
}

function buildStudentDashboard(): StudentDashboardExam[] {
  if (!activeSession || activeSession.role !== "student") return [];
  const studentId = activeSession.id;
  const now = Date.now();
  return examFixtures
    .filter((exam) => assignmentsByExam.get(exam.id)?.has(studentId))
    .map((exam) => {
      const att = attemptsByKey.get(attemptKey(studentId, exam.id));
      const status = !att ? "not_started" : att.submittedAt ? "submitted" : "in_progress";
      const isOpen = !exam.startsAt || now >= new Date(exam.startsAt).getTime();
      return {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        durationMin: exam.durationMin,
        startsAt: exam.startsAt,
        totalQuestions: exam._count.questions,
        isOpen,
        startsInMs:
          exam.startsAt && !isOpen ? new Date(exam.startsAt).getTime() - now : null,
        attemptStatus: status as StudentDashboardExam["attemptStatus"],
        score: att?.submittedAt ? att.score : null,
      };
    });
}

function syncAssignmentCount(examId: string) {
  const exam = examFixtures.find((e) => e.id === examId);
  if (exam) exam._count = { ...exam._count, assignments: assignmentsByExam.get(examId)?.size ?? 0 };
}

function syncQuestionCount(examId: string) {
  const exam = examFixtures.find((e) => e.id === examId);
  if (exam) exam._count = { ...exam._count, questions: questionsByExam.get(examId)?.length ?? 0 };
}

export function resetSession() {
  activeSession = null;
  examFixtures = [];
  questionsByExam.clear();
  studentFixtures = [];
  assignmentsByExam.clear();
  attemptsByKey.clear();
  idCounter = 0;
  capturedRequests.questionCreate.length = 0;
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
  if (activeSession.role === "student") {
    return examFixtures.filter((exam) =>
      assignmentsByExam.get(exam.id)?.has(activeSession!.id),
    );
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
      return HttpResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const questions = (questionsByExam.get(exam.id as string) ?? []).map((q) => {
      if (activeSession!.role === "student") {
        const { correctAnswer: _c, ...rest } = q;
        return rest;
      }
      return q;
    });

    return HttpResponse.json({ exam: { ...exam, questions } });
  }),

  http.post(`${API}/exams`, async ({ request }) => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as Partial<ExamListItem>;
    const exam = makeExam({
      id: nextId("exam"),
      title: body.title ?? "Untitled",
      description: body.description ?? null,
      durationMin: body.durationMin ?? 60,
      status: body.status ?? "draft",
      createdById: activeSession.id,
      createdBy: {
        id: activeSession.id,
        name: activeSession.name,
        email: activeSession.email,
      },
    });
    examFixtures = [exam, ...examFixtures];
    return HttpResponse.json({ exam }, { status: 201 });
  }),

  http.put(`${API}/exams/:examId`, async ({ params, request }) => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const index = examFixtures.findIndex((e) => e.id === params.examId);
    if (index < 0) {
      return HttpResponse.json({ error: "Exam not found" }, { status: 404 });
    }
    const body = (await request.json()) as Partial<ExamListItem>;
    examFixtures[index] = { ...examFixtures[index], ...body };
    return HttpResponse.json({ exam: examFixtures[index] });
  }),

  http.delete(`${API}/exams/:examId`, ({ params }) => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    examFixtures = examFixtures.filter((e) => e.id !== params.examId);
    questionsByExam.delete(params.examId as string);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/exams/:examId/questions`, ({ params }) => {
    if (!activeSession) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const questions = questionsByExam.get(params.examId as string) ?? [];
    return HttpResponse.json({ questions });
  }),

  http.post(`${API}/exams/:examId/questions/reorder`, async ({ params, request }) => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const examId = params.examId as string;
    const { orderedIds } = (await request.json()) as { orderedIds: string[] };
    const byId = new Map((questionsByExam.get(examId) ?? []).map((q) => [q.id, q]));
    const reordered = orderedIds
      .map((id, index) => {
        const q = byId.get(id);
        return q ? { ...q, order: index + 1 } : null;
      })
      .filter((q): q is Question => q !== null);
    questionsByExam.set(examId, reordered);
    return HttpResponse.json({ questions: reordered });
  }),

  http.post(`${API}/exams/:examId/questions`, async ({ params, request }) => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const examId = params.examId as string;
    const body = (await request.json()) as Omit<Question, "id" | "examId" | "order">;
    capturedRequests.questionCreate.push(body);
    const existing = questionsByExam.get(examId) ?? [];
    const question: Question = {
      id: nextId("q"),
      examId,
      order: existing.length + 1,
      options: null,
      points: 1,
      ...body,
    };
    questionsByExam.set(examId, [...existing, question]);
    syncQuestionCount(examId);
    return HttpResponse.json({ question }, { status: 201 });
  }),

  http.put(`${API}/exams/:examId/questions/:questionId`, async ({ params, request }) => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const examId = params.examId as string;
    const list = questionsByExam.get(examId) ?? [];
    const index = list.findIndex((q) => q.id === params.questionId);
    if (index < 0) {
      return HttpResponse.json({ error: "Question not found" }, { status: 404 });
    }
    const body = (await request.json()) as Partial<Question>;
    list[index] = { ...list[index], ...body };
    questionsByExam.set(examId, list);
    return HttpResponse.json({ question: list[index] });
  }),

  http.delete(`${API}/exams/:examId/questions/:questionId`, ({ params }) => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const examId = params.examId as string;
    const list = questionsByExam.get(examId) ?? [];
    questionsByExam.set(
      examId,
      list.filter((q) => q.id !== params.questionId),
    );
    syncQuestionCount(examId);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/students`, () => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return HttpResponse.json({ students: studentFixtures });
  }),

  http.get(`${API}/exams/:examId/students`, ({ params }) => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const ids = assignmentsByExam.get(params.examId as string) ?? new Set<string>();
    const students = studentFixtures
      .filter((s) => ids.has(s.id))
      .map((student) => ({ assignedAt: new Date().toISOString(), student }));
    return HttpResponse.json({ students });
  }),

  http.post(`${API}/exams/:examId/students`, async ({ params, request }) => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const examId = params.examId as string;
    const body = (await request.json()) as { studentIds: string[] };
    const set = assignmentsByExam.get(examId) ?? new Set<string>();
    for (const id of body.studentIds) set.add(id);
    assignmentsByExam.set(examId, set);
    syncAssignmentCount(examId);
    return HttpResponse.json({ assigned: body.studentIds.length }, { status: 201 });
  }),

  http.delete(`${API}/exams/:examId/students/:studentId`, ({ params }) => {
    if (!activeSession || activeSession.role === "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const examId = params.examId as string;
    const set = assignmentsByExam.get(examId);
    set?.delete(params.studentId as string);
    syncAssignmentCount(examId);
    return new HttpResponse(null, { status: 204 });
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

  http.get(`${API}/student/dashboard`, () => {
    if (!activeSession || activeSession.role !== "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return HttpResponse.json({ exams: buildStudentDashboard() });
  }),

  http.post(`${API}/exams/:examId/attempt`, ({ params }) => {
    if (!activeSession || activeSession.role !== "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const examId = params.examId as string;
    const exam = visibleExams().find((e) => e.id === examId);
    if (!exam) return HttpResponse.json({ error: "Not found" }, { status: 404 });

    if (exam.startsAt && Date.now() < new Date(exam.startsAt).getTime()) {
      return HttpResponse.json({ error: "Not started" }, { status: 403 });
    }

    const key = attemptKey(activeSession.id, examId);
    const existing = attemptsByKey.get(key);
    if (existing?.submittedAt) {
      return HttpResponse.json({ error: "Already submitted" }, { status: 409 });
    }
    if (existing) {
      return HttpResponse.json({ attempt: existing });
    }

    const startedAt = new Date().toISOString();
    const deadline = new Date(
      Date.now() + exam.durationMin * 60_000,
    ).toISOString();
    const attempt: Attempt = {
      id: nextId("att"),
      examId,
      startedAt,
      deadline,
      submittedAt: null,
      score: null,
      remainingMs: exam.durationMin * 60_000,
      answers: [],
    };
    attemptsByKey.set(key, attempt);
    return HttpResponse.json({ attempt }, { status: 201 });
  }),

  http.get(`${API}/exams/:examId/attempt`, ({ params }) => {
    if (!activeSession || activeSession.role !== "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const key = attemptKey(activeSession.id, params.examId as string);
    const attempt = attemptsByKey.get(key);
    if (!attempt) return HttpResponse.json({ error: "Not found" }, { status: 404 });
    return HttpResponse.json({ attempt });
  }),

  http.put(`${API}/exams/:examId/attempt/answers/:questionId`, async ({ params, request }) => {
    if (!activeSession || activeSession.role !== "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const key = attemptKey(activeSession.id, params.examId as string);
    const attempt = attemptsByKey.get(key);
    if (!attempt || attempt.submittedAt) {
      return HttpResponse.json({ error: "Conflict" }, { status: 409 });
    }
    const { value } = (await request.json()) as { value: string };
    const questionId = params.questionId as string;
    const answers = [...attempt.answers];
    const idx = answers.findIndex((a) => a.questionId === questionId);
    if (idx >= 0) answers[idx] = { questionId, value };
    else answers.push({ questionId, value });
    attemptsByKey.set(key, { ...attempt, answers });
    return HttpResponse.json({ answer: { questionId, value } });
  }),

  http.post(`${API}/exams/:examId/attempt/submit`, ({ params }) => {
    if (!activeSession || activeSession.role !== "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const examId = params.examId as string;
    const key = attemptKey(activeSession.id, examId);
    const attempt = attemptsByKey.get(key);
    if (!attempt) return HttpResponse.json({ error: "Not found" }, { status: 404 });
    if (attempt.submittedAt) {
      return HttpResponse.json({ attempt });
    }
    const result = gradeAttempt(examId, attempt);
    const submitted: Attempt = {
      ...attempt,
      submittedAt: new Date().toISOString(),
      score: result.score,
      remainingMs: 0,
      answers: attempt.answers.map((a) => {
        const q = (questionsByExam.get(examId) ?? []).find((x) => x.id === a.questionId);
        return { ...a, isCorrect: q ? a.value === q.correctAnswer : false };
      }),
    };
    attemptsByKey.set(key, submitted);
    return HttpResponse.json({ attempt: submitted });
  }),

  http.get(`${API}/exams/:examId/attempt/result`, ({ params }) => {
    if (!activeSession || activeSession.role !== "student") {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const examId = params.examId as string;
    const key = attemptKey(activeSession.id, examId);
    const attempt = attemptsByKey.get(key);
    if (!attempt) return HttpResponse.json({ error: "Not found" }, { status: 404 });
    if (!attempt.submittedAt) {
      return HttpResponse.json({ error: "Not submitted" }, { status: 409 });
    }
    return HttpResponse.json({ result: gradeAttempt(examId, attempt) });
  }),
];

export const server = setupServer(...handlers);
