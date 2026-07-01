import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, makeExam, makeUser, seedExams, seedSession, seedUsers } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

describe("admin dashboard overview", () => {
  it("shows user counts and lists users (no exam grid)", async () => {
    seedSession(toPublic("admin"));
    // An exam exists, but the admin dashboard should not surface it as a grid.
    seedExams([makeExam({ id: "e1", title: "Algebra" })]);
    seedUsers([
      makeUser({ id: "s1", name: "Sara Student", role: "student" }),
      makeUser({ id: "s2", name: "Sid Student", role: "student" }),
    ]);
    renderApp("/dashboard");

    await screen.findByText("admin dashboard");

    // Overview stat cards (values from the dashboard endpoint: 25/3/1).
    expect(await screen.findByText("25")).toBeInTheDocument();
    // The labels also appear as role-filter options, so allow multiple.
    expect(screen.getAllByText("Students").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Teachers").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Admins").length).toBeGreaterThan(0);

    // Users are listed; the exam grid is gone.
    const main = within(screen.getByRole("main"));
    expect(await main.findByText("Sara Student")).toBeInTheDocument();
    expect(main.getByText("Sid Student")).toBeInTheDocument();
    expect(main.queryByText("Algebra")).not.toBeInTheDocument();

    // Create user (not create exam) for admins.
    expect(main.getByRole("link", { name: /create user/i })).toBeInTheDocument();
    expect(main.queryByRole("link", { name: /create exam/i })).not.toBeInTheDocument();
  });

  it("filters the user list by role", async () => {
    seedSession(toPublic("admin"));
    seedUsers([
      makeUser({ id: "s1", name: "Sara Student", role: "student" }),
      makeUser({ id: "t1", name: "Terry Teacher", role: "teacher" }),
    ]);
    const { user } = renderApp("/dashboard");

    await screen.findByText("admin dashboard");
    const main = within(screen.getByRole("main"));

    // Defaults to all roles: both users shown.
    expect(await main.findByText("Sara Student")).toBeInTheDocument();
    expect(main.getByText("Terry Teacher")).toBeInTheDocument();

    // Switch to teachers.
    await user.selectOptions(main.getByLabelText(/filter users by role/i), "teacher");
    expect(await main.findByText("Terry Teacher")).toBeInTheDocument();
    expect(main.queryByText("Sara Student")).not.toBeInTheDocument();
  });

  it("deactivates a user from the list", async () => {
    seedSession(toPublic("admin"));
    seedUsers([makeUser({ id: "s1", name: "Sara Student", role: "student" })]);
    const { user } = renderApp("/dashboard");

    await screen.findByText("admin dashboard");
    const main = within(screen.getByRole("main"));

    await user.click(await main.findByRole("button", { name: /deactivate sara student/i }));

    // Row now shows a Deactivated badge and a Reactivate action.
    expect(await main.findByText("Deactivated")).toBeInTheDocument();
    expect(main.getByRole("button", { name: /reactivate sara student/i })).toBeInTheDocument();
  });
});
