# ExamFlow — Backend

The ExamFlow API: a REST service built on Express and Prisma that owns authentication, the exam domain, and grading. Every route is role-guarded, and the whole surface is documented with OpenAPI.

For the project overview and setup, see the [root README](../../README.md). This document covers backend-specific details.

---

## Stack

- **Express 5** for routing and middleware
- **Prisma 7** as the ORM, talking to **PostgreSQL** through the `pg` driver adapter
- **Zod** for request validation
- **JWT** (via `jsonwebtoken`) for stateless sessions, stored in an HttpOnly cookie
- **bcryptjs** for password hashing
- **swagger-ui-express** for interactive API docs

---

## Layout

```
src/
├── index.ts          # Entry point: starts the HTTP server
├── app.ts            # Builds the Express app (CORS, cookies, routes, error handler)
├── openapi.ts        # Hand-written OpenAPI 3 document
├── routes/           # One router per resource (auth, exams, attempts, admin, …)
├── middleware/       # Auth guards and the exam-loading/authorization helpers
├── lib/              # Domain logic: grading, access rules, provisioning, env, prisma
├── validation/       # Zod schemas for request bodies and queries
└── generated/        # Prisma client (generated — do not edit)
```

The routing is layered: `app.ts` mounts top-level routers, and exam-scoped concerns (questions, assignments, attempts, analytics) are nested routers under `/exams/:examId` that inherit the parent's auth. Anything that reads or writes an exam runs through `loadExam` + an access check (`requireExamWrite`) so ownership rules live in one place.

---

## Authentication & authorization

- Logging in (`POST /auth/login`) verifies the password and sets an HttpOnly `examflow_token` cookie containing a signed JWT. The token is never exposed to JavaScript.
- You can log in with either an **email** or a **matriculation number** plus the password.
- Requests are authorized by middleware: `requireAuth`, then role guards (`requireAdmin`, `requireStaff`, `requireStudent`) or the exam ownership guard where relevant.
- Access rules, in short:
  - **Admin** — full read/write on any exam; manages users.
  - **Teacher** — reads and writes only the exams they created.
  - **Student** — reads only exams they're assigned to; can take them, never edit.
- Exam-scoped endpoints respond `404` (not `403`) when you lack access, so the API never leaks whether a resource exists.

---

## Data model

Managed by Prisma (`prisma/schema.prisma`). The core entities:

- **User** — has a role (`admin` / `teacher` / `student`), an optional matriculation number, and a soft-delete marker (`deactivatedAt`) instead of hard deletion.
- **Exam** — owned by its creator; carries a status (`draft` / `published`), a duration, an optional scheduled `startsAt`, and a `maxAttempts` policy (null = unlimited).
- **Question** — belongs to an exam; `mcq` or `true_false`, with options, a correct answer, an order, and points.
- **ExamAssignment** — the join table deciding which students may see an exam.
- **Attempt** — a student's run at an exam, with a score once submitted.
- **Answer** — one response within an attempt, graded at submit time.

Grading and attempt lifecycle (resume, expiry, auto-submit, best-attempt selection) live in `lib/attempt.ts` and `lib/analytics.ts` rather than in the routes.

---

## API documentation

With the server running:

- **Swagger UI** — http://localhost:3000/docs
- **Raw spec** — http://localhost:3000/openapi.json
- **Health check** — http://localhost:3000/health

---

## Environment variables

Copy `.env.example` to `.env` and fill in the values.

| Variable            | Required | Default              | Purpose                                                        |
| ------------------- | -------- | -------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`      | yes      | —                    | PostgreSQL connection string                                   |
| `JWT_SECRET`        | yes      | —                    | Secret used to sign session tokens                             |
| `PORT`              | no       | `3000`               | Port the API listens on                                        |
| `NODE_ENV`          | no       | `development`        | In `production`, cookies become `Secure` + `SameSite=None`     |
| `CORS_ORIGIN`       | no       | `http://localhost:5173` | Comma-separated browser origins allowed to send credentials |
| `JWT_EXPIRES_IN`    | no       | `1d`                 | Session token lifetime                                          |
| `AUTH_COOKIE_NAME`  | no       | `examflow_token`     | Name of the auth cookie                                         |
| `SEED_ADMIN_PASSWORD` / `SEED_TEACHER_PASSWORD` / `SEED_STUDENT_PASSWORD` | no | `admin123` / `teacher123` / `student123` | Passwords for the seeded demo accounts |

---

## Scripts

| Command                    | What it does                                          |
| -------------------------- | ---------------------------------------------------- |
| `npm run dev`              | Start the API in watch mode (`tsx`)                  |
| `npm run build`            | Generate the Prisma client and compile TypeScript   |
| `npm run start`            | Run the compiled server from `dist/`                |
| `npm run test`             | Run the integration test suite                       |
| `npm run lint`             | Lint the source                                       |
| `npm run db:migrate`       | Create/apply a migration against the dev database    |
| `npm run db:migrate:deploy`| Apply pending migrations (used in deploys)           |
| `npm run db:seed`          | Seed demo users and exams                             |
| `npm run db:studio`        | Browse the database in Prisma Studio                 |
| `npm run db:check`         | Sanity-check the database connection                 |

---

## Database workflow

The Prisma client is generated into `src/generated` and is created automatically on `npm install` (via `postinstall`) and on `build`. When you change `schema.prisma`:

```bash
npm run db:migrate          # creates a migration + regenerates the client
```

In CI or a fresh deploy, apply existing migrations without prompting:

```bash
npm run db:migrate:deploy
```

---

## Testing

Tests use Node's built-in test runner with `supertest` to exercise the HTTP layer against a real database. Point `DATABASE_URL` at a disposable database before running:

```bash
npm run test
```
