import { useFetcher } from "react-router";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import { SavedIntent } from "./intents";
import type { BookmarkActionResult, BookmarkToggleProps } from "./saved.types";

export function BookmarkToggle({ bookmarked }: BookmarkToggleProps) {
  const fetcher = useFetcher<BookmarkActionResult>();
  const isSaving = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value={SavedIntent.ToggleBookmark} />
      <Button type="submit" variant="outline" size="sm" disabled={isSaving}>
        {bookmarked ? (
          <BookmarkCheck className="mr-1.5 size-4" />
        ) : (
          <Bookmark className="mr-1.5 size-4" />
        )}
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </Button>
    </fetcher.Form>
  );
}
