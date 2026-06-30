import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../hooks/useToast";
import { useCreateExamMutation } from "../store/examsApi";

/**
 * "Create Exam" entry point. Following the Medium model, we create an empty
 * draft immediately and drop the user straight into the editor, where the title,
 * description, metadata and questions are all filled in (and auto-saved).
 */
export function CreateExamPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [createExam, { isError }] = useCreateExamMutation();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const exam = await createExam({ title: "Untitled", status: "draft" }).unwrap();
        notify({ message: "Draft exam created.", variant: "success" });
        navigate(`/exam/${exam.id}/edit`, { replace: true });
      } catch {
        /* surfaced below */
      }
    })();
  }, [createExam, navigate, notify]);

  if (isError) {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        Could not start a new exam. Please try again.
      </p>
    );
  }

  return (
    <p role="status" className="text-slate-500 dark:text-slate-400">
      Creating your exam…
    </p>
  );
}
