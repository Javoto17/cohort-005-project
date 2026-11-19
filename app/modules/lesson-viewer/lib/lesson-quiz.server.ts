import { and, desc, eq } from "drizzle-orm";
import { db } from "~/db";
import {
  quizAnswers,
  quizAttempts,
  quizOptions,
  quizQuestions,
  quizzes,
} from "~/db/schema";

export function getQuizByLessonId(lessonId: number) {
  return db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).get();
}

export function getQuizWithQuestions(quizId: number) {
  const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) return null;

  const questions = db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.position)
    .all();

  const questionsWithOptions = questions.map((question) => {
    const options = db
      .select()
      .from(quizOptions)
      .where(eq(quizOptions.questionId, question.id))
      .all();
    return { ...question, options };
  });

  return { ...quiz, questions: questionsWithOptions };
}

export function getBestAttempt(userId: number, quizId: number) {
  return db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId))
    )
    .orderBy(desc(quizAttempts.score))
    .limit(1)
    .get();
}

export function calculateGrade(score: number): string {
  if (score >= 0.9) return "A";
  if (score >= 0.8) return "B";
  if (score >= 0.7) return "C";
  if (score >= 0.6) return "D";
  return "F";
}

type QuestionResult = {
  questionId: number;
  correct: boolean;
  selectedOptionId: number | null;
  correctOptionId: number | null;
};

export function computeResult(
  userId: number,
  quizId: number,
  selectedAnswers: Record<number, number>
) {
  try {
    const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
    if (!quiz) {
      console.error("quiz not found");
      return null;
    }

    const questions = db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.position)
      .all();

    const total = questions.length;
    const questionResults = questions.map((question) =>
      getQuestionResult(question, selectedAnswers)
    );
    const correct = questionResults.filter((result) => result.correct).length;
    const scoreValue = total > 0 ? correct / total : 0;
    const passed = scoreValue > 0.7;
    const grade = calculateGrade(scoreValue);

    return recordQuizAttempt({
      userId,
      quizId,
      score: scoreValue,
      passed,
      grade,
      totalCorrect: correct,
      totalQuestions: total,
      questionResults,
    });
  } catch (error) {
    console.error(error);
    return null;
  }
}

function getQuestionResult(
  question: { id: number; questionType: string },
  selectedAnswers: Record<number, number>
): QuestionResult {
  const selectedOptionId = selectedAnswers[question.id];
  if (selectedOptionId === undefined) {
    return {
      questionId: question.id,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    };
  }
  const correctOptionId = getCorrectOptionId(question);
  return {
    questionId: question.id,
    correct: selectedOptionId === correctOptionId,
    selectedOptionId,
    correctOptionId,
  };
}

function getCorrectOptionId(question: { id: number; questionType: string }) {
  if (question.questionType === "multiple_choice") {
    const options = db
      .select()
      .from(quizOptions)
      .where(eq(quizOptions.questionId, question.id))
      .all();
    return options.find((option) => option.isCorrect === true)?.id ?? null;
  }
  if (question.questionType === "true_false") {
    const correctOption = db
      .select({ id: quizOptions.id })
      .from(quizOptions)
      .where(
        and(
          eq(quizOptions.questionId, question.id),
          eq(quizOptions.isCorrect, true)
        )
      )
      .get();
    return correctOption?.id ?? null;
  }
  return null;
}

function recordQuizAttempt({
  userId,
  quizId,
  score,
  passed,
  grade,
  totalCorrect,
  totalQuestions,
  questionResults,
}: {
  userId: number;
  quizId: number;
  score: number;
  passed: boolean;
  grade: string;
  totalCorrect: number;
  totalQuestions: number;
  questionResults: QuestionResult[];
}) {
  const attempt = db
    .insert(quizAttempts)
    .values({ userId, quizId, score, passed })
    .returning()
    .get();

  for (const result of questionResults) {
    if (result.selectedOptionId === null) continue;
    db.insert(quizAnswers)
      .values({
        attemptId: attempt.id,
        questionId: result.questionId,
        selectedOptionId: result.selectedOptionId,
      })
      .run();
  }
  return {
    attemptId: attempt.id,
    score,
    passed,
    grade,
    totalCorrect,
    totalQuestions,
    questionResults,
  };
}
