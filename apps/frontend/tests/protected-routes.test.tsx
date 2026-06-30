import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, makeExam, seedExams, seedSession } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

describe("protected routes", () => {
  it("redirects an unauthenticated visitor from a protected route to /login", async () => {
    renderApp("/dashboard");

    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText(/welcome back,/i)).not.toBeInTheDocument();
  });

  it("redirects unauthenticated access to a staff page to /login", async () => {
    renderApp("/exams/new");

    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("redirects the root path to the dashboard once authenticated", async () => {
    seedSession(toPublic("admin"));
    renderApp("/");

    expect(await screen.findByText("admin dashboard")).toBeInTheDocument();
  });

  it("keeps a staff user with the right role on a role-restricted page", async () => {
    seedSession(toPublic("admin"));
    seedExams([makeExam({ id: "e1", title: "Owned", createdById: TEST_USERS.teacher.id })]);
    renderApp("/exam/e1/edit");

    // Editor loads (the title field is prefilled with the exam title).
    expect(await screen.findByDisplayValue("Owned")).toBeInTheDocument();
  });

  it("redirects a student away from a staff-only page to their dashboard", async () => {
    seedSession(toPublic("student"));
    seedExams([makeExam({ id: "e1", createdById: TEST_USERS.teacher.id })]);
    renderApp("/exam/e1/edit");

    // Student is signed in but not staff: bounced to their dashboard.
    expect(await screen.findByText("student dashboard")).toBeInTheDocument();
  });

  it("returns a signed-in user from /login to the dashboard", async () => {
    seedSession(toPublic("teacher"));
    renderApp("/login");

    expect(await screen.findByText("teacher dashboard")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /sign in/i })).not.toBeInTheDocument(),
    );
  });
});
