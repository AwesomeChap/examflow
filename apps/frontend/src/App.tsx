import { ThemeToggle } from "./components/ThemeToggle";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-16">
        <section className="mb-12 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Exam management platform
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">ExamFlow</h1>
          <p className="mx-auto max-w-xl text-lg text-slate-600 dark:text-slate-400">
            Plan, schedule, and run exams with a single workflow for admins and students.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Create exams",
              description: "Build question papers, set timings, and publish schedules in minutes.",
            },
            {
              title: "Track progress",
              description: "Monitor submissions, attendance, and results from one dashboard.",
            },
            {
              title: "Stay organized",
              description: "Keep students, invigilators, and grading teams aligned end to end.",
            },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="mb-2 text-lg font-semibold">{card.title}</h2>
              <p className="text-slate-600 dark:text-slate-400">{card.description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
