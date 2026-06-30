# ExamFlow

Monorepo for the ExamFlow application.

## Structure

```
examflow/
├── apps/
│   ├── frontend/     # Web client
│   └── backend/      # API server
└── packages/
    └── shared-types/ # Shared TypeScript types
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- npm (v9+ recommended for workspace support)

## Getting Started

Install dependencies from the repository root:

```bash
npm install
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:frontend` | Start the frontend dev server |
| `npm run dev:backend` | Start the backend dev server |
| `npm run build` | Build all workspaces |

## Workspaces

This project uses [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces). Packages are scoped under `@examflow/*`:

- `@examflow/frontend`
- `@examflow/backend`
- `@examflow/shared-types`

Run a script in a specific workspace:

```bash
npm run <script> --workspace=@examflow/frontend
```
