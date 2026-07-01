import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Question } from "@examflow/shared-types";
import { renderApp } from "./render";
import { TEST_USERS, makeExam, seedSession, seedStudentExam, seedSubmittedAttempt } from "./server";

function toPublic(role: "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

function mcq(id: string): Question {
  return {
    id,
    examId: "se1",
    type: "mcq",
    text: "2 + 2 = ?",
    options: ["3", "4"],
    correctAnswer: "4",
    order: 1,
    points: 1,
  };
}

const STUDENT_ID = TEST_USERS.student.id;

describe("student multiple attempts", () => {
  it("offers a retake and shows attempts remaining when the limit allows it", async () => {
    seedSession(toPublic("student"));
    seedStudentExam(
      makeExam({
        id: "se1",
        title: "Math Quiz",
        maxAttempts: 2,
        createdById: TEST_USERS.teacher.id,
      }),
      [mcq("q1")],
    );
    seedSubmittedAttempt("se1", STUDENT_ID, [{ questionId: "q1", value: "4" }]);

    renderApp("/dashboard");

    await screen.findByText("student dashboard");
    expect(await screen.findByText("Math Quiz")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /retake/i })).toBeInTheDocument();
    expect(screen.getByText(/attempt 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/best: 1/i)).toBeInTheDocument();
  });

  it("blocks starting once all attempts are used", async () => {
    seedSession(toPublic("student"));
    seedStudentExam(
      makeExam({
        id: "se1",
        title: "One Shot",
        maxAttempts: 1,
        createdById: TEST_USERS.teacher.id,
      }),
      [mcq("q1")],
    );
    seedSubmittedAttempt("se1", STUDENT_ID, [{ questionId: "q1", value: "4" }]);

    renderApp("/exam/se1");

    expect(await screen.findByRole("alert")).toHaveTextContent(/used all your attempts/i);
  });

  it("lists each submitted attempt separately on the results tab", async () => {
    seedSession(toPublic("student"));
    seedStudentExam(
      makeExam({
        id: "se1",
        title: "Retryable",
        maxAttempts: null,
        createdById: TEST_USERS.teacher.id,
      }),
      [mcq("q1")],
    );
    seedSubmittedAttempt("se1", STUDENT_ID, [{ questionId: "q1", value: "3" }]);
    seedSubmittedAttempt("se1", STUDENT_ID, [{ questionId: "q1", value: "4" }]);

    renderApp("/results");

    await screen.findByText(/your results/i);
    expect(await screen.findByText(/attempt 1/i)).toBeInTheDocument();
    expect(screen.getByText(/attempt 2/i)).toBeInTheDocument();
    // Two "View result" links, one per attempt.
    expect(screen.getAllByRole("link", { name: /view result/i })).toHaveLength(2);
  });
});
