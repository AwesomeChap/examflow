export type ExamStatus = "draft" | "published";

export type ExamCreator = {
  id: string;
  name: string;
  email: string;
};

export type ExamCounts = {
  questions: number;
  attempts: number;
  assignments: number;
};

export type Exam = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number;
  status: ExamStatus;
  startsAt: string | null;
  /** Allowed attempts per student; null means unlimited. */
  maxAttempts: number | null;
  createdAt: string;
  createdById: string;
};

/** Exam as returned by the list endpoint (with creator + aggregate counts). */
export type ExamListItem = Exam & {
  createdBy: ExamCreator;
  _count: ExamCounts;
};

/** Single-exam detail (with creator + aggregate counts for edit-locking). */
export type ExamDetail = Exam & {
  createdBy: ExamCreator;
  _count: ExamCounts;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
