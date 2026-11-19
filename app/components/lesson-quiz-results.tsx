import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import type {
  QuizData,
  QuizQuestion,
  QuizResultData,
} from "./lesson-quiz-types";

export function QuizResults({
  quiz,
  result,
  onRetake,
}: {
  quiz: QuizData;
  result: QuizResultData;
  onRetake: () => void;
}) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <QuizHeading title={quiz.title} />
        <QuizResultSummary result={result} />
        <div className="space-y-4">
          {quiz.questions.map((question, index) => (
            <QuizResultQuestion
              key={question.id}
              question={question}
              index={index}
              result={result.questionResults.find(
                (item) => item.questionId === question.id
              )}
            />
          ))}
        </div>
        {!result.passed && (
          <div className="mt-6">
            <Button variant="outline" onClick={onRetake}>
              <RotateCcw className="mr-2 size-4" />
              Retake Quiz
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function QuizHeading({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <HelpCircle className="size-5 text-primary" />
      <h2 className="text-xl font-semibold">{title}</h2>
    </div>
  );
}

function QuizResultSummary({ result }: { result: QuizResultData }) {
  return (
    <div
      className={`mb-6 rounded-lg p-4 ${result.passed ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`}
    >
      <div className="flex items-center gap-3">
        {result.passed ? (
          <Trophy className="size-8 text-green-600" />
        ) : (
          <XCircle className="size-8 text-red-600" />
        )}
        <div>
          <p
            className={`text-lg font-semibold ${result.passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
          >
            {result.passed ? "You passed!" : "Not quite — try again!"}
          </p>
          <p className="text-sm text-muted-foreground">
            Score: {result.totalCorrect}/{result.totalQuestions} (
            {Math.round(result.score * 100)}%) — Grade: {result.grade}
          </p>
        </div>
      </div>
    </div>
  );
}

function QuizResultQuestion({
  question,
  index,
  result,
}: {
  question: QuizQuestion;
  index: number;
  result: QuizResultData["questionResults"][number] | undefined;
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-start gap-2">
        {result?.correct ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
        ) : (
          <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
        )}
        <p className="font-medium">
          {index + 1}. {question.questionText}
        </p>
      </div>
      <div className="ml-7 space-y-1">
        {question.options.map((option) => (
          <QuizResultOption key={option.id} option={option} result={result} />
        ))}
      </div>
    </div>
  );
}

function QuizResultOption({
  option,
  result,
}: {
  option: QuizQuestion["options"][number];
  result: QuizResultData["questionResults"][number] | undefined;
}) {
  const isSelected = result?.selectedOptionId === option.id;
  const isCorrect = result?.correctOptionId === option.id;
  const className = isCorrect
    ? "text-sm font-medium text-green-700 dark:text-green-400"
    : isSelected && !result?.correct
      ? "text-sm text-red-600 line-through dark:text-red-400"
      : "text-sm";
  return (
    <p className={className}>
      {isCorrect ? "✓ " : isSelected ? "✗ " : "  "}
      {option.optionText}
    </p>
  );
}

export function QuizBestAttempt({
  title,
  score,
  onRetake,
}: {
  title: string;
  score: number;
  onRetake: () => void;
}) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-green-600" />
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">
              — Best score: {Math.round(score * 100)}%
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onRetake}>
            <RotateCcw className="mr-2 size-4" />
            Retake
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
