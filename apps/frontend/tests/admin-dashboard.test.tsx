import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, makeExam, seedExams, seedSession } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

describe("admin dashboard overview", () => {
  it("shows user/exam counts and a Manage Exams action", async () => {
    seedSession(toPublic("admin"));
    seedExams([makeExam({ id: "e1" }), makeExam({ id: "e2" })]);
    renderApp("/dashboard");

    await screen.findByText("admin dashboard");

    // Overview stat cards (students/teachers from the dashboard endpoint).
    expect(await screen.findByText("25")).toBeInTheDocument();
    expect(screen.getByText("Students")).toBeInTheDocument();
    expect(screen.getByText("Teachers")).toBeInTheDocument();
    expect(screen.getByText("Exams")).toBeInTheDocument();

    // Scope to the page body (the nav also has a Manage Exams link).
    const main = within(screen.getByRole("main"));
    expect(main.getByRole("link", { name: /manage exams/i })).toBeInTheDocument();
  });

  it("navigates to the exam list from the Manage Exams action", async () => {
    seedSession(toPublic("admin"));
    seedExams([makeExam({ id: "e1", title: "Some Exam", createdById: TEST_USERS.teacher.id })]);
    const { user } = renderApp("/dashboard");

    await screen.findByText("admin dashboard");
    const main = within(screen.getByRole("main"));
    await user.click(main.getByRole("link", { name: /manage exams/i }));

    expect(await screen.findByRole("heading", { name: /manage exams/i })).toBeInTheDocument();
  });
});
