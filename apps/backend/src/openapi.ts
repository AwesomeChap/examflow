/**
 * OpenAPI 3.0 description of the ExamFlow backend API.
 *
 * This is a single source-of-truth document served by Swagger UI at `/docs`
 * (and as raw JSON at `/openapi.json`). Keep it in sync with the route handlers
 * in `src/routes/*` and the Zod schemas in `src/validation/schemas.ts`.
 *
 * Authentication is a stateless JWT carried in an HttpOnly cookie
 * (`examflow_token`), issued by `POST /auth/login`. Because the cookie is
 * HttpOnly it cannot be set from the Swagger "Authorize" dialog via JS; when
 * trying protected routes from the browser, log in first (the browser stores
 * the cookie and sends it automatically on same-site requests).
 */

const bearerlessCookieNote =
  "Requires the `examflow_token` session cookie set by `POST /auth/login`.";

/** Standard `{ error, ...extra }` response body used by every failure path. */
const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
});

const jsonBody = (schemaRef: string) => ({
  required: true,
  content: {
    "application/json": {
      schema: { $ref: schemaRef },
    },
  },
});

const jsonResponse = (description: string, schemaRef: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: schemaRef },
    },
  },
});

const examIdParam = {
  name: "examId",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Exam id (cuid).",
} as const;

const pageParams = [
  {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
    description: "1-based page number.",
  },
  {
    name: "pageSize",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
    description: "Items per page.",
  },
] as const;

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "ExamFlow API",
    version: "1.0.0",
    description:
      "REST API for ExamFlow — an exam authoring, assignment, and taking platform.\n\n" +
      "**Authentication.** Log in via `POST /auth/login`; the server sets an HttpOnly " +
      "`examflow_token` cookie that authorizes subsequent requests. Roles are `admin`, " +
      "`teacher`, and `student`; most endpoints are role-scoped.",
  },
  servers: [{ url: "http://localhost:3000", description: "Local development" }],
  tags: [
    { name: "Health", description: "Service liveness." },
    { name: "Auth", description: "Login, logout, and current session." },
    { name: "Admin", description: "User management (admin only)." },
    { name: "Teacher", description: "Teacher/staff dashboard." },
    { name: "Student", description: "Student dashboard and results." },
    { name: "Exams", description: "Exam CRUD (role-scoped visibility)." },
    { name: "Questions", description: "Questions nested under an exam." },
    { name: "Assignments", description: "Assigning students to an exam." },
    { name: "Attempts", description: "Taking exams and reading results." },
    { name: "Analytics", description: "Per-exam analytics (staff only)." },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness check",
        security: [],
        responses: {
          200: {
            description: "Service is up.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },

    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in and receive the session cookie",
        security: [],
        requestBody: jsonBody("#/components/schemas/LoginInput"),
        responses: {
          200: {
            description: "Authenticated. Sets the HttpOnly `examflow_token` cookie.",
            headers: {
              "Set-Cookie": {
                description: "examflow_token=<jwt>; HttpOnly; Path=/; SameSite=Lax",
                schema: { type: "string" },
              },
            },
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { user: { $ref: "#/components/schemas/PublicUser" } },
                },
              },
            },
          },
          400: errorResponse("Validation failed."),
          401: errorResponse("Invalid credentials (or the account is deactivated)."),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out (clears the session cookie)",
        security: [],
        responses: {
          200: {
            description: "Session cleared.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean", example: true } },
                },
              },
            },
          },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user (alias of GET /me)",
        description: bearerlessCookieNote,
        responses: {
          200: jsonResponse("The authenticated user.", "#/components/schemas/CurrentUserResponse"),
          401: errorResponse("Not authenticated or account deactivated."),
        },
      },
    },
    "/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user",
        description: bearerlessCookieNote,
        responses: {
          200: jsonResponse("The authenticated user.", "#/components/schemas/CurrentUserResponse"),
          401: errorResponse("Not authenticated or account deactivated."),
        },
      },
    },

    "/admin/dashboard": {
      get: {
        tags: ["Admin"],
        summary: "Active-user counts and exam total",
        responses: {
          200: jsonResponse("Dashboard counts.", "#/components/schemas/AdminDashboard"),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not an admin."),
        },
      },
    },
    "/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "List users (paginated, optional role filter)",
        parameters: [
          ...pageParams,
          {
            name: "role",
            in: "query",
            schema: { $ref: "#/components/schemas/UserRole" },
            description: "Restrict to a single role.",
          },
        ],
        responses: {
          200: jsonResponse("Paginated users.", "#/components/schemas/AdminUserList"),
          400: errorResponse("Invalid query parameters."),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not an admin."),
        },
      },
      post: {
        tags: ["Admin"],
        summary: "Create a teacher or student",
        description:
          "Email (and, for students, matriculation number) are generated server-side; " +
          "the admin supplies name, role, and initial password.",
        requestBody: jsonBody("#/components/schemas/UserCreateInput"),
        responses: {
          201: jsonResponse("Created user.", "#/components/schemas/AdminUserResponse"),
          400: errorResponse("Validation failed."),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not an admin."),
          409: errorResponse("Unique-constraint conflict."),
        },
      },
    },
    "/admin/users/{userId}": {
      delete: {
        tags: ["Admin"],
        summary: "Deactivate a user (soft delete)",
        description:
          "Sets `deactivatedAt`; identifiers are never reused. Admins cannot deactivate " +
          "themselves or other admins.",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: jsonResponse("Deactivated user.", "#/components/schemas/AdminUserResponse"),
          400: errorResponse("Cannot deactivate your own account."),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not an admin, or target is an admin."),
          404: errorResponse("User not found."),
        },
      },
    },
    "/admin/users/{userId}/reactivate": {
      post: {
        tags: ["Admin"],
        summary: "Reactivate a previously deactivated user",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: jsonResponse("Reactivated user.", "#/components/schemas/AdminUserResponse"),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not an admin."),
          404: errorResponse("User not found."),
        },
      },
    },

    "/teacher/dashboard": {
      get: {
        tags: ["Teacher"],
        summary: "Teacher/staff greeting payload",
        responses: {
          200: {
            description: "Greeting + role.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    role: { $ref: "#/components/schemas/UserRole" },
                  },
                },
              },
            },
          },
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff."),
        },
      },
    },

    "/student/dashboard": {
      get: {
        tags: ["Student"],
        summary: "Assigned published exams with attempt state",
        description:
          "Returns only published exams assigned to the student. Draft exams are hidden until " +
          "a teacher publishes them.",
        responses: {
          200: {
            description: "The student's assigned, published exams.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    exams: {
                      type: "array",
                      items: { $ref: "#/components/schemas/StudentDashboardExam" },
                    },
                  },
                },
              },
            },
          },
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not a student."),
        },
      },
    },
    "/student/results": {
      get: {
        tags: ["Student"],
        summary: "All submitted attempts across published exams (newest first)",
        description:
          "Only includes results for published exams. Attempts on draft exams are omitted.",
        responses: {
          200: {
            description: "Flat list of submitted attempts.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    results: {
                      type: "array",
                      items: { $ref: "#/components/schemas/StudentResult" },
                    },
                  },
                },
              },
            },
          },
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not a student."),
        },
      },
    },

    "/students": {
      get: {
        tags: ["Student"],
        summary: "List all student accounts (staff only)",
        description: "Used by staff to pick students to assign to an exam.",
        responses: {
          200: {
            description: "Student directory.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    students: {
                      type: "array",
                      items: { $ref: "#/components/schemas/StudentRef" },
                    },
                  },
                },
              },
            },
          },
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff."),
        },
      },
    },

    "/exams": {
      get: {
        tags: ["Exams"],
        summary: "List exams visible to the caller (paginated)",
        description:
          "Admins see all exams; teachers see only their own; students see only published exams " +
          "assigned to them.",
        parameters: [...pageParams],
        responses: {
          200: jsonResponse("Paginated exams.", "#/components/schemas/ExamList"),
          400: errorResponse("Invalid query parameters."),
          401: errorResponse("Not authenticated."),
        },
      },
      post: {
        tags: ["Exams"],
        summary: "Create an exam (staff only)",
        requestBody: jsonBody("#/components/schemas/ExamCreateInput"),
        responses: {
          201: jsonResponse("Created exam.", "#/components/schemas/ExamResponse"),
          400: errorResponse("Validation failed."),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff."),
        },
      },
    },
    "/exams/{examId}": {
      get: {
        tags: ["Exams"],
        summary: "Get one exam with its questions",
        description:
          "Correct answers are stripped from questions for students. Students may only read " +
          "published exams they are assigned to. Returns 404 for both missing and unauthorized " +
          "exams (existence is never leaked).",
        parameters: [examIdParam],
        responses: {
          200: jsonResponse("Exam detail.", "#/components/schemas/ExamDetailResponse"),
          401: errorResponse("Not authenticated."),
          404: errorResponse("Exam not found or not accessible."),
        },
      },
      put: {
        tags: ["Exams"],
        summary: "Update an exam (admin or owning teacher)",
        parameters: [examIdParam],
        requestBody: jsonBody("#/components/schemas/ExamUpdateInput"),
        responses: {
          200: jsonResponse("Updated exam.", "#/components/schemas/ExamResponse"),
          400: errorResponse("Validation failed."),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff / not the owner."),
          404: errorResponse("Exam not found."),
        },
      },
      delete: {
        tags: ["Exams"],
        summary: "Delete an exam (admin or owning teacher)",
        description: "Cascades to questions, assignments, and attempts.",
        parameters: [examIdParam],
        responses: {
          204: { description: "Deleted." },
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff / not the owner."),
          404: errorResponse("Exam not found."),
        },
      },
    },

    "/exams/{examId}/questions": {
      get: {
        tags: ["Questions"],
        summary: "List questions for an exam",
        description: "Correct answers are stripped for students.",
        parameters: [examIdParam],
        responses: {
          200: jsonResponse("Questions.", "#/components/schemas/QuestionListResponse"),
          401: errorResponse("Not authenticated."),
          404: errorResponse("Exam not found or not accessible."),
        },
      },
      post: {
        tags: ["Questions"],
        summary: "Create a question (admin or owning teacher)",
        parameters: [examIdParam],
        requestBody: jsonBody("#/components/schemas/QuestionCreateInput"),
        responses: {
          201: jsonResponse("Created question.", "#/components/schemas/QuestionResponse"),
          400: errorResponse("Validation failed."),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff / not the owner."),
          404: errorResponse("Exam not found."),
        },
      },
    },
    "/exams/{examId}/questions/reorder": {
      post: {
        tags: ["Questions"],
        summary: "Reorder every question of an exam",
        description: "`orderedIds` must list each existing question id exactly once.",
        parameters: [examIdParam],
        requestBody: jsonBody("#/components/schemas/QuestionReorderInput"),
        responses: {
          200: jsonResponse("Reordered questions.", "#/components/schemas/QuestionListResponse"),
          400: errorResponse("orderedIds is not a valid permutation."),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff / not the owner."),
          404: errorResponse("Exam not found."),
        },
      },
    },
    "/exams/{examId}/questions/{questionId}": {
      get: {
        tags: ["Questions"],
        summary: "Get one question",
        parameters: [
          examIdParam,
          { name: "questionId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: jsonResponse("Question.", "#/components/schemas/QuestionResponse"),
          401: errorResponse("Not authenticated."),
          404: errorResponse("Exam or question not found."),
        },
      },
      put: {
        tags: ["Questions"],
        summary: "Update a question (admin or owning teacher)",
        description: "Partial body; the merged result is re-validated for MCQ/True-False shape.",
        parameters: [
          examIdParam,
          { name: "questionId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: jsonBody("#/components/schemas/QuestionPatchInput"),
        responses: {
          200: jsonResponse("Updated question.", "#/components/schemas/QuestionResponse"),
          400: errorResponse("Validation failed."),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff / not the owner."),
          404: errorResponse("Exam or question not found."),
        },
      },
      delete: {
        tags: ["Questions"],
        summary: "Delete a question (admin or owning teacher)",
        parameters: [
          examIdParam,
          { name: "questionId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          204: { description: "Deleted." },
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff / not the owner."),
          404: errorResponse("Exam or question not found."),
        },
      },
    },

    "/exams/{examId}/students": {
      get: {
        tags: ["Assignments"],
        summary: "List students assigned to an exam (staff only)",
        parameters: [examIdParam],
        responses: {
          200: {
            description: "Assigned students.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    students: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Assignment" },
                    },
                  },
                },
              },
            },
          },
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff / not the owner."),
          404: errorResponse("Exam not found."),
        },
      },
      post: {
        tags: ["Assignments"],
        summary: "Assign one or more students to an exam",
        parameters: [examIdParam],
        requestBody: jsonBody("#/components/schemas/AssignStudentsInput"),
        responses: {
          201: {
            description: "Assigned (duplicates are ignored).",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { assigned: { type: "integer", example: 3 } },
                },
              },
            },
          },
          400: errorResponse("Validation failed, or some ids are not valid students."),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff / not the owner."),
          404: errorResponse("Exam not found."),
        },
      },
    },
    "/exams/{examId}/students/{studentId}": {
      delete: {
        tags: ["Assignments"],
        summary: "Unassign a student from an exam",
        parameters: [
          examIdParam,
          { name: "studentId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          204: { description: "Unassigned." },
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff / not the owner."),
          404: errorResponse("Exam or assignment not found."),
        },
      },
    },

    "/exams/{examId}/attempt": {
      post: {
        tags: ["Attempts"],
        summary: "Start or resume an attempt (student only)",
        description:
          "Resumes the active attempt if one is open; otherwise starts a new one, enforcing " +
          "the exam's `maxAttempts` policy (null = unlimited). Expired active attempts are " +
          "auto-submitted and still count toward the limit.",
        parameters: [examIdParam],
        responses: {
          200: jsonResponse("Resumed active attempt.", "#/components/schemas/AttemptResponse"),
          201: jsonResponse("New attempt started.", "#/components/schemas/AttemptResponse"),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not a student, or the exam has not started yet."),
          404: errorResponse("Exam not found or not assigned."),
          409: errorResponse("No attempts remaining."),
        },
      },
      get: {
        tags: ["Attempts"],
        summary: "Read the active attempt (auto-finalizes if expired)",
        parameters: [examIdParam],
        responses: {
          200: jsonResponse("Active attempt.", "#/components/schemas/AttemptResponse"),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not a student."),
          404: errorResponse("No active attempt / exam not accessible."),
        },
      },
    },
    "/exams/{examId}/attempt/answers/{questionId}": {
      put: {
        tags: ["Attempts"],
        summary: "Upsert the answer to one question in the active attempt",
        parameters: [
          examIdParam,
          { name: "questionId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: jsonBody("#/components/schemas/AnswerUpsertInput"),
        responses: {
          200: {
            description: "Stored answer.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    answer: {
                      type: "object",
                      properties: {
                        questionId: { type: "string" },
                        value: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: errorResponse("Invalid answer value for this question."),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not a student."),
          404: errorResponse("Exam, active attempt, or question not found."),
          409: errorResponse("Attempt time limit reached."),
        },
      },
    },
    "/exams/{examId}/attempt/submit": {
      post: {
        tags: ["Attempts"],
        summary: "Submit (grade) the active attempt",
        description: "Idempotent: with no active attempt, returns the most recent submitted one.",
        parameters: [examIdParam],
        responses: {
          200: jsonResponse("Graded attempt.", "#/components/schemas/AttemptResponse"),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not a student."),
          404: errorResponse("No attempt to submit / exam not accessible."),
        },
      },
    },
    "/exams/{examId}/attempts": {
      get: {
        tags: ["Attempts"],
        summary: "List the student's attempts for this exam",
        parameters: [examIdParam],
        responses: {
          200: {
            description: "Attempt summaries (oldest first).",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    attempts: {
                      type: "array",
                      items: { $ref: "#/components/schemas/AttemptSummary" },
                    },
                  },
                },
              },
            },
          },
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not a student."),
          404: errorResponse("Exam not found or not assigned."),
        },
      },
    },
    "/exams/{examId}/attempts/{attemptId}/result": {
      get: {
        tags: ["Attempts"],
        summary: "Get the graded result of one submitted attempt",
        parameters: [
          examIdParam,
          { name: "attemptId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: jsonResponse("Attempt result.", "#/components/schemas/AttemptResultResponse"),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not a student."),
          404: errorResponse("Attempt not found."),
          409: errorResponse("Attempt not yet submitted."),
        },
      },
    },

    "/exams/{examId}/analytics": {
      get: {
        tags: ["Analytics"],
        summary: "Per-exam analytics (admin or owning teacher)",
        description:
          "Scores reflect each student's best submitted attempt; summary counts include all " +
          "attempts. Includes score distribution and per-question correctness.",
        parameters: [examIdParam],
        responses: {
          200: jsonResponse("Analytics.", "#/components/schemas/AnalyticsResponse"),
          401: errorResponse("Not authenticated."),
          403: errorResponse("Not staff / not the owner."),
          404: errorResponse("Exam not found."),
        },
      },
    },
  },

  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "examflow_token",
        description:
          "HttpOnly JWT session cookie issued by POST /auth/login. Sent automatically by the browser.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string", description: "Human-readable message." },
          details: {
            type: "array",
            description: "Present on validation (400) errors.",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                message: { type: "string" },
              },
            },
          },
          target: { description: "Present on unique-constraint (409) errors." },
          invalidIds: {
            type: "array",
            items: { type: "string" },
            description: "Present when assigning non-student ids.",
          },
          startsAt: {
            type: "string",
            format: "date-time",
            description: "Present when an exam has not opened yet.",
          },
        },
      },

      UserRole: { type: "string", enum: ["admin", "teacher", "student"] },

      PublicUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { $ref: "#/components/schemas/UserRole" },
          matriculationNumber: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CurrentUserResponse: {
        type: "object",
        properties: { user: { $ref: "#/components/schemas/PublicUser" } },
      },

      LoginInput: {
        type: "object",
        required: ["password"],
        description: "Provide `identifier` (email or matriculation number). `email` is an alias.",
        properties: {
          identifier: { type: "string", example: "alice@stud.examflow.edu" },
          email: { type: "string", description: "Backward-compatible alias for identifier." },
          password: { type: "string", format: "password", example: "secret123" },
        },
      },

      AdminDashboard: {
        type: "object",
        properties: {
          users: {
            type: "object",
            properties: {
              admins: { type: "integer" },
              teachers: { type: "integer" },
              students: { type: "integer" },
            },
          },
          exams: { type: "integer" },
        },
      },
      AdminUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { $ref: "#/components/schemas/UserRole" },
          matriculationNumber: { type: "string", nullable: true },
          deactivatedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      AdminUserResponse: {
        type: "object",
        properties: { user: { $ref: "#/components/schemas/AdminUser" } },
      },
      AdminUserList: {
        type: "object",
        properties: {
          users: { type: "array", items: { $ref: "#/components/schemas/AdminUser" } },
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
        },
      },
      UserCreateInput: {
        type: "object",
        required: ["name", "role", "password"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          role: { type: "string", enum: ["teacher", "student"] },
          password: { type: "string", format: "password", minLength: 8, maxLength: 200 },
        },
      },

      CreatorRef: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
        },
      },
      StudentRef: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          matriculationNumber: { type: "string", nullable: true },
        },
      },
      ExamCount: {
        type: "object",
        properties: {
          questions: { type: "integer" },
          attempts: { type: "integer" },
          assignments: { type: "integer" },
        },
      },
      ExamStatus: { type: "string", enum: ["draft", "published"] },
      Exam: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          durationMin: { type: "integer" },
          status: { $ref: "#/components/schemas/ExamStatus" },
          startsAt: { type: "string", format: "date-time", nullable: true },
          maxAttempts: {
            type: "integer",
            nullable: true,
            description: "Attempts allowed per student; null = unlimited.",
          },
          createdById: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ExamListItem: {
        allOf: [
          { $ref: "#/components/schemas/Exam" },
          {
            type: "object",
            properties: {
              createdBy: { $ref: "#/components/schemas/CreatorRef" },
              _count: { $ref: "#/components/schemas/ExamCount" },
            },
          },
        ],
      },
      ExamResponse: {
        type: "object",
        properties: { exam: { $ref: "#/components/schemas/Exam" } },
      },
      ExamList: {
        type: "object",
        properties: {
          exams: { type: "array", items: { $ref: "#/components/schemas/ExamListItem" } },
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
        },
      },
      ExamDetailResponse: {
        type: "object",
        properties: {
          exam: {
            allOf: [
              { $ref: "#/components/schemas/ExamListItem" },
              {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Question" },
                  },
                },
              },
            ],
          },
        },
      },
      ExamCreateInput: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 2000, nullable: true },
          durationMin: { type: "integer", minimum: 1, maximum: 1440 },
          status: { $ref: "#/components/schemas/ExamStatus" },
          startsAt: { type: "string", format: "date-time", nullable: true },
          maxAttempts: { type: "integer", minimum: 1, maximum: 100, nullable: true },
        },
      },
      ExamUpdateInput: {
        type: "object",
        description: "At least one field is required.",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 200 },
          description: { type: "string", maxLength: 2000, nullable: true },
          durationMin: { type: "integer", minimum: 1, maximum: 1440 },
          status: { $ref: "#/components/schemas/ExamStatus" },
          startsAt: { type: "string", format: "date-time", nullable: true },
          maxAttempts: { type: "integer", minimum: 1, maximum: 100, nullable: true },
        },
      },

      Question: {
        type: "object",
        description: "`correctAnswer` is omitted in student-facing responses.",
        properties: {
          id: { type: "string" },
          examId: { type: "string" },
          type: { type: "string", enum: ["mcq", "true_false"] },
          text: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
            nullable: true,
            description: "MCQ options; null for true/false questions.",
          },
          correctAnswer: {
            type: "string",
            description: "Only present for staff (admin/teacher).",
          },
          order: { type: "integer" },
          points: { type: "integer" },
        },
      },
      QuestionResponse: {
        type: "object",
        properties: { question: { $ref: "#/components/schemas/Question" } },
      },
      QuestionListResponse: {
        type: "object",
        properties: {
          questions: { type: "array", items: { $ref: "#/components/schemas/Question" } },
        },
      },
      QuestionCreateInput: {
        oneOf: [
          {
            type: "object",
            required: ["type", "text", "options", "correctAnswer"],
            properties: {
              type: { type: "string", enum: ["mcq"] },
              text: { type: "string", minLength: 1, maxLength: 1000 },
              options: {
                type: "array",
                items: { type: "string", minLength: 1, maxLength: 500 },
                minItems: 2,
                maxItems: 10,
              },
              correctAnswer: {
                type: "string",
                description: "Must be one of `options`.",
              },
              order: { type: "integer", minimum: 1 },
              points: { type: "integer", minimum: 1, maximum: 100 },
            },
          },
          {
            type: "object",
            required: ["type", "text", "correctAnswer"],
            properties: {
              type: { type: "string", enum: ["true_false"] },
              text: { type: "string", minLength: 1, maxLength: 1000 },
              correctAnswer: { type: "string", enum: ["true", "false"] },
              order: { type: "integer", minimum: 1 },
              points: { type: "integer", minimum: 1, maximum: 100 },
            },
          },
        ],
      },
      QuestionPatchInput: {
        type: "object",
        description: "Partial update; at least one field required.",
        properties: {
          type: { type: "string", enum: ["mcq", "true_false"] },
          text: { type: "string", minLength: 1, maxLength: 1000 },
          options: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 500 },
            minItems: 2,
            maxItems: 10,
            nullable: true,
          },
          correctAnswer: { type: "string", minLength: 1, maxLength: 500 },
          order: { type: "integer", minimum: 1 },
          points: { type: "integer", minimum: 1, maximum: 100 },
        },
      },
      QuestionReorderInput: {
        type: "object",
        required: ["orderedIds"],
        properties: {
          orderedIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 1000,
          },
        },
      },

      AssignStudentsInput: {
        type: "object",
        required: ["studentIds"],
        properties: {
          studentIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 500,
          },
        },
      },
      Assignment: {
        type: "object",
        properties: {
          assignedAt: { type: "string", format: "date-time" },
          student: { $ref: "#/components/schemas/StudentRef" },
        },
      },

      AnswerUpsertInput: {
        type: "object",
        required: ["value"],
        properties: {
          value: { type: "string", minLength: 1, maxLength: 500 },
        },
      },
      AttemptAnswer: {
        type: "object",
        properties: {
          questionId: { type: "string" },
          value: { type: "string" },
          isCorrect: { type: "boolean", nullable: true },
        },
      },
      Attempt: {
        type: "object",
        properties: {
          id: { type: "string" },
          examId: { type: "string" },
          startedAt: { type: "string", format: "date-time" },
          deadline: { type: "string", format: "date-time" },
          submittedAt: { type: "string", format: "date-time", nullable: true },
          score: { type: "integer", nullable: true },
          remainingMs: { type: "integer" },
          answers: {
            type: "array",
            items: { $ref: "#/components/schemas/AttemptAnswer" },
          },
        },
      },
      AttemptResponse: {
        type: "object",
        properties: { attempt: { $ref: "#/components/schemas/Attempt" } },
      },
      AttemptSummary: {
        type: "object",
        properties: {
          id: { type: "string" },
          examId: { type: "string" },
          attemptNumber: { type: "integer" },
          startedAt: { type: "string", format: "date-time" },
          submittedAt: { type: "string", format: "date-time", nullable: true },
          score: { type: "integer", nullable: true },
          maxScore: { type: "integer" },
          percentage: { type: "number", nullable: true },
        },
      },
      AttemptResultBreakdown: {
        type: "object",
        properties: {
          questionId: { type: "string" },
          points: { type: "integer" },
          awardedPoints: { type: "integer" },
          answered: { type: "boolean" },
          value: { type: "string", nullable: true },
          isCorrect: { type: "boolean", nullable: true },
        },
      },
      AttemptResult: {
        type: "object",
        properties: {
          attemptId: { type: "string" },
          examId: { type: "string" },
          submittedAt: { type: "string", format: "date-time", nullable: true },
          score: { type: "integer" },
          maxScore: { type: "integer" },
          percentage: { type: "number" },
          totalQuestions: { type: "integer" },
          correctCount: { type: "integer" },
          breakdown: {
            type: "array",
            items: { $ref: "#/components/schemas/AttemptResultBreakdown" },
          },
        },
      },
      AttemptResultResponse: {
        type: "object",
        properties: { result: { $ref: "#/components/schemas/AttemptResult" } },
      },

      StudentDashboardExam: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          durationMin: { type: "integer" },
          startsAt: { type: "string", format: "date-time", nullable: true },
          totalQuestions: { type: "integer" },
          isOpen: { type: "boolean" },
          startsInMs: { type: "integer", nullable: true },
          attemptStatus: {
            type: "string",
            enum: ["not_started", "in_progress", "submitted"],
          },
          score: { type: "integer", nullable: true, description: "Best submitted score." },
          maxAttempts: { type: "integer", nullable: true },
          attemptsUsed: { type: "integer" },
          attemptsRemaining: { type: "integer", nullable: true },
          bestAttemptId: { type: "string", nullable: true },
        },
      },
      StudentResult: {
        type: "object",
        properties: {
          id: { type: "string" },
          examId: { type: "string" },
          title: { type: "string" },
          attemptNumber: { type: "integer" },
          score: { type: "integer" },
          maxScore: { type: "integer" },
          percentage: { type: "number" },
          submittedAt: { type: "string", format: "date-time", nullable: true },
        },
      },

      DistributionBand: {
        type: "object",
        properties: {
          label: { type: "string" },
          min: { type: "integer" },
          max: { type: "integer" },
          count: { type: "integer" },
        },
      },
      Analytics: {
        type: "object",
        properties: {
          exam: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              totalQuestions: { type: "integer" },
              maxScore: { type: "integer" },
            },
          },
          attempts: {
            type: "object",
            properties: {
              total: { type: "integer" },
              submitted: { type: "integer" },
              inProgress: { type: "integer" },
              assignedStudents: { type: "integer" },
              completionRate: { type: "number" },
            },
          },
          score: {
            type: "object",
            properties: {
              averageScore: { type: "number" },
              averagePercentage: { type: "number" },
              highestScore: { type: "integer", nullable: true },
              lowestScore: { type: "integer", nullable: true },
              medianScore: { type: "number", nullable: true },
              stdDev: { type: "number" },
              distribution: {
                type: "array",
                items: { $ref: "#/components/schemas/DistributionBand" },
              },
            },
          },
          timing: {
            type: "object",
            properties: {
              averageDurationMs: { type: "number", nullable: true },
              medianDurationMs: { type: "number", nullable: true },
            },
          },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                questionId: { type: "string" },
                order: { type: "integer" },
                text: { type: "string" },
                type: { type: "string", enum: ["mcq", "true_false"] },
                points: { type: "integer" },
                answered: { type: "integer" },
                correct: { type: "integer" },
                correctRate: { type: "number" },
              },
            },
          },
        },
      },
      AnalyticsResponse: {
        type: "object",
        properties: { analytics: { $ref: "#/components/schemas/Analytics" } },
      },
    },
  },

  // Every operation requires the session cookie unless it overrides with
  // `security: []` (health, login, logout, and the public /me variants document
  // their own 401s).
  security: [{ cookieAuth: [] }],
} as const;
