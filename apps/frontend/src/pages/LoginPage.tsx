import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { Logo } from "../components/Logo";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SegmentedControl, type SegmentOption } from "../components/ui/SegmentedControl";
import { TextField } from "../components/ui/TextField";

type Audience = "student" | "staff";

type LocationState = { from?: { pathname: string } } | null;

const AUDIENCE_OPTIONS: SegmentOption<Audience>[] = [
  { id: "student", label: "Student" },
  { id: "staff", label: "Staff" },
];

const AUDIENCE_FIELD: Record<
  Audience,
  { label: string; placeholder: string; type: string; hint: string }
> = {
  student: {
    label: "Matriculation number / Email",
    placeholder: "MAT2024001 or name@stud.examflow.edu",
    type: "text",
    hint: "Students sign in with their matriculation number or student email.",
  },
  staff: {
    label: "Email",
    placeholder: "name@examflow.edu",
    type: "email",
    hint: "Admins and teachers sign in with their email address.",
  },
};

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [audience, setAudience] = useState<Audience>("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as LocationState)?.from?.pathname ?? "/dashboard";

  // Already signed in (e.g. restored session): skip the form.
  if (status === "authenticated") {
    return <Navigate to={redirectTo} replace />;
  }

  const field = AUDIENCE_FIELD[audience];

  const handleAudienceChange = (next: Audience) => {
    setAudience(next);
    setIdentifier("");
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ identifier, password });
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Sign in to continue to ExamFlow.
            </p>
          </div>

          <div className="mb-5">
            <SegmentedControl
              label="Sign in as"
              options={AUDIENCE_OPTIONS}
              value={audience}
              onChange={handleAudienceChange}
            />
          </div>

          <form onSubmit={handleSubmit} aria-label="Sign in" className="flex flex-col gap-4">
            <TextField
              label={field.label}
              name="identifier"
              type={field.type}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={field.placeholder}
              hint={field.hint}
              autoComplete="username"
              required
            />

            <TextField
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400"
              >
                {error}
              </p>
            )}

            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
