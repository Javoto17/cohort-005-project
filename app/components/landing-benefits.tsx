import { BookOpen, GraduationCap, Users } from "lucide-react";

export function LandingBenefits() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            Keep your momentum
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Learn with a little more structure.
          </h2>
        </div>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">
          Follow clear lessons, see your progress, and use quizzes to practice
          what you learn.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-6">
          <BookOpen
            aria-hidden="true"
            className="mb-5 size-7 text-foreground"
          />
          <h3 className="text-lg font-semibold">Learn from instructors</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Explore structured courses built by experienced instructors.
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-6">
          <GraduationCap
            aria-hidden="true"
            className="mb-5 size-7 text-foreground"
          />
          <h3 className="text-lg font-semibold">Keep track of progress</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Pick up where you left off and see how far you have come.
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-6">
          <Users aria-hidden="true" className="mb-5 size-7 text-foreground" />
          <h3 className="text-lg font-semibold">Practice as you go</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Use quizzes to check your understanding along the way.
          </p>
        </article>
      </div>
    </section>
  );
}
