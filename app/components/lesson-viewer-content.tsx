import { Link, useFetcher } from "react-router";
import type { Route } from "../routes/+types/courses.$slug.lessons.$lessonId";
import {
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Github,
} from "lucide-react";
import { CommentThread } from "~/components/comment-thread";
import { LessonBreadcrumb } from "~/components/lesson-breadcrumb";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { YouTubePlayer } from "~/components/youtube-player";
import { cn, formatDuration } from "~/lib/utils";
import { LessonNotes } from "~/modules/lesson-notes";
import { CurriculumSidebar, QuizSection } from "./lesson-viewer-sections";

type FullLessonData = Extract<
  Route.ComponentProps["loaderData"],
  { view: "full" }
>;
type LessonFetcher = ReturnType<typeof useFetcher>;
type QuizResultData = Parameters<typeof QuizSection>[0]["quizResult"];

type FullLessonLayoutProps = {
  data: FullLessonData;
  autoplay: boolean;
  onToggleAutoplay: () => void;
  fetcher: LessonFetcher;
  quizFetcher: LessonFetcher;
  isMarking: boolean;
  isCompleted: boolean;
  quizResult: QuizResultData;
  isSubmittingQuiz: boolean;
};

export function FullLessonLayout({ data, ...props }: FullLessonLayoutProps) {
  return (
    <div className="flex">
      <CurriculumSidebar
        course={data.course}
        curriculum={data.curriculum}
        currentLessonId={data.lesson.id}
        lessonProgressMap={data.lessonProgressMap}
        enrolled={data.enrolled}
      />
      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={data.course}
          mod={data.module}
          lessonTitle={data.lesson.title}
        />
        <LessonContentStack data={data} {...props} />
      </div>
    </div>
  );
}

function LessonContentStack({
  data,
  autoplay,
  onToggleAutoplay,
  ...activity
}: FullLessonLayoutProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <LessonHeading data={data} />
      <LessonMaterial
        data={data}
        autoplay={autoplay}
        onToggleAutoplay={onToggleAutoplay}
      />
      <LessonActivity data={data} {...activity} />
    </div>
  );
}

function LessonActivity({
  data,
  fetcher,
  quizFetcher,
  isMarking,
  isCompleted,
  quizResult,
  isSubmittingQuiz,
}: Omit<FullLessonLayoutProps, "autoplay" | "onToggleAutoplay">) {
  return (
    <>
      {data.quiz && data.enrolled && data.currentUserId && (
        <QuizSection
          quiz={data.quiz}
          bestAttempt={data.bestAttempt}
          quizResult={quizResult}
          quizFetcher={quizFetcher}
          isSubmitting={isSubmittingQuiz}
        />
      )}
      <LessonCompletion
        data={data}
        fetcher={fetcher}
        isMarking={isMarking}
        isCompleted={isCompleted}
      />
      <CommentThread
        comments={data.comments}
        currentUserId={data.currentUserId}
        canModerate={data.canModerate}
        canPost
        instructorName={data.instructorName}
      />
      <LessonNavigation data={data} />
    </>
  );
}
function LessonHeading({ data }: { data: FullLessonData }) {
  const { lesson, currentUserId, bookmarked } = data;
  return (
    <>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        {currentUserId && <BookmarkToggle bookmarked={bookmarked} />}
      </div>
      <div className="mb-6 flex items-center gap-3">
        {lesson.durationMinutes && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {formatDuration(lesson.durationMinutes, true, false, false)}
          </div>
        )}
        {lesson.githubRepoUrl && (
          <a
            href={lesson.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github className="mr-1.5 size-4" />
              Open Code
            </Button>
          </a>
        )}
      </div>
    </>
  );
}

function LessonMaterial({
  data,
  autoplay,
  onToggleAutoplay,
}: {
  data: FullLessonData;
  autoplay: boolean;
  onToggleAutoplay: () => void;
}) {
  return (
    <>
      {data.lesson.videoUrl && (
        <YouTubePlayer
          videoUrl={data.lesson.videoUrl}
          lessonId={data.lesson.id}
          title={data.lesson.title}
          startPosition={data.lastWatchPosition}
          durationMinutes={data.lesson.durationMinutes}
          watchProgress={data.watchProgress}
          trackingEnabled={data.enrolled && !!data.currentUserId}
          autoplay={autoplay}
          onToggleAutoplay={onToggleAutoplay}
        />
      )}
      <LessonStudyArea
        currentUserId={data.currentUserId}
        note={data.note}
        contentHtml={data.contentHtml}
      />
      {!data.contentHtml && !data.lesson.videoUrl && <EmptyLessonContent />}
    </>
  );
}

function LessonStudyArea({
  currentUserId,
  note,
  contentHtml,
}: {
  currentUserId: number | null;
  note: FullLessonData["note"];
  contentHtml: string | null;
}) {
  if (currentUserId) {
    return (
      <div className="mb-8 overflow-hidden rounded-xl border bg-card shadow-sm">
        <LessonNotes note={note} />
        {contentHtml && (
          <div className="prose prose-neutral dark:prose-invert max-w-none px-5 py-6 sm:px-6">
            <LessonContentHtml contentHtml={contentHtml} />
          </div>
        )}
      </div>
    );
  }
  if (!contentHtml) return null;
  return (
    <div className="prose prose-neutral dark:prose-invert mb-8 max-w-none">
      <LessonContentHtml contentHtml={contentHtml} />
    </div>
  );
}

function LessonContentHtml({ contentHtml }: { contentHtml: string }) {
  return (
    // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
    <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
  );
}

function EmptyLessonContent() {
  return (
    <Card className="mb-8">
      <CardContent className="py-12 text-center text-muted-foreground">
        No content has been added to this lesson yet.
      </CardContent>
    </Card>
  );
}

function LessonCompletion({
  data,
  fetcher,
  isMarking,
  isCompleted,
}: {
  data: FullLessonData;
  fetcher: LessonFetcher;
  isMarking: boolean;
  isCompleted: boolean;
}) {
  if (!data.enrolled || !data.currentUserId) return null;
  return (
    <div className="mb-8">
      {isCompleted ? (
        <CompletedLesson
          nextLesson={data.nextLesson}
          courseSlug={data.course.slug}
        />
      ) : (
        <MarkLessonComplete
          fetcher={fetcher}
          isMarking={isMarking}
          nextLesson={data.nextLesson}
        />
      )}
    </div>
  );
}

function CompletedLesson({
  nextLesson,
  courseSlug,
}: {
  nextLesson: FullLessonData["nextLesson"];
  courseSlug: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="size-5" />
        <span className="font-medium">Lesson completed</span>
      </div>
      {nextLesson && (
        <Link to={`/courses/${courseSlug}/lessons/${nextLesson.id}`}>
          <Button variant="outline" size="sm">
            Up next: {nextLesson.title}
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function MarkLessonComplete({
  fetcher,
  isMarking,
  nextLesson,
}: {
  fetcher: LessonFetcher;
  isMarking: boolean;
  nextLesson: FullLessonData["nextLesson"];
}) {
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="mark-complete" />
      <Button disabled={isMarking}>
        {nextLesson ? (
          isMarking ? (
            "Completing..."
          ) : (
            <>
              Up next: {nextLesson.title}
              <ChevronRight className="ml-1 size-4" />
            </>
          )
        ) : (
          <>
            <CheckCircle2 className="mr-2 size-4" />
            {isMarking ? "Marking..." : "Mark as Complete"}
          </>
        )}
      </Button>
    </fetcher.Form>
  );
}

function LessonNavigation({ data }: { data: FullLessonData }) {
  return (
    <div className="flex items-center justify-between border-t pt-6">
      {data.prevLesson ? (
        <LessonNavLink
          direction="previous"
          courseSlug={data.course.slug}
          lesson={data.prevLesson}
        />
      ) : (
        <div />
      )}
      {data.nextLesson ? (
        <LessonNavLink
          direction="next"
          courseSlug={data.course.slug}
          lesson={data.nextLesson}
        />
      ) : (
        <Link
          to={`/courses/${data.course.slug}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <div>
            <div className="text-xs text-muted-foreground">Back to</div>
            <div className="font-medium text-foreground">
              {data.course.title}
            </div>
          </div>
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function LessonNavLink({
  direction,
  courseSlug,
  lesson,
}: {
  direction: "previous" | "next";
  courseSlug: string;
  lesson: NonNullable<FullLessonData["prevLesson"]>;
}) {
  const isPrevious = direction === "previous";
  return (
    <Link
      to={`/courses/${courseSlug}/lessons/${lesson.id}`}
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground",
        !isPrevious && "text-right"
      )}
    >
      {isPrevious && <ChevronLeft className="size-4" />}
      <div>
        <div className="text-xs">{isPrevious ? "Previous" : "Next"}</div>
        <div className="font-medium text-foreground">{lesson.title}</div>
      </div>
      {!isPrevious && <ChevronRight className="size-4" />}
    </Link>
  );
}

function BookmarkToggle({ bookmarked }: { bookmarked: boolean }) {
  const fetcher = useFetcher<{ ok: boolean }>();
  const isSaving = fetcher.state !== "idle";
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggle-bookmark" />
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
