import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useFetcher } from "react-router";
import { toast } from "sonner";
import {
  QuizBestAttempt,
  QuizHeading,
  QuizResults,
} from "./lesson-quiz-results";
import type {
  QuizData,
  QuizQuestion,
  QuizResultData,
} from "./lesson-quiz-types";
import { CheckCircle2, ChevronDown, Circle, PlayCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { LessonProgressStatus } from "~/db/schema";
import { cn } from "~/lib/utils";

type CurriculumModuleData = {
  id: number;
  title: string;
  lessons: Array<{ id: number; title: string }>;
};

type CurriculumSidebarProps = {
  course: { id: number; title: string; slug: string };
  curriculum: CurriculumModuleData[];
  currentLessonId: number;
  lessonProgressMap: Record<number, string>;
  enrolled: boolean;
};

export function CurriculumSidebar({
  course,
  curriculum,
  currentLessonId,
  lessonProgressMap,
  enrolled,
}: CurriculumSidebarProps) {
  const currentModuleId = curriculum.find((module) =>
    module.lessons.some((lesson) => lesson.id === currentLessonId)
  )?.id;
  const [expandedModules, setExpandedModules] = useState<Set<number>>(
    () => new Set(currentModuleId ? [currentModuleId] : [])
  );

  function toggleModule(moduleId: number) {
    setExpandedModules((previous) => {
      const next = new Set(previous);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  return (
    <aside className="hidden w-72 shrink-0 border-r border-border lg:block">
      <div className="sticky top-0 flex h-screen flex-col overflow-y-auto">
        <div className="border-b border-border p-4">
          <Link
            to={`/courses/${course.slug}`}
            className="text-sm font-semibold hover:text-primary"
          >
            {course.title}
          </Link>
        </div>
        <nav className="flex-1 p-2">
          {curriculum.map((module) => (
            <CurriculumModule
              key={module.id}
              module={module}
              isExpanded={expandedModules.has(module.id)}
              currentLessonId={currentLessonId}
              lessonProgressMap={lessonProgressMap}
              enrolled={enrolled}
              courseSlug={course.slug}
              onToggle={() => toggleModule(module.id)}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}

function CurriculumModule({
  module,
  isExpanded,
  currentLessonId,
  lessonProgressMap,
  enrolled,
  courseSlug,
  onToggle,
}: {
  module: CurriculumModuleData;
  isExpanded: boolean;
  currentLessonId: number;
  lessonProgressMap: Record<number, string>;
  enrolled: boolean;
  courseSlug: string;
  onToggle: () => void;
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            !isExpanded && "-rotate-90"
          )}
        />
        <span className="flex-1 text-left">{module.title}</span>
      </button>
      {isExpanded && (
        <ul className="ml-4 space-y-0.5 py-1">
          {module.lessons.map((lesson) => (
            <CurriculumLesson
              key={lesson.id}
              lesson={lesson}
              isCurrent={lesson.id === currentLessonId}
              status={lessonProgressMap[lesson.id]}
              enrolled={enrolled}
              courseSlug={courseSlug}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CurriculumLesson({
  lesson,
  isCurrent,
  status,
  enrolled,
  courseSlug,
}: {
  lesson: { id: number; title: string };
  isCurrent: boolean;
  status: string | undefined;
  enrolled: boolean;
  courseSlug: string;
}) {
  const isCompleted = status === LessonProgressStatus.Completed;
  const isInProgress = status === LessonProgressStatus.InProgress;
  return (
    <li>
      <Link
        to={`/courses/${courseSlug}/lessons/${lesson.id}`}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
          isCurrent
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {enrolled ? (
          isCompleted ? (
            <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />
          ) : isInProgress ? (
            <PlayCircle className="size-3.5 shrink-0 text-blue-500" />
          ) : (
            <Circle className="size-3.5 shrink-0" />
          )
        ) : (
          <Circle className="size-3.5 shrink-0" />
        )}
        <span className="truncate">{lesson.title}</span>
      </Link>
    </li>
  );
}

type QuizSectionProps = {
  quiz: QuizData;
  bestAttempt: { score: number; passed: boolean } | null;
  quizResult: QuizResultData | null;
  quizFetcher: ReturnType<typeof useFetcher>;
  isSubmitting: boolean;
};

export function QuizSection({
  quiz,
  bestAttempt,
  quizResult,
  quizFetcher,
  isSubmitting,
}: QuizSectionProps) {
  const state = useQuizState(quiz, bestAttempt);
  useQuizFeedback(quizResult, state.retaking);
  if (quizResult && !state.retaking) {
    return (
      <QuizResults quiz={quiz} result={quizResult} onRetake={state.retake} />
    );
  }
  if (!state.showQuiz && bestAttempt?.passed) {
    return (
      <QuizBestAttempt
        title={quiz.title}
        score={bestAttempt.score}
        onRetake={state.showAgain}
      />
    );
  }
  return (
    <QuizForm
      quiz={quiz}
      quizFetcher={quizFetcher}
      isSubmitting={isSubmitting}
      allAnswered={state.allAnswered}
      selectedAnswers={state.selectedAnswers}
      setSelectedAnswers={state.setSelectedAnswers}
      onSubmit={state.finishRetake}
    />
  );
}

function useQuizState(
  quiz: QuizData,
  bestAttempt: QuizSectionProps["bestAttempt"]
) {
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number>
  >({});
  const [showQuiz, setShowQuiz] = useState(!bestAttempt?.passed);
  const [retaking, setRetaking] = useState(false);
  const allAnswered = quiz.questions.every(
    (question) => selectedAnswers[question.id] !== undefined
  );
  return {
    selectedAnswers,
    setSelectedAnswers,
    showQuiz,
    retaking,
    allAnswered,
    retake: () => {
      setSelectedAnswers({});
      setRetaking(true);
    },
    showAgain: () => setShowQuiz(true),
    finishRetake: () => setRetaking(false),
  };
}

function useQuizFeedback(quizResult: QuizResultData | null, retaking: boolean) {
  useEffect(() => {
    if (!quizResult || retaking) return;
    const score = Math.round(quizResult.score * 100);
    if (quizResult.passed) toast.success(`Quiz passed! Score: ${score}%`);
    else toast.error(`Quiz not passed. Score: ${score}%`);
  }, [quizResult, retaking]);
}

type QuizFormProps = {
  quiz: QuizData;
  quizFetcher: ReturnType<typeof useFetcher>;
  isSubmitting: boolean;
  allAnswered: boolean;
  selectedAnswers: Record<number, number>;
  setSelectedAnswers: Dispatch<SetStateAction<Record<number, number>>>;
  onSubmit: () => void;
};

function QuizForm({
  quiz,
  quizFetcher,
  isSubmitting,
  allAnswered,
  selectedAnswers,
  setSelectedAnswers,
  onSubmit,
}: QuizFormProps) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <QuizHeading title={quiz.title} />
        <p className="mb-6 text-sm text-muted-foreground">
          Answer all questions and submit. Passing score:{" "}
          {Math.round(quiz.passingScore * 100)}%.
        </p>
        <quizFetcher.Form method="post" onSubmit={onSubmit}>
          <input type="hidden" name="intent" value="submit-quiz" />
          <input type="hidden" name="quizId" value={quiz.id} />
          <QuizQuestionList
            questions={quiz.questions}
            selectedAnswers={selectedAnswers}
            setSelectedAnswers={setSelectedAnswers}
          />
          <QuizSubmitControls
            allAnswered={allAnswered}
            isSubmitting={isSubmitting}
          />
        </quizFetcher.Form>
      </CardContent>
    </Card>
  );
}

function QuizQuestionList({
  questions,
  selectedAnswers,
  setSelectedAnswers,
}: {
  questions: QuizQuestion[];
  selectedAnswers: Record<number, number>;
  setSelectedAnswers: Dispatch<SetStateAction<Record<number, number>>>;
}) {
  return (
    <div className="space-y-6">
      {questions.map((question, index) => (
        <QuizQuestion
          key={question.id}
          question={question}
          index={index}
          selectedOptionId={selectedAnswers[question.id]}
          onSelect={(optionId) =>
            setSelectedAnswers((previous) => ({
              ...previous,
              [question.id]: optionId,
            }))
          }
        />
      ))}
    </div>
  );
}

function QuizSubmitControls({
  allAnswered,
  isSubmitting,
}: {
  allAnswered: boolean;
  isSubmitting: boolean;
}) {
  return (
    <div className="mt-6">
      <Button type="submit" disabled={!allAnswered || isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit Quiz"}
      </Button>
      {!allAnswered && (
        <p className="mt-2 text-sm text-muted-foreground">
          Please answer all questions before submitting.
        </p>
      )}
    </div>
  );
}

function QuizQuestion({
  question,
  index,
  selectedOptionId,
  onSelect,
}: {
  question: QuizQuestion;
  index: number;
  selectedOptionId: number | undefined;
  onSelect: (optionId: number) => void;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 font-medium">
        {index + 1}. {question.questionText}
      </p>
      <div className="space-y-2">
        {question.options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted"
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option.id}
              checked={selectedOptionId === option.id}
              onChange={() => onSelect(option.id)}
              className="size-4 accent-primary"
            />
            <span className="text-sm">{option.optionText}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
