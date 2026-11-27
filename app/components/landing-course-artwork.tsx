import { BookOpen } from "lucide-react";

export function LandingCourseArtwork({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative isolate flex overflow-hidden bg-foreground text-background ${className ?? ""}`}
    >
      <div className="absolute -right-10 -top-16 size-48 rounded-full border-[24px] border-background/15" />
      <div className="absolute -bottom-20 -left-12 size-56 rounded-full bg-primary/40" />
      <div className="relative flex h-full w-full flex-col justify-between p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <BookOpen aria-hidden="true" className="size-5" />
          </span>
          <span className="rounded-full border border-background/40 px-3 py-1 text-xs font-semibold">
            {category}
          </span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-background/80">
            Learn at your own pace
          </p>
          <div className="mt-3 flex gap-2" aria-hidden="true">
            <span className="h-1.5 w-12 rounded-full bg-primary" />
            <span className="h-1.5 w-8 rounded-full bg-secondary" />
            <span className="h-1.5 w-5 rounded-full bg-accent" />
          </div>
        </div>
      </div>
    </div>
  );
}
