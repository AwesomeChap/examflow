import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, makeExam, seedExams, seedSession } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

function teacherExams(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makeExam({
      id: `e${String(i).padStart(2, "0")}`,
      title: `Exam ${String(i).padStart(2, "0")}`,
      status: i % 2 === 0 ? "published" : "draft",
      createdById: TEST_USERS.teacher.id,
    }),
  );
}

describe("exam listing", () => {
  it("shows a teacher their own exams under the My Exams heading", async () => {
    seedSession(toPublic("teacher"));
    seedExams(teacherExams(3));
    renderApp("/exams");

    expect(await screen.findByRole("heading", { name: /my exams/i })).toBeInTheDocument();
    expect(await screen.findByText("Exam 00")).toBeInTheDocument();
    expect(screen.getByText("Exam 02")).toBeInTheDocument();
  });

  it("shows the admin all exams with creator info under Manage Exams", async () => {
    seedSession(toPublic("admin"));
    seedExams([
      makeExam({ id: "a1", title: "Owned by teacher", createdById: TEST_USERS.teacher.id }),
    ]);
    renderApp("/exams");

    expect(await screen.findByRole("heading", { name: /manage exams/i })).toBeInTheDocument();
    expect(await screen.findByText("Owned by teacher")).toBeInTheDocument();
    // Admin list surfaces the creator's name.
    expect(screen.getByText(new RegExp(TEST_USERS.teacher.name))).toBeInTheDocument();
  });

  it("renders draft/published status badges", async () => {
    seedSession(toPublic("teacher"));
    seedExams([
      makeExam({ id: "p", title: "Published one", status: "published" }),
      makeExam({ id: "d", title: "Draft one", status: "draft" }),
    ]);
    renderApp("/exams");

    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows an empty state when there are no exams", async () => {
    seedSession(toPublic("teacher"));
    seedExams([]);
    renderApp("/exams");

    expect(await screen.findByText(/no exams yet/i)).toBeInTheDocument();
  });

  it("paginates through pages with Next/Previous", async () => {
    seedSession(toPublic("teacher"));
    seedExams(teacherExams(15));
    const { user } = renderApp("/exams");

    // Page 1: first item present, page-2 item absent.
    expect(await screen.findByText("Exam 00")).toBeInTheDocument();
    expect(screen.queryByText("Exam 10")).not.toBeInTheDocument();
    expect(screen.getByText(/showing 1–10 of 15/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(await screen.findByText("Exam 10")).toBeInTheDocument();
    expect(screen.queryByText("Exam 00")).not.toBeInTheDocument();
    expect(screen.getByText(/showing 11–15 of 15/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /previous page/i }));
    expect(await screen.findByText("Exam 00")).toBeInTheDocument();
  });

  it("navigates to the exam detail page when a row is clicked", async () => {
    seedSession(toPublic("teacher"));
    seedExams([makeExam({ id: "x1", title: "Clickable Exam", status: "published" })]);
    const { user } = renderApp("/exams");

    const list = within(await screen.findByRole("list", { name: /exams/i }));
    await user.click(list.getByRole("link", { name: /clickable exam/i }));

    expect(await screen.findByRole("heading", { name: "Clickable Exam" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /analytics/i })).toBeInTheDocument(),
    );
  });
});
