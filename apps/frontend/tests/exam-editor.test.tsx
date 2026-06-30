import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Question } from "../src/types/question";
import type { Student } from "../src/types/student";
import { renderApp } from "./render";
import {
  TEST_USERS,
  makeExam,
  seedExams,
  seedQuestions,
  seedSession,
  seedStudents,
} from "./server";

function toPublic(role: "admin" | "teacher" | "student") {
  const { password: _password, ...user } = TEST_USERS[role];
  return user;
}

function seedTeacherExam(overrides: Partial<Parameters<typeof makeExam>[0]> = {}) {
  seedSession(toPublic("teacher"));
  seedExams([
    makeExam({ id: "e1", title: "My Exam", status: "draft", createdById: TEST_USERS.teacher.id, ...overrides }),
  ]);
}

function mcq(id: string): Question {
  return {
    id,
    examId: "e1",
    type: "mcq",
    text: "What is 2 + 2?",
    options: ["3", "4", "5"],
    correctAnswer: "4",
    order: 1,
    points: 1,
  };
}

const STUDENTS: Student[] = [
  { id: "s1", name: "Alice", email: "alice@stud.examflow.edu", matriculationNumber: "MAT1" },
  { id: "s2", name: "Bob", email: "bob@stud.examflow.edu", matriculationNumber: "MAT2" },
];

describe("exam editor (Medium-style)", () => {
  it("adds a multiple-choice question via the + menu", async () => {
    seedTeacherExam();
    const { user } = renderApp("/exam/e1/edit");

    await screen.findByDisplayValue("My Exam");
    await user.click(screen.getByRole("button", { name: /add a question/i }));
    await user.click(screen.getByRole("menuitem", { name: /multiple choice/i }));

    await user.type(screen.getByLabelText("Question"), "Capital of France?");
    await user.type(screen.getByLabelText("Option 1"), "Paris");
    await user.type(screen.getByLabelText("Option 2"), "Berlin");
    await user.click(screen.getByLabelText("Mark option 1 as correct"));
    await user.click(screen.getByRole("button", { name: /^add question$/i }));

    expect(await screen.findByText("Capital of France?")).toBeInTheDocument();
    expect(screen.getByText(/questions \(1\)/i)).toBeInTheDocument();
  });

  it("adds a true/false question via the + menu", async () => {
    seedTeacherExam();
    const { user } = renderApp("/exam/e1/edit");

    await screen.findByDisplayValue("My Exam");
    await user.click(screen.getByRole("button", { name: /add a question/i }));
    await user.click(screen.getByRole("menuitem", { name: /true \/ false/i }));

    await user.type(screen.getByLabelText("Question"), "The sky is green.");
    await user.click(screen.getByRole("radio", { name: "False" }));
    await user.click(screen.getByRole("button", { name: /^add question$/i }));

    expect(await screen.findByText("The sky is green.")).toBeInTheDocument();
  });

  it("edits an existing question", async () => {
    seedTeacherExam();
    seedQuestions("e1", [mcq("q1")]);
    const { user } = renderApp("/exam/e1/edit");

    await screen.findByText("What is 2 + 2?");
    await user.click(screen.getByRole("button", { name: /^edit$/i }));

    const textArea = screen.getByLabelText("Question");
    await user.clear(textArea);
    await user.type(textArea, "What is 3 + 3?");
    await user.click(screen.getByRole("button", { name: /save question/i }));

    expect(await screen.findByText("What is 3 + 3?")).toBeInTheDocument();
    expect(screen.queryByText("What is 2 + 2?")).not.toBeInTheDocument();
  });

  it("deletes a question", async () => {
    seedTeacherExam();
    seedQuestions("e1", [mcq("q1")]);
    const { user } = renderApp("/exam/e1/edit");

    await screen.findByText("What is 2 + 2?");
    await user.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => expect(screen.queryByText("What is 2 + 2?")).not.toBeInTheDocument());
    // Heading disappears once empty; the "+" add control remains.
    expect(screen.queryByText(/questions \(/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a question/i })).toBeInTheDocument();
  });

  it("publishes a draft with questions and lands on analytics", async () => {
    seedTeacherExam();
    seedQuestions("e1", [mcq("q1")]);
    const { user } = renderApp("/exam/e1/edit");

    await screen.findByDisplayValue("My Exam");
    await user.click(screen.getByRole("button", { name: /^publish$/i }));

    // Publish navigates to the exam's analytics/details page.
    expect(await screen.findByRole("heading", { name: /analytics/i })).toBeInTheDocument();
  });

  it("disables publish until there is at least one question", async () => {
    seedTeacherExam();
    renderApp("/exam/e1/edit");

    expect(await screen.findByRole("button", { name: /^publish$/i })).toBeDisabled();
  });

  it("assigns target students via the multi-select (select all)", async () => {
    seedTeacherExam();
    seedStudents(STUDENTS);
    const { user } = renderApp("/exam/e1/edit");

    await screen.findByDisplayValue("My Exam");
    await user.click(await screen.findByRole("button", { name: /target students/i }));
    await user.click(await screen.findByRole("checkbox", { name: /select all/i }));

    expect(await screen.findByText(/all students \(2\)/i)).toBeInTheDocument();
  });

  it("locks an exam that already has results and offers cloning", async () => {
    seedTeacherExam({ _count: { questions: 1, attempts: 2, assignments: 0 } });
    renderApp("/exam/e1/edit");

    expect(await screen.findByText(/already has results/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clone exam/i })).toBeInTheDocument();
  });
});
