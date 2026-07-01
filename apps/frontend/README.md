# ExamFlow — Frontend

The ExamFlow web client: a single-page React app that adapts to whoever signs in — an admin's user management, a teacher's exam builder, or a student's timed exam-taking flow.

For the project overview and setup, see the [root README](../../README.md). This document covers frontend-specific details.

---

## Stack

- **React 19** with **Vite** for dev and builds
- **Redux Toolkit + RTK Query** for state and data fetching/caching
- **React Router 7** for routing
- **Tailwind CSS** for styling, with a light/dark theme
- **dnd-kit** for drag-to-reorder questions
- **TanStack Virtual** for smooth long lists (e.g. the user list)
- **Vitest + Testing Library + MSW** for tests

---

## Layout

```
src/
├── main.tsx        # App bootstrap: providers (store, auth, theme, toasts) + router
├── App.tsx         # Route table and role-based route protection
├── pages/          # One component per screen (dashboard, exam editor, exam-taking, …)
├── components/     # Reusable UI — grouped into ui/, exams/, analytics/, users/
├── store/          # RTK Query API slices, one per resource
├── auth/           # Auth context, provider, and the ProtectedRoute guard
├── context/        # Theme and toast providers
├── hooks/          # Small shared hooks (countdown, clone, theme, toast)
├── lib/            # Pure helpers (formatting, exam rules, class-name utils)
├── api/            # The low-level fetch client used for auth calls
└── types/          # Local view-model types
```

---

## How it works

### Routing and access control

`App.tsx` defines the routes. Protected screens are wrapped in `ProtectedRoute`, which waits for the session check, then either renders the screen, redirects to `/login`, or bounces to the dashboard if the user's role isn't allowed. The landing route sends visitors straight to their dashboard or to login, so there's no visible detour through a protected page.

### Authentication

Auth is cookie-based, so there's no token to manage in the client. On startup, `AuthProvider` calls `GET /me` to restore the session from the HttpOnly cookie — a valid cookie yields the current user, a missing/expired one leaves you logged out. Every request is sent with credentials so the cookie rides along automatically.

### Data fetching

All server communication goes through a single RTK Query API slice (`store/api.ts`), with per-resource endpoints injected from their own files (`examsApi`, `questionsApi`, `attemptsApi`, …). This gives caching, automatic refetching, and tag-based invalidation for free. On login/logout the cache is reset so one user never sees another's data.

### Theming

Light mode is the default. Users can switch between light, dark, and system, and the choice is persisted. An inline script in `index.html` applies the saved theme before React mounts to avoid a flash of the wrong theme.

---

## Environment variables

The client reads a single build-time variable:

| Variable       | Default                 | Purpose                        |
| -------------- | ----------------------- | ------------------------------ |
| `VITE_API_URL` | `http://localhost:3000` | Base URL of the ExamFlow API   |

Because it's inlined at build time, changing it requires a rebuild. For local development the default matches the backend dev server, so no configuration is needed. To override, create `.env.local`:

```bash
echo 'VITE_API_URL=https://your-api.example.com' > .env.local
```

---

## Scripts

| Command              | What it does                          |
| -------------------- | ------------------------------------- |
| `npm run dev`        | Start the Vite dev server (port 5173) |
| `npm run build`      | Type-check and build for production    |
| `npm run preview`    | Preview the production build locally  |
| `npm run test`       | Run the test suite once               |
| `npm run test:watch` | Run tests in watch mode                |
| `npm run lint`       | Lint the source                        |

---

## Testing

Tests run on Vitest with Testing Library for rendering and MSW to mock the API at the network layer, so components are exercised the way a browser would use them.

```bash
npm run test
```
