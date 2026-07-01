import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, makeExam, seedExams, seedSession } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

describe("admin dashboard overview", () => {
  it("shows user/exam counts and the exams as cards", async () => {
    seedSession(toPublic("admin"));
    seedExams([
      makeExam({ id: "e1", title: "Algebra" }),
      makeExam({ id: "e2", title: "Geometry" }),
    ]);
    renderApp("/dashboard");

    await screen.findByText("admin dashboard");

    // Overview stat cards (students/teachers from the dashboard endpoint).
    expect(await screen.findByText("25")).toBeInTheDocument();
    expect(screen.getByText("Students")).toBeInTheDocument();
    expect(screen.getByText("Teachers")).toBeInTheDocument();

    // Every exam is rendered as a card.
    const main = within(screen.getByRole("main"));
    expect(await main.findByText("Algebra")).toBeInTheDocument();
    expect(main.getByText("Geometry")).toBeInTheDocument();
    expect(main.getByRole("link", { name: /create exam/i })).toBeInTheDocument();
  });

  it("navigates to a chosen exam's details from its card", async () => {
    seedSession(toPublic("admin"));
    seedExams([makeExam({ id: "e1", title: "Some Exam", createdById: TEST_USERS.teacher.id })]);
    const { user } = renderApp("/dashboard");

    await screen.findByText("admin dashboard");
    const main = within(screen.getByRole("main"));
    await user.click(await main.findByRole("link", { name: /^details$/i }));

    expect(await screen.findByRole("heading", { name: /analytics/i })).toBeInTheDocument();
  });
});
