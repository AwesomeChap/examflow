import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp, submitLogin } from "./render";
import { TEST_USERS, requestCredentials } from "./server";

describe("login flow", () => {
  it.each([
    { role: "admin", audience: "staff" as const, identifier: TEST_USERS.admin.email },
    { role: "teacher", audience: "staff" as const, identifier: TEST_USERS.teacher.email },
    {
      role: "student",
      audience: "student" as const,
      identifier: TEST_USERS.student.matriculationNumber!,
    },
  ])("logs in a $role and lands on their dashboard", async ({ role, audience, identifier }) => {
    const account = TEST_USERS[role as keyof typeof TEST_USERS];
    const { user } = renderApp("/login");

    await submitLogin(user, { audience, identifier, password: account.password });

    expect(await screen.findByText(`Welcome back, ${account.name}`)).toBeInTheDocument();
    expect(screen.getByText(`${role} dashboard`)).toBeInTheDocument();
    expect(screen.getByTestId("current-user")).toHaveTextContent(`${account.name} (${role})`);
  });

  it("swaps the identifier field when switching between Student and Staff", async () => {
    const { user } = renderApp("/login");

    // Student is the default selection.
    expect(screen.getByLabelText(/matriculation number/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /staff/i }));

    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/matriculation number/i)).not.toBeInTheDocument();
  });

  it("lets a student sign in with their student email", async () => {
    const account = TEST_USERS.student;
    const { user } = renderApp("/login");

    // Default Student tab; matriculation field also accepts a student email.
    await user.type(screen.getByLabelText(/matriculation number/i), account.email);
    await user.type(screen.getByLabelText(/^password$/i), account.password);
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(`Welcome back, ${account.name}`)).toBeInTheDocument();
  });

  it("supports keyboard navigation on the Student/Staff selector (radio group)", async () => {
    const { user } = renderApp("/login");

    const studentRadio = screen.getByRole("radio", { name: /student/i });
    expect(studentRadio).toHaveAttribute("aria-checked", "true");

    studentRadio.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("radio", { name: /staff/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
  });

  it("shows an error and stays on the login page for bad credentials", async () => {
    const { user } = renderApp("/login");

    await submitLogin(user, {
      audience: "staff",
      identifier: TEST_USERS.admin.email,
      password: "wrong-password",
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid credentials/i);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText(/welcome back,/i)).not.toBeInTheDocument();
  });

  it("sends login requests with credentials so the auth cookie round-trips", async () => {
    const account = TEST_USERS.admin;
    const { user } = renderApp("/login");

    await submitLogin(user, {
      audience: "staff",
      identifier: account.email,
      password: account.password,
    });
    await screen.findByText(`Welcome back, ${account.name}`);

    expect(requestCredentials["/auth/login"]).toBe("include");
  });
});
