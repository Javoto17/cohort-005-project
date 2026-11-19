import { useFetcher } from "react-router";
import { LockKeyhole, NotebookPen, Save } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { formatRelativeTime } from "~/lib/utils";
import { getNoteSaveStatus } from "./lib/note-save-status";

export { getNoteSaveStatus } from "./lib/note-save-status";

type LessonNoteData = {
  body: string;
  updatedAt: string;
} | null;

export function LessonNotes({ note }: { note: LessonNoteData }) {
  return (
    <section
      aria-labelledby="lesson-notes-heading"
      className="border-b bg-muted/20 p-5 sm:p-6"
    >
      <LessonNotesHeading />
      <NoteEditor note={note} />
    </section>
  );
}

function LessonNotesHeading() {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <NotebookPen className="size-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id="lesson-notes-heading"
            className="text-base font-semibold tracking-tight"
          >
            Your notes
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <LockKeyhole className="size-3" aria-hidden="true" />
            Private
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture ideas as you learn. Only you can see these notes.
        </p>
      </div>
    </div>
  );
}

function NoteEditor({ note }: { note: LessonNoteData }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const status = getNoteSaveStatus(
    fetcher.state !== "idle",
    fetcher.data?.error
  );

  return (
    <fetcher.Form method="post" className="mt-5">
      <input type="hidden" name="intent" value="save-note" />
      <div className="overflow-hidden rounded-lg border bg-background transition-shadow focus-within:ring-2 focus-within:ring-ring/30">
        <Textarea
          name="body"
          rows={5}
          defaultValue={note?.body ?? ""}
          placeholder="Write down a key idea, question, or example…"
          aria-label="Your private lesson note"
          className="min-h-32 resize-y rounded-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:ring-0"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-3 py-2">
          <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span
              role={status.kind === "error" ? "alert" : "status"}
              className={
                status.kind === "error"
                  ? "font-medium text-destructive"
                  : "text-muted-foreground"
              }
            >
              {status.message}
            </span>
            {status.kind !== "error" && note && (
              <span suppressHydrationWarning>
                Last edited {formatRelativeTime(note.updatedAt)}
              </span>
            )}
          </div>
          <Button type="submit" size="sm" disabled={status.kind === "saving"}>
            <Save className="mr-1.5 size-4" aria-hidden="true" />
            {status.kind === "saving" ? "Saving…" : "Save note"}
          </Button>
        </div>
      </div>
    </fetcher.Form>
  );
}
