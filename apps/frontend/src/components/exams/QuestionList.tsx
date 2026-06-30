import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import type { Question } from "../../types/question";
import { cn } from "../../lib/cn";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

type QuestionListProps = {
  questions: Question[];
  onEdit: (question: Question) => void;
  onDelete: (question: Question) => void;
  onReorder: (orderedIds: string[]) => void;
  deletingId?: string;
  /** Id of the question currently being edited inline (renders the form in place). */
  editingId?: string;
  /** Renders the inline edit form for the editing question. */
  renderEditForm?: (question: Question, index: number) => ReactNode;
};

const TYPE_LABEL: Record<Question["type"], string> = {
  mcq: "Multiple choice",
  true_false: "True / False",
};

function CorrectCircle() {
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 4 4 6-8" />
      </svg>
    </span>
  );
}

function OptionCircle() {
  return (
    <span
      aria-hidden="true"
      className="h-5 w-5 shrink-0 rounded-full border border-slate-300 dark:border-slate-600"
    />
  );
}

function AnswerSummary({ question }: { question: Question }) {
  if (question.type === "mcq" && question.options) {
    return (
      <ul className="mt-3 space-y-1.5 text-sm">
        {question.options.map((option) => {
          const correct = option === question.correctAnswer;
          return (
            <li key={option} className="flex items-center gap-2.5">
              {correct ? <CorrectCircle /> : <OptionCircle />}
              <span
                className={
                  correct
                    ? "font-medium text-slate-900 dark:text-slate-100"
                    : "text-slate-600 dark:text-slate-400"
                }
              >
                {option}
              </span>
              {correct && (
                <span className="sr-only">(correct answer)</span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2.5 text-sm">
      <CorrectCircle />
      <span className="text-slate-500 dark:text-slate-400">Correct answer</span>
      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-green-700 dark:bg-green-500/15 dark:text-green-300">
        {question.correctAnswer}
      </span>
    </div>
  );
}

type SortableHandleProps = Pick<ReturnType<typeof useSortable>, "attributes" | "listeners">;

function DragHandle({ listeners, attributes }: SortableHandleProps) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      className="mt-0.5 flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:cursor-grabbing dark:hover:bg-slate-800"
      {...attributes}
      {...listeners}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <circle cx="7" cy="5" r="1.4" />
        <circle cx="13" cy="5" r="1.4" />
        <circle cx="7" cy="10" r="1.4" />
        <circle cx="13" cy="10" r="1.4" />
        <circle cx="7" cy="15" r="1.4" />
        <circle cx="13" cy="15" r="1.4" />
      </svg>
    </button>
  );
}

function QuestionItem({
  question,
  index,
  onEdit,
  onDelete,
  deletingId,
  isEditing,
  renderEditForm,
}: {
  question: Question;
  index: number;
  onEdit: (q: Question) => void;
  onDelete: (q: Question) => void;
  deletingId?: string;
  isEditing: boolean;
  renderEditForm?: (question: Question, index: number) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled: isEditing,
  });

  // Use Translate (not Transform) so variable-height questions only move and
  // never get scaled/squeezed to match a neighbour's size during a drag.
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  if (isEditing) {
    return (
      <li ref={setNodeRef} style={style}>
        <Card className="border-blue-300 p-5 ring-1 ring-blue-500/30 dark:border-blue-500/40">
          {renderEditForm?.(question, index)}
        </Card>
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} className={cn(isDragging && "relative z-10")}>
      <Card className={cn("p-4", isDragging && "shadow-lg ring-2 ring-blue-500/40")}>
        <div className="flex items-start gap-3">
          <DragHandle listeners={listeners} attributes={attributes} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <Badge tone="info">{TYPE_LABEL[question.type]}</Badge>
              <Badge>
                {question.points} pt{question.points === 1 ? "" : "s"}
              </Badge>
            </div>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              <span className="mr-2 font-semibold text-slate-400">#{index + 1}</span>
              {question.text}
            </p>
            <AnswerSummary question={question} />
          </div>

          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={() => onEdit(question)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(question)}
              disabled={deletingId === question.id}
            >
              Delete
            </Button>
          </div>
        </div>
      </Card>
    </li>
  );
}

export function QuestionList({
  questions,
  onEdit,
  onDelete,
  onReorder,
  deletingId,
  editingId,
  renderEditForm,
}: QuestionListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (questions.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(questions, oldIndex, newIndex);
    onReorder(next.map((q) => q.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-3">
          {questions.map((question, index) => (
            <QuestionItem
              key={question.id}
              question={question}
              index={index}
              onEdit={onEdit}
              onDelete={onDelete}
              deletingId={deletingId}
              isEditing={editingId === question.id}
              renderEditForm={renderEditForm}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
