import { Link } from "react-router";
import { Card, CardContent } from "~/components/ui/card";
import type { SavedLessonCardProps } from "./saved.types";

export function SavedLessonCard({ lesson, children }: SavedLessonCardProps) {
  return (
    <Card>
      <CardContent className="space-y-1 py-3">
        <Link
          to={`/courses/${lesson.courseSlug}/lessons/${lesson.id}`}
          className="text-sm font-medium hover:underline"
        >
          {lesson.title}
        </Link>
        <p className="text-xs text-muted-foreground">{lesson.courseTitle}</p>
        {children}
      </CardContent>
    </Card>
  );
}
