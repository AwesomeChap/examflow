# ExamFlow

A role-based exam platform: admins provision accounts, teachers build and schedule exams, and students sit them in a timed, auto-graded flow — each role sees only what belongs to it.

## Live demo

| | URL |
| --- | --- |
| Web app | https://examflow-web-e34w.onrender.com |
| API | https://examflow-api.onrender.com |
| API docs | https://examflow-api.onrender.com/docs |

The API runs on Render’s free tier, so the first request after idle time can take ~30–60 seconds to wake up.

---

## What it does

ExamFlow covers the full lifecycle of an assessment, from creating the people involved to reviewing how a class performed. Everything is scoped by role, so the same app behaves differently depending on who signs in.

### Admins

- Provision teacher and student accounts. You supply a name, a role, and an initial password; ExamFlow generates the email (and, for students, a matriculation number like `MAT2026001`) so identifiers stay consistent and unique.
- Deactivate and reactivate accounts. Users are never hard-deleted — deactivation is a soft flag, so emails and matriculation numbers are never recycled.
- See a system overview: how many admins, teachers, and students are active, and how many exams exist.

### Teachers

- Author exams as drafts, then publish them when they're ready to go live.
- Add multiple-choice and true/false questions, reorder them by dragging, and set per-question points.
- Configure how an exam runs: a time limit, an optional scheduled open time, and how many attempts each student gets (including unlimited).
- Assign specific students to an exam — only assigned students can see or take it.
- Review analytics once results come in: attempt counts, average score, score distribution, and per-question correctness.

Teachers only ever see and touch their own exams.

### Students

- See the exams they've been assigned, with a countdown for anything scheduled to open later.
- Take an exam under a server-enforced timer. Answers are saved as you go, and the attempt auto-submits if the clock runs out.
- Retake exams up to the allowed limit and review each attempt's graded result, question by question.

Grading happens automatically on submit, so results are available immediately.

---

## How it fits together

ExamFlow is a TypeScript monorepo with a clear split between the API and the web client.

```
examflow/
├── apps/
│   ├── backend/      # Express + Prisma API (REST, cookie-based auth)
│   └── frontend/     # React + Vite single-page app
└── packages/
    └── shared-types/ # TypeScript types shared across the two
```

- The **backend** is a REST API backed by PostgreSQL through Prisma. Authentication is a JWT carried in an HttpOnly cookie, and every route is guarded by role. It ships an OpenAPI spec and interactive docs.
- The **frontend** is a single-page React app that talks to the API with credentials (the auth cookie rides along automatically). Data fetching and caching go through RTK Query.
- **shared-types** holds the domain types (users, exams, questions, attempts, …) so the client and server agree on shapes.

Each app has its own README with the details:

- [Backend README](apps/backend/README.md) — API architecture, data model, auth, and database workflow.
- [Frontend README](apps/frontend/README.md) — app structure, routing, state, and theming.

---

## Tech at a glance

| Area       | Stack                                                        |
| ---------- | ----------------------------------------------------------- |
| Backend    | Node.js, Express 5, Prisma 7, PostgreSQL, Zod, JWT          |
| Frontend   | React 19, Vite, Redux Toolkit (RTK Query), React Router 7, Tailwind CSS |
| Language   | TypeScript across the board                                 |
| Tooling    | npm workspaces, ESLint, Prettier                           |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- npm 9+ (for workspace support)
- Docker (for a local PostgreSQL), or your own PostgreSQL instance

### 1. Install

From the repository root — this installs every workspace at once:

```bash
npm install
```

### 2. Start a database

The included Compose file runs PostgreSQL on host port `5433`:

```bash
npm run db:up
```

### 3. Configure the backend

Copy the example env file and adjust if needed. The defaults line up with the Docker database above.

```bash
cp apps/backend/.env.example apps/backend/.env
```

At minimum, `DATABASE_URL` and `JWT_SECRET` must be set. See the [backend README](apps/backend/README.md) for the full list.

### 4. Apply migrations and seed

```bash
npm run db:migrate   # create the schema
npm run db:seed      # add demo users and exams
```

### 5. Run the apps

In two terminals:

```bash
npm run dev:backend    # API on http://localhost:3000
npm run dev:frontend   # web app on http://localhost:5173
```

Open http://localhost:5173 and sign in.

### Demo accounts

The seed creates one of each role (passwords are configurable via `SEED_*` env vars, shown here as their defaults):

| Role    | Login                      | Password     |
| ------- | -------------------------- | ------------ |
| Admin   | `admin@examflow.edu`       | `admin123`   |
| Teacher | `jane@examflow.edu`        | `teacher123` |
| Student | `alice@stud.examflow.edu`  | `student123` |

Students can also sign in with their matriculation number instead of email.

---

## Common scripts

Run these from the repository root:

| Command                   | What it does                              |
| ------------------------- | ----------------------------------------- |
| `npm run dev:backend`     | Start the API in watch mode               |
| `npm run dev:frontend`    | Start the web app in watch mode           |
| `npm run build`           | Build every workspace                     |
| `npm run lint`            | Lint every workspace                      |
| `npm run db:up`           | Start the local PostgreSQL container      |
| `npm run db:migrate`      | Apply migrations to the dev database      |
| `npm run db:seed`         | Seed demo data                            |
| `npm run db:studio`       | Open Prisma Studio to browse the database |

To run a script in a single workspace, target it directly:

```bash
npm run test --workspace=@examflow/backend
npm run test --workspace=@examflow/frontend
```

---

## Testing

Both apps carry their own suites:

```bash
npm run test --workspace=@examflow/backend    # API integration tests
npm run test --workspace=@examflow/frontend   # component + hook tests
```

---

## Deployment

The repo includes a [`render.yaml`](render.yaml) blueprint that provisions a PostgreSQL database, the API, and the static web app on [Render](https://render.com). It's a good reference even if you deploy elsewhere: it shows the build/start commands, the environment variables each service needs, and how the two apps reference each other's URLs.
