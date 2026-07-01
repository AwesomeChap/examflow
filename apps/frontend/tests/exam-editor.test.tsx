import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { Question } from "../src/types/question";
import type { Student } from "../src/types/student";
import { renderApp } from "./render";
import {
  TEST_USERS,
  capturedRequests,
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

  it("configures the allowed attempts (number and unlimited)", async () => {
    seedTeacherExam();
    const { user } = renderApp("/exam/e1/edit");

    await screen.findByDisplayValue("My Exam");
    const attempts = screen.getByLabelText(/attempts allowed/i);

    // Set a finite limit; blurring persists it. Triple-click selects the
    // existing value so typing replaces it (the field clamps empty back to 1).
    await user.tripleClick(attempts);
    await user.keyboard("3");
    await user.tab();
    await waitFor(() =>
      expect(capturedRequests.examUpdate.at(-1)).toEqual({ maxAttempts: 3 }),
    );

    // Checking "Unlimited" disables the field and persists null.
    await user.click(screen.getByRole("checkbox", { name: /unlimited/i }));
    await waitFor(() =>
      expect(capturedRequests.examUpdate.at(-1)).toEqual({ maxAttempts: null }),
    );
    expect(screen.getByLabelText(/attempts allowed/i)).toBeDisabled();
  });
});

/** Opens the add-question form for the given type and waits for the field. */
async function openAddForm(user: UserEvent, type: "mcq" | "true_false") {
  await screen.findByDisplayValue("My Exam");
  await user.click(screen.getByRole("button", { name: /add a question/i }));
  await user.click(
    screen.getByRole("menuitem", { name: type === "mcq" ? /multiple choice/i : /true \/ false/i }),
  );
  await screen.findByLabelText("Question");
}

describe("exam editor — validation, options, and payload", () => {
  it("adds and removes MCQ option fields (focusing the new one)", async () => {
    seedTeacherExam();
    const { user } = renderApp("/exam/e1/edit");
    await openAddForm(user, "mcq");

    // Starts with two options, no third.
    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
    expect(screen.queryByLabelText("Option 3")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add option/i }));

    // The newly added option appears and is focused.
    const third = await screen.findByLabelText("Option 3");
    expect(third).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /remove option 3/i }));
    expect(screen.queryByLabelText("Option 3")).not.toBeInTheDocument();
  });

  it("shows a validation error and blocks submit when an option is blank", async () => {
    seedTeacherExam();
    const { user } = renderApp("/exam/e1/edit");
    await openAddForm(user, "mcq");

    await user.type(screen.getByLabelText("Question"), "Capital of France?");
    await user.type(screen.getByLabelText("Option 1"), "Paris");
    // Option 2 left blank, then mark option 1 correct and submit.
    await user.click(screen.getByLabelText("Mark option 1 as correct"));
    await user.click(screen.getByRole("button", { name: /^add question$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/all options must be filled/i);
    // Nothing was sent and no question was added.
    expect(capturedRequests.questionCreate).toHaveLength(0);
    expect(screen.queryByText(/questions \(1\)/i)).not.toBeInTheDocument();
    // Form is still open for correction.
    expect(screen.getByLabelText("Question")).toBeInTheDocument();
  });

  it("does not submit a question with empty text", async () => {
    seedTeacherExam();
    const { user } = renderApp("/exam/e1/edit");
    await openAddForm(user, "mcq");

    await user.type(screen.getByLabelText("Option 1"), "Paris");
    await user.type(screen.getByLabelText("Option 2"), "Berlin");
    await user.click(screen.getByLabelText("Mark option 1 as correct"));
    // Question text intentionally left empty.
    await user.click(screen.getByRole("button", { name: /^add question$/i }));

    expect(capturedRequests.questionCreate).toHaveLength(0);
    // Still on the form (submission blocked).
    expect(screen.getByLabelText("Question")).toBeInTheDocument();
  });

  it("sends the correct MCQ payload to the backend", async () => {
    seedTeacherExam();
    const { user } = renderApp("/exam/e1/edit");
    await openAddForm(user, "mcq");

    await user.type(screen.getByLabelText("Question"), "Capital of France?");
    await user.type(screen.getByLabelText("Option 1"), "Paris");
    await user.type(screen.getByLabelText("Option 2"), "Berlin");
    await user.click(screen.getByLabelText("Mark option 2 as correct"));
    await user.click(screen.getByRole("button", { name: /^add question$/i }));

    await screen.findByText("Capital of France?");
    expect(capturedRequests.questionCreate.at(-1)).toEqual({
      type: "mcq",
      text: "Capital of France?",
      options: ["Paris", "Berlin"],
      correctAnswer: "Berlin",
      points: 1,
    });
  });

  it("sends the correct true/false payload to the backend", async () => {
    seedTeacherExam();
    const { user } = renderApp("/exam/e1/edit");
    await openAddForm(user, "true_false");

    await user.type(screen.getByLabelText("Question"), "The sky is green.");
    await user.click(screen.getByRole("radio", { name: "False" }));
    await user.click(screen.getByRole("button", { name: /^add question$/i }));

    await screen.findByText("The sky is green.");
    expect(capturedRequests.questionCreate.at(-1)).toEqual({
      type: "true_false",
      text: "The sky is green.",
      correctAnswer: "false",
      points: 1,
    });
  });

  describe("staff preview", () => {
    it("lets a teacher review an exam with the correct answer highlighted and no submit", async () => {
      seedTeacherExam({ status: "published" });
      seedQuestions("e1", [mcq("q1")]);
      renderApp("/exam/e1/preview");

      await screen.findByText("What is 2 + 2?");
      expect(screen.getByText(/preview mode/i)).toBeInTheDocument();

      // The correct option is marked and pre-selected; nothing is submittable.
      const correct = screen.getByRole("radio", { name: /4/ });
      expect(correct).toBeChecked();
      expect(screen.getByText("Correct answer", { exact: true })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
    });
  });
});
