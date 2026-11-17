import type { Route } from "./+types/saved";
import { SavedLessonCard } from "~/features/saved/saved-lesson-card";
import { db } from "~/db";
import { getAccess, requireUserId } from "~/lib/access.server";
import { courses } from "~/db/schema";
import { inArray } from "drizzle-orm";
import { listBookmarks } from "~/lib/bookmarks.server";
import { listNotes } from "~/lib/notes.server";
import { Card, CardContent } from "~/components/ui/card";
import { Bookmark, NotebookPen } from "lucide-react";
import { formatRelativeTime } from "~/lib/utils";

export function meta() {
  return [
    { title: "Saved — Cadence" },
    { name: "description", content: "Your bookmarks and notes" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const savedBookmarks = listBookmarks(db, userId);
  const savedNotes = listNotes(db, userId);
  const slugs = [
    ...new Set(
      [...savedBookmarks, ...savedNotes].map((row) => row.lesson.courseSlug)
    ),
  ];
  const accessible = new Set<string>();
  if (slugs.length > 0) {
    const savedCourses = db
      .select({ id: courses.id, slug: courses.slug })
      .from(courses)
      .where(inArray(courses.slug, slugs))
      .all();
    for (const course of savedCourses) {
      if ((await getAccess(request, course.id)).canViewContent) {
        accessible.add(course.slug);
      }
    }
  }

  return {
    savedBookmarks: savedBookmarks.filter((row) =>
      accessible.has(row.lesson.courseSlug)
    ),
    savedNotes: savedNotes.filter((row) =>
      accessible.has(row.lesson.courseSlug)
    ),
  };
}

export default function Saved({ loaderData }: Route.ComponentProps) {
  const { savedBookmarks, savedNotes } = loaderData;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Saved</h1>
        <p className="text-sm text-muted-foreground">
          The lessons you flagged, and what you wrote about them.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Bookmark className="size-4 text-muted-foreground" />
            Bookmarks
          </h2>

          {savedBookmarks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No bookmarks yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {savedBookmarks.map((bookmark) => (
                <SavedLessonCard key={bookmark.id} lesson={bookmark.lesson} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <NotebookPen className="size-4 text-muted-foreground" />
            Notes
          </h2>

          {savedNotes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No notes yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {savedNotes.map((note) => (
                <SavedLessonCard key={note.id} lesson={note.lesson}>
                  {/* Plain text — a Note is never rendered as Markdown. */}
                  <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                  <p
                    suppressHydrationWarning
                    className="text-xs text-muted-foreground"
                  >
                    Edited {formatRelativeTime(note.updatedAt)}
                  </p>
                </SavedLessonCard>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
