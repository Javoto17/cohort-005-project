import { useCallback, useEffect, useState } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import type { Route } from "../routes/+types/courses.$slug.lessons.$lessonId";
import { MapPin, ShieldAlert } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { LessonProgressStatus } from "~/db/schema";
import { countryName } from "~/lib/ppp";
import { CurriculumSidebar } from "./lesson-viewer-sections";
import { FullLessonLayout } from "./lesson-viewer-content";

type LessonLoaderData = Route.ComponentProps["loaderData"];

const AUTOPLAY_KEY = "cadence-autoplay";

function useAutoplay() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(AUTOPLAY_KEY) === "true");
    } catch {
      /* silently fail */
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTOPLAY_KEY, String(next));
      } catch {
        /* silently fail */
      }
      return next;
    });
  }, []);

  return [enabled, toggle] as const;
}

export function LockedLesson({
  data: {
    course,
    curriculum,
    module: lessonModule,
    lesson,
    enrolled,
    lockedReason,
  },
}: {
  data: Extract<LessonLoaderData, { view: "locked" }>;
}) {
  return (
    <div className="flex">
      <CurriculumSidebar
        course={course}
        curriculum={curriculum}
        currentLessonId={lesson.id}
        lessonProgressMap={{}}
        enrolled={enrolled}
      />
      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={course}
          mod={lessonModule}
          lessonTitle={lesson.title}
        />
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-bold">{lesson.title}</h1>
          <LockedLessonCard course={course} lockedReason={lockedReason} />
        </div>
      </div>
    </div>
  );
}

function LockedLessonCard({
  course,
  lockedReason,
}: {
  course: { title: string; slug: string };
  lockedReason: Extract<LessonLoaderData, { view: "locked" }>["lockedReason"];
}) {
  return (
    <Card className="mb-8">
      <CardContent className="py-10 text-center">
        {lockedReason.kind === "country-lock" ? (
          <CountryLockMessage
            purchaseCountry={lockedReason.purchaseCountry}
            currentCountry={lockedReason.currentCountry}
            courseSlug={course.slug}
          />
        ) : (
          <PurchaseLessonMessage
            course={course}
            isSignedOut={lockedReason.kind === "signed-out"}
          />
        )}
      </CardContent>
    </Card>
  );
}

function CountryLockMessage({
  purchaseCountry,
  currentCountry,
  courseSlug,
}: {
  purchaseCountry: string;
  currentCountry: string;
  courseSlug: string;
}) {
  return (
    <>
      <ShieldAlert className="mx-auto mb-4 size-12 text-amber-500" />
      <h2 className="mb-3 text-xl font-semibold">Country Lock</h2>
      <p className="mb-4 text-muted-foreground">
        You bought this course at a Purchasing-Power Price in{" "}
        <strong>{countryName(purchaseCountry)}</strong>, but you're currently in{" "}
        <strong>{countryName(currentCountry)}</strong>.
      </p>
      <p className="mb-6 text-sm text-muted-foreground">
        A course bought at a Purchasing-Power Price only works from the country
        it was bought in. This helps keep courses affordable for students in
        lower-income regions.
      </p>
      <Link to={`/courses/${courseSlug}`}>
        <Button variant="outline">
          <MapPin className="mr-2 size-4" />
          Back to Course
        </Button>
      </Link>
    </>
  );
}

function PurchaseLessonMessage({
  course,
  isSignedOut,
}: {
  course: { title: string; slug: string };
  isSignedOut: boolean;
}) {
  const purchasePath = `/courses/${course.slug}/purchase`;
  return (
    <>
      <h2 className="mb-3 text-xl font-semibold">
        Buy this course to watch this lesson
      </h2>
      <p className="mb-6 text-muted-foreground">
        This lesson is part of <strong>{course.title}</strong>. Enroll to get
        the full lesson, its video and every other lesson in the course.
      </p>
      <Link
        to={
          isSignedOut
            ? `/signup?redirectTo=${encodeURIComponent(purchasePath)}`
            : purchasePath
        }
      >
        <Button size="lg">Buy the course</Button>
      </Link>
    </>
  );
}

function LessonBreadcrumb({
  course,
  mod,
  lessonTitle,
}: {
  course: { title: string; slug: string };
  mod: { id: number; title: string };
  lessonTitle: string;
}) {
  return (
    <nav className="mb-6 text-sm text-muted-foreground">
      <Link to="/courses" className="hover:text-foreground">
        Courses
      </Link>
      <span className="mx-2">/</span>
      <Link to={`/courses/${course.slug}`} className="hover:text-foreground">
        {course.title}
      </Link>
      <span className="mx-2">/</span>
      <Link
        to={`/courses/${course.slug}/${mod.id}`}
        className="hover:text-foreground"
      >
        {mod.title}
      </Link>
      <span className="mx-2">/</span>
      <span className="text-foreground">{lessonTitle}</span>
    </nav>
  );
}

export function FullLesson({
  data,
}: {
  data: Extract<LessonLoaderData, { view: "full" }>;
}) {
  const [autoplay, toggleAutoplay] = useAutoplay();
  const fetcher = useFetcher({ key: `mark-complete-${data.lesson.id}` });
  const quizFetcher = useFetcher({ key: `quiz-${data.lesson.id}` });
  const navigate = useNavigate();
  const isMarking =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent") === "mark-complete";
  const justCompleted = fetcher.data?.success;
  const isCompleted =
    data.lessonStatus === LessonProgressStatus.Completed || justCompleted;

  useEffect(() => {
    if (justCompleted && data.nextLesson) {
      navigate(`/courses/${data.course.slug}/lessons/${data.nextLesson.id}`);
    }
  }, [justCompleted, data.nextLesson, data.course.slug, navigate]);

  return (
    <FullLessonLayout
      data={data}
      autoplay={autoplay}
      onToggleAutoplay={toggleAutoplay}
      fetcher={fetcher}
      quizFetcher={quizFetcher}
      isMarking={isMarking}
      isCompleted={isCompleted}
      quizResult={quizFetcher.data?.quizResult ?? null}
      isSubmittingQuiz={quizFetcher.state !== "idle"}
    />
  );
}
