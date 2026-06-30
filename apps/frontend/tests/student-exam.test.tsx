import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Question } from "../src/types/question";
import { renderApp } from "./render";
import {
  TEST_USERS,
  makeExam,
  seedSession,
  seedStudentExam,
  setTestAttemptDurationMs,
} from "./server";

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

function seedLiveExam(durationMin = 60) {
  seedSession(toPublic("student"));
  seedStudentExam(
    makeExam({
      id: "se1",
      title: "Live Exam",
      durationMin,
      createdById: TEST_USERS.teacher.id,
    }),
    questions(),
  );
}

describe("student exam flow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("timer", () => {
    it("starts at the full exam duration", async () => {
      seedLiveExam(45);
      renderApp("/exam/se1");

      const timer = await screen.findByRole("timer", { name: /time remaining/i });
      expect(timer).not.toHaveTextContent("00:00");
      const [mins] = (timer.textContent ?? "00:00").split(":").map(Number);
      expect(mins).toBeGreaterThanOrEqual(44);
      expect(mins).toBeLessThanOrEqual(45);
    });

    it("counts down as time passes", async () => {
      setTestAttemptDurationMs(5_000);
      seedLiveExam(60);
      renderApp("/exam/se1");

      const timer = await screen.findByRole("timer", { name: /time remaining/i });
      expect(timer.textContent).toMatch(/^00:0[4-5]$/);

      await waitFor(
        () => {
          const [mins, secs] = (timer.textContent ?? "").split(":").map(Number);
          expect(mins).toBe(0);
          expect(secs).toBeLessThanOrEqual(3);
        },
        { timeout: 3_000 },
      );
    });
  });

  describe("answer persistence during navigation", () => {
    it("keeps MCQ and true/false selections when moving prev/next", async () => {
      seedLiveExam();
      const { user } = renderApp("/exam/se1");

      await screen.findByText("Pick four");
      await user.click(screen.getByRole("radio", { name: "4" }));

      await user.click(screen.getByRole("button", { name: /next/i }));
      await screen.findByText("Sky is blue");
      await user.click(screen.getByRole("radio", { name: "true" }));

      await user.click(screen.getByRole("button", { name: /previous/i }));
      await screen.findByText("Pick four");
      expect(screen.getByRole("radio", { name: "4" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "3" })).not.toBeChecked();

      await user.click(screen.getByRole("button", { name: /next/i }));
      await screen.findByText("Sky is blue");
      expect(screen.getByRole("radio", { name: "true" })).toBeChecked();
      expect(screen.getByText(/2\/2 attempted/i)).toBeInTheDocument();
    });
  });

  describe("manual submit", () => {
    it("redirects to the result screen with a score summary", async () => {
      seedLiveExam();
      const { user } = renderApp("/exam/se1");

      await screen.findByText("Pick four");
      await user.click(screen.getByRole("radio", { name: "4" }));

      vi.spyOn(window, "confirm").mockReturnValue(true);
      await user.click(screen.getByRole("button", { name: /submit exam/i }));

      expect(await screen.findByRole("heading", { name: "Live Exam" })).toBeInTheDocument();
      expect(screen.getByText(/back to results/i)).toBeInTheDocument();
      expect(screen.getByText(/breakdown/i)).toBeInTheDocument();
      expect(screen.getByText(/your answer:/i)).toBeInTheDocument();
      expect(screen.queryByText(/time's up — exam submitted/i)).not.toBeInTheDocument();
    });

    it("shows a success toast after manual submit", async () => {
      seedLiveExam();
      const { user } = renderApp("/exam/se1");

      await screen.findByText("Pick four");
      vi.spyOn(window, "confirm").mockReturnValue(true);
      await user.click(screen.getByRole("button", { name: /submit exam/i }));

      expect(await screen.findByText("Exam submitted.")).toBeInTheDocument();
    });
  });

  describe("autosubmit", () => {
    it("submits and redirects to results when the timer expires", async () => {
      setTestAttemptDurationMs(1_500);
      seedLiveExam(60);
      renderApp("/exam/se1");

      await screen.findByRole("timer", { name: /time remaining/i });

      expect(await screen.findByText(/back to results/i, {}, { timeout: 5_000 })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Live Exam" })).toBeInTheDocument();
    });

    it("shows a time-up toast on autosubmit", async () => {
      setTestAttemptDurationMs(1_500);
      seedLiveExam(60);
      renderApp("/exam/se1");

      await screen.findByRole("timer", { name: /time remaining/i });

      expect(
        await screen.findByText("Time's up — exam submitted.", {}, { timeout: 5_000 }),
      ).toBeInTheDocument();
    });
  });
});

describe("student exam taking — access", () => {
  it("loads question progress on start", async () => {
    seedLiveExam();
    renderApp("/exam/se1");

    expect(await screen.findByRole("heading", { name: "Live Exam" })).toBeInTheDocument();
    expect(screen.getByText(/0\/2 attempted/i)).toBeInTheDocument();
    expect(screen.getByText(/question 1 of 2/i)).toBeInTheDocument();
  });

  it("blocks staff from the student exam route", async () => {
    seedSession(toPublic("teacher"));
    seedStudentExam(makeExam({ id: "se1", createdById: TEST_USERS.teacher.id }), questions());
    renderApp("/exam/se1");

    await screen.findByText("teacher dashboard");
  });

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
