import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Question } from "../src/types/question";
import { renderApp } from "./render";
import { TEST_USERS, makeExam, seedSession, seedStudentExam } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

function questions(): Question[] {
  return [
    {
      id: "q1",
      examId: "se1",
      type: "mcq",
      text: "Pick four",
      options: ["3", "4"],
      correctAnswer: "4",
      order: 1,
      points: 1,
    },
    {
      id: "q2",
      examId: "se1",
      type: "true_false",
      text: "Sky is blue",
      options: null,
      correctAnswer: "true",
      order: 2,
      points: 1,
    },
  ];
}

describe("student exam taking", () => {
  it("starts an exam with timer and question progress", async () => {
    seedSession(toPublic("student"));
    seedStudentExam(
      makeExam({ id: "se1", title: "Live Exam", createdById: TEST_USERS.teacher.id }),
      questions(),
    );
    renderApp("/exam/se1");

    expect(await screen.findByRole("heading", { name: "Live Exam" })).toBeInTheDocument();
    expect(screen.getByRole("timer")).toBeInTheDocument();
    expect(screen.getByText(/0\/2 attempted/i)).toBeInTheDocument();
    expect(screen.getByText(/question 1 of 2/i)).toBeInTheDocument();
  });

  it("navigates questions and saves answers", async () => {
    seedSession(toPublic("student"));
    seedStudentExam(
      makeExam({ id: "se1", title: "Live Exam", createdById: TEST_USERS.teacher.id }),
      questions(),
    );
    const { user } = renderApp("/exam/se1");

    await screen.findByText("Pick four");
    await user.click(screen.getByLabelText("4"));
    expect(await screen.findByText(/1\/2 attempted/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("Sky is blue");
    await user.click(screen.getByLabelText("true"));
    expect(await screen.findByText(/2\/2 attempted/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /previous/i }));
    expect(await screen.findByText("Pick four")).toBeInTheDocument();
  });

  it("submits manually and redirects to the result page", async () => {
    seedSession(toPublic("student"));
    seedStudentExam(
      makeExam({ id: "se1", title: "Live Exam", createdById: TEST_USERS.teacher.id }),
      questions(),
    );
    const { user } = renderApp("/exam/se1");

    await screen.findByText("Pick four");
    await user.click(screen.getByLabelText("4"));

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: /submit exam/i }));

    expect(await screen.findByText(/back to results/i)).toBeInTheDocument();
    expect(screen.getAllByText("1/2").length).toBeGreaterThanOrEqual(1);
  });

  it("blocks staff from the student exam route", async () => {
    seedSession(toPublic("teacher"));
    seedStudentExam(makeExam({ id: "se1", createdById: TEST_USERS.teacher.id }), questions());
    renderApp("/exam/se1");

    await screen.findByText("teacher dashboard");
  });
});

describe("student exam — validation", () => {
  it("shows an error when the exam cannot be started", async () => {
    seedSession(toPublic("student"));
    const future = new Date(Date.now() + 86_400_000).toISOString();
    seedStudentExam(
      makeExam({ id: "se1", startsAt: future, createdById: TEST_USERS.teacher.id }),
      questions(),
    );
    renderApp("/exam/se1");

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not start/i);
  });
});
