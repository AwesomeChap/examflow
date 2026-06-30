import type { ExamStatus } from "../../types/exam";
import { Badge } from "../ui/Badge";

const STATUS_LABEL: Record<ExamStatus, string> = {
  draft: "Draft",
  published: "Published",
};

export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  return (
    <Badge tone={status === "published" ? "success" : "warning"}>{STATUS_LABEL[status]}</Badge>
  );
}
