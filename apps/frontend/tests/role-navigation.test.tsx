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
  it("shows the admin Dashboard and Create Exam", async () => {
    seedSession(toPublic("admin"));
    renderApp("/dashboard");

    await screen.findByText("admin dashboard");
    expect(nav().getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Create Exam" })).toBeInTheDocument();
  });

  it("shows a teacher Dashboard and Create Exam", async () => {
    seedSession(toPublic("teacher"));
    renderApp("/dashboard");

    await screen.findByText("teacher dashboard");
    expect(nav().getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Create Exam" })).toBeInTheDocument();
  });

  it("shows a student Dashboard and Results (no exam authoring)", async () => {
    seedSession(toPublic("student"));
    renderApp("/dashboard");

    await screen.findByText("student dashboard");
    expect(nav().getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Results" })).toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "Create Exam" })).not.toBeInTheDocument();
  });

  it("hides navigation entirely when signed out", async () => {
    seedSession(null);
    renderApp("/login");

    await screen.findByRole("button", { name: /sign in/i });
    expect(screen.queryByRole("navigation", { name: /primary/i })).not.toBeInTheDocument();
  });
});
