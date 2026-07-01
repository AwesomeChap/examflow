import { StudentExamCardGrid } from "../components/exams/StudentExamCardGrid";

/**
 * Actionable exams: anything not yet completed, plus completed exams that still
 * have attempts remaining (so the student can retake them).
 */
export function StudentDashboardOverview() {
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold">Your exams</h2>
      <StudentExamCardGrid
        filter={(exam) =>
          exam.attemptStatus !== "submitted" ||
          exam.attemptsRemaining === null ||
          exam.attemptsRemaining > 0
        }
        emptyHint="No exams are assigned to you yet."
      />
    </section>
  );
}
