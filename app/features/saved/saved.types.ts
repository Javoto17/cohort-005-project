import type { ReactNode } from "react";
import type { notes } from "~/db/schema";
import type { SavedIntent as SavedIntentValues } from "./intents";

export type SavedIntent =
  (typeof SavedIntentValues)[keyof typeof SavedIntentValues];
export type BookmarkToggleProps = { bookmarked: boolean };
export type BookmarkActionResult = { ok: boolean; bookmarked?: boolean };
export type NoteActionResult = { ok: boolean; error?: string };
export type LessonNoteProps = {
  note: Pick<typeof notes.$inferSelect, "body" | "updatedAt"> | null;
};
export type SavedLesson = {
  id: number;
  title: string;
  courseSlug: string;
  courseTitle: string;
};
export type SavedLessonCardProps = {
  lesson: SavedLesson;
  children?: ReactNode;
};
