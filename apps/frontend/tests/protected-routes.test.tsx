import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, seedSession } from "./server";

describe("protected routes", () => {
  it("redirects an unauthenticated visitor from a protected route to /login", async () => {
    renderApp("/dashboard");

    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText(/welcome back,/i)).not.toBeInTheDocument();
  });

  it("redirects unauthenticated access to a role page to /login", async () => {
    renderApp("/admin");

    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("redirects the root path to the dashboard once authenticated", async () => {
    seedSession(toPublic("admin"));
    renderApp("/");

    expect(await screen.findByText("admin dashboard")).toBeInTheDocument();
  });

  it("keeps an authenticated user with the right role on a role-restricted page", async () => {
    seedSession(toPublic("admin"));
    renderApp("/admin");

    expect(await screen.findByText(/admin console/i)).toBeInTheDocument();
  });

  it("redirects an authenticated user away from a page their role cannot access", async () => {
    seedSession(toPublic("student"));
    renderApp("/admin");

    // Student is signed in but not an admin: bounced to their dashboard.
    expect(await screen.findByText("student dashboard")).toBeInTheDocument();
    expect(screen.queryByText(/admin console/i)).not.toBeInTheDocument();
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

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}
