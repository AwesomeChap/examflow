import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../hooks/useToast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SegmentedControl, type SegmentOption } from "../components/ui/SegmentedControl";
import { TextField } from "../components/ui/TextField";
import { useCreateUserMutation } from "../store/usersApi";

type NewUserRole = "student" | "teacher";

const ROLE_OPTIONS: SegmentOption<NewUserRole>[] = [
  { id: "student", label: "Student" },
  { id: "teacher", label: "Teacher" },
];

/**
 * Admin-only form to provision a teacher or student. The email (and, for
 * students, the matriculation number) are generated server-side; the admin only
 * supplies a name, role, and initial password.
 */
export function CreateUserPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [createUser, { isLoading }] = useCreateUserMutation();

  const [name, setName] = useState("");
  const [role, setRole] = useState<NewUserRole>("student");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      const user = await createUser({ name: name.trim(), role, password }).unwrap();
      const details = user.matriculationNumber
        ? `${user.email} · ${user.matriculationNumber}`
        : user.email;
      notify({
        message: `Created ${user.name}: ${details}`,
        variant: "success",
      });
      navigate("/dashboard");
    } catch {
      setError("Could not create the user. Please check the details and try again.");
    }
  };

  return (
    <section className="mx-auto max-w-lg">
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Create user</h1>
      <p className="mb-6 text-slate-600 dark:text-slate-400">
        The email address is generated automatically. Students also receive a matriculation number.
      </p>

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} aria-label="Create user" className="flex flex-col gap-5">
          <TextField
            label="Full name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alice Johnson"
            autoComplete="off"
            required
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Role</span>
            <SegmentedControl label="Role" options={ROLE_OPTIONS} value={role} onChange={setRole} />
          </div>

          <TextField
            label="Initial password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="At least 8 characters. Share it securely with the user."
            autoComplete="new-password"
            minLength={8}
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

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating…" : "Create user"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/dashboard")}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
