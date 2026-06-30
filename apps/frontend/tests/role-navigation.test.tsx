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
  it("shows the admin Dashboard and Manage Exams", async () => {
    seedSession(toPublic("admin"));
    renderApp("/dashboard");

    await screen.findByText("admin dashboard");
    expect(nav().getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "Manage Exams" })).toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "My Exams" })).not.toBeInTheDocument();
  });

  it("shows a teacher Dashboard and My Exams (not the admin label)", async () => {
    seedSession(toPublic("teacher"));
    renderApp("/dashboard");

    await screen.findByText("teacher dashboard");
    expect(nav().getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(nav().getByRole("link", { name: "My Exams" })).toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "Manage Exams" })).not.toBeInTheDocument();
  });

  it("shows a student only the dashboard (no exam management)", async () => {
    seedSession(toPublic("student"));
    renderApp("/dashboard");

    await screen.findByText("student dashboard");
    expect(nav().getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "Manage Exams" })).not.toBeInTheDocument();
    expect(nav().queryByRole("link", { name: "My Exams" })).not.toBeInTheDocument();
  });

  it("hides navigation entirely when signed out", async () => {
    seedSession(null);
    renderApp("/login");

    await screen.findByRole("button", { name: /sign in/i });
    expect(screen.queryByRole("navigation", { name: /primary/i })).not.toBeInTheDocument();
  });
});
