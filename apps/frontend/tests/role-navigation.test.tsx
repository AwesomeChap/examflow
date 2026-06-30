import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, seedSession } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

function nav() {
  return within(screen.getByRole("navigation", { name: /primary/i }));
}

describe("role-based navigation visibility", () => {
  it("shows the admin all sections except the student-only one", async () => {
    seedSession(toPublic("admin"));
    renderApp("/dashboard");

    await screen.findByText("admin dashboard");
    expect(nav().getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Admin" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Teacher" })).toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "Student" })).not.toBeInTheDocument();
  });

  it("shows a teacher the teacher section but hides admin and student sections", async () => {
    seedSession(toPublic("teacher"));
    renderApp("/dashboard");

    await screen.findByText("teacher dashboard");
    expect(nav().getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Teacher" })).toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "Student" })).not.toBeInTheDocument();
  });

  it("shows a student only the dashboard and student sections", async () => {
    seedSession(toPublic("student"));
    renderApp("/dashboard");

    await screen.findByText("student dashboard");
    expect(nav().getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Student" })).toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "Teacher" })).not.toBeInTheDocument();
  });

  it("hides navigation entirely when signed out", async () => {
    seedSession(null);
    renderApp("/login");

    await screen.findByRole("button", { name: /sign in/i });
    expect(screen.queryByRole("navigation", { name: /primary/i })).not.toBeInTheDocument();
  });
});
