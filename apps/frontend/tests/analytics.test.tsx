import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./render";
import { TEST_USERS, makeExam, seedAnalytics, seedExams, seedSession } from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

const POPULATED_ANALYTICS = {
  exam: { id: "e1", title: "Algebra", totalQuestions: 2, maxScore: 5 },
  attempts: {
    total: 12,
    submitted: 10,
    inProgress: 2,
    assignedStudents: 12,
    completionRate: 83.33,
  },
  score: {
    averageScore: 3.2,
    averagePercentage: 64,
    highestScore: 5,
    lowestScore: 1,
    medianScore: 3,
    stdDev: 1.2,
    distribution: [
      { label: "0-20", min: 0, max: 20, count: 1 },
      { label: "20-40", min: 20, max: 40, count: 1 },
      { label: "40-60", min: 40, max: 60, count: 2 },
      { label: "60-80", min: 60, max: 80, count: 4 },
      { label: "80-100", min: 80, max: 100, count: 2 },
    ],
  },
  timing: { averageDurationMs: 750_000, medianDurationMs: 720_000 },
  questions: [
    {
      questionId: "q1",
      order: 1,
      text: "Derivative of x squared",
      type: "mcq",
      points: 2,
      answered: 10,
      correct: 3,
      correctRate: 30,
    },
    {
      questionId: "q2",
      order: 2,
      text: "Two plus two equals four",
      type: "true_false",
      points: 3,
      answered: 10,
      correct: 9,
      correctRate: 90,
    },
  ],
};

describe("exam analytics", () => {
  it("renders summary, normal distribution, per-question and struggling overview", async () => {
    seedSession(toPublic("teacher"));
    seedExams([makeExam({ id: "e1", title: "Algebra", createdById: TEST_USERS.teacher.id })]);
    seedAnalytics("e1", POPULATED_ANALYTICS);

    renderApp("/exam/e1/details");

    // Summary cards
    expect(await screen.findByText("Total submissions")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Average score")).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(screen.getByText("Avg. time taken")).toBeInTheDocument();
    expect(screen.getByText("12m 30s")).toBeInTheDocument();
    expect(screen.queryByText("Completion rate")).not.toBeInTheDocument();

    // Normal-distribution chart
    expect(
      screen.getByRole("img", {
        name: /score distribution histogram with a normal-distribution curve/i,
      }),
    ).toBeInTheDocument();

    // Overview: hardest and easiest questions
    const challenging = screen.getByRole("heading", { name: /most challenging/i }).closest("div")!;
    expect(within(challenging).getByText("Derivative of x squared")).toBeInTheDocument();
    expect(within(challenging).getByText(/30% correct/i)).toBeInTheDocument();

    const understood = screen.getByRole("heading", { name: /best understood/i }).closest("div")!;
    expect(within(understood).getByText("Two plus two equals four")).toBeInTheDocument();
    expect(within(understood).getByText(/90% correct/i)).toBeInTheDocument();

    // Per-question correctness progress bars
    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBeGreaterThanOrEqual(2);
    expect(bars[0]).toHaveAttribute("aria-valuenow", "30");
  });

  it("shows an empty state when there are no submissions", async () => {
    seedSession(toPublic("teacher"));
    seedExams([makeExam({ id: "e2", title: "Geometry", createdById: TEST_USERS.teacher.id })]);
    // No analytics seeded -> mock returns a zeroed payload.

    renderApp("/exam/e2/details");

    expect(await screen.findByText(/no submissions yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /score distribution/i })).not.toBeInTheDocument();
  });
});
