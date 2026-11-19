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

export function getQuizForLesson(lessonId: number, quizId: number) {
  return db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.lessonId, lessonId), eq(quizzes.id, quizId)))
    .get();
}

export function getQuizWithQuestions(quizId: number) {
  const quiz = db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  if (!quiz) return null;

  const rows = db
    .select({ question: quizQuestions, option: quizOptions })
    .from(quizQuestions)
    .leftJoin(quizOptions, eq(quizOptions.questionId, quizQuestions.id))
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.position)
    .all();

  const questionsWithOptions = new Map<
    number,
    (typeof rows)[number]["question"] & {
      options: (typeof quizOptions.$inferSelect)[];
    }
  >();
  for (const { question, option } of rows) {
    let questionWithOptions = questionsWithOptions.get(question.id);
    if (!questionWithOptions) {
      questionWithOptions = { ...question, options: [] };
      questionsWithOptions.set(question.id, questionWithOptions);
    }
    if (option) questionWithOptions.options.push(option);
  }

  return { ...quiz, questions: [...questionsWithOptions.values()] };
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
    const correctOptionIds = getCorrectOptionIds(quizId);
    const questionResults = questions.map((question) =>
      getQuestionResult(question, selectedAnswers, correctOptionIds)
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
  selectedAnswers: Record<number, number>,
  correctOptionIds: Map<number, number>
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
  const correctOptionId = correctOptionIds.get(question.id) ?? null;
  return {
    questionId: question.id,
    correct: selectedOptionId === correctOptionId,
    selectedOptionId,
    correctOptionId,
  };
}

function getCorrectOptionIds(quizId: number) {
  const correctOptions = db
    .select({
      questionId: quizOptions.questionId,
      id: quizOptions.id,
    })
    .from(quizOptions)
    .innerJoin(quizQuestions, eq(quizQuestions.id, quizOptions.questionId))
    .where(
      and(eq(quizQuestions.quizId, quizId), eq(quizOptions.isCorrect, true))
    )
    .all();
  return new Map(
    correctOptions.map((option) => [option.questionId, option.id])
  );
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
  return db.transaction((tx) => {
    const attempt = tx
      .insert(quizAttempts)
      .values({ userId, quizId, score, passed })
      .returning()
      .get();

    for (const result of questionResults) {
      if (result.selectedOptionId === null) continue;
      tx.insert(quizAnswers)
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
  });
}
