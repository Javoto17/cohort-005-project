import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { alias, type SQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  ne,
  notExists,
  or,
  sql,
  sum,
} from "drizzle-orm";
import * as schema from "~/db/schema";
import {
  CourseStatus,
  LessonProgressStatus,
  UserRole,
  comments,
  courseRatings,
  courses,
  coupons,
  enrollments,
  lessonProgress,
  lessons,
  modules,
  purchases,
  quizAttempts,
  quizzes,
  users,
} from "~/db/schema";
import {
  parseAnalyticsRange,
  rangeStart,
  splitRevenue,
  REFUND_WINDOW_DAYS,
  type AnalyticsRange,
} from "./analytics";
import { getDiscountForCountry } from "./ppp";

type AnalyticsDb = BetterSQLite3Database<typeof schema>;
type AnalyticsTab = "overview" | "course";
type AnalyticsViewer = { userId: number; isAdmin: boolean };
type AnalyticsInput = {
  viewer: AnalyticsViewer;
  searchParams: URLSearchParams;
};
type AnalyticsDependencies = { db: AnalyticsDb; now: Date };

type RevenueSummary = {
  grossCents: number;
  feeCents: number;
  netCents: number;
  purchaseCount: number;
};
type RevenuePoint = { bucket: string; grossCents: number; netCents: number };
export type RevenueSeries = {
  granularity: "day" | "month";
  points: RevenuePoint[];
};
type StudentRevenue = { userId: number; name: string; revenueCents: number };
type TopBuyer = {
  userId: number;
  name: string;
  email: string;
  spendCents: number;
  purchaseCount: number;
  seatsBought: number;
  seatsUnredeemed: number;
  enrolled: boolean;
};
type RatingSummary = { average: number | null; count: number };
export type CourseProgressSummary = {
  enrolledCount: number;
  totalLessons: number;
  averageProgressPercent: number | null;
  finishedCount: number;
};
export type FunnelLesson = {
  lessonId: number;
  title: string;
  reachedCount: number;
  dropFromPrevious: number;
};
type FunnelModule = {
  moduleId: number;
  title: string;
  reachedCount: number;
  dropWithin: number;
  lessons: FunnelLesson[];
};
export type CourseFunnel = { enrolledCount: number; modules: FunnelModule[] };
export type QuizPassRate = {
  quizId: number;
  title: string;
  moduleTitle: string;
  lessonTitle: string;
  passingScorePercent: number;
  studentCount: number;
  passedCount: number;
  passRatePercent: number | null;
  averageBestScorePercent: number | null;
};
type CountryRevenueRow = {
  country: string | null;
  purchaseCount: number;
  grossCents: number;
  netCents: number;
  sharePercent: number;
  averagePaidCents: number;
  discountPercent: number | null;
};
export type CourseCountryRevenue = {
  grossCents: number;
  netCents: number;
  purchaseCount: number;
  discountedGrossCents: number;
  discountedNetCents: number;
  discountedSharePercent: number;
  rows: CountryRevenueRow[];
};
type ExposedCourse = {
  courseId: number;
  title: string;
  grossCents: number;
  purchaseCount: number;
  daysLeft: number;
};
export type RefundExposure = {
  grossCents: number;
  netCents: number;
  purchaseCount: number;
  sharePercent: number;
  closingTodayCount: number;
  courses: ExposedCourse[];
};

/** A search param that should be a row id, or null if it isn't one. */
function parseId(value: string | null): number | null {
  const id = Number(value);
  return value !== null && Number.isInteger(id) && id > 0 ? id : null;
}

// Every timestamped query shares the same inclusive cutoff.
function scopeOn(
  dateColumn: SQLiteColumn,
  instructorId: number | null,
  start: string | null
) {
  return and(ownedBy(instructorId), sinceRange(dateColumn, start));
}

function purchaseScope(instructorId: number | null, start: string | null) {
  return scopeOn(purchases.createdAt, instructorId, start);
}

function sinceRange(dateColumn: SQLiteColumn, start: string | null) {
  return start === null ? undefined : gte(dateColumn, start);
}

function ownedBy(instructorId: number | null) {
  return instructorId === null
    ? undefined
    : eq(courses.instructorId, instructorId);
}

function getStudentRevenue(
  db: AnalyticsDb,
  instructorId: number | null,
  start: string | null
): StudentRevenue[] {
  const students = db
    .selectDistinct({ userId: users.id, name: users.name })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(scopeOn(enrollments.enrolledAt, instructorId, start))
    .orderBy(users.name)
    .all();
  if (students.length === 0) return [];
  const studentIds = students.map((student) => student.userId);

  // Correlated: did this purchase mint seats for other people?
  const mintedSeats = db
    .select({ one: sql`1` })
    .from(coupons)
    .where(eq(coupons.purchaseId, purchases.id));
  // Revenue follows the selected enrollees, even when their purchases are older.
  const direct = db
    .select({ userId: purchases.userId, paid: sum(purchases.amountPaid) })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        inArray(purchases.userId, studentIds),
        notExists(mintedSeats),
        ownedBy(instructorId)
      )
    )
    .groupBy(purchases.userId)
    .all();
  const seatCounts = db
    .select({ purchaseId: coupons.purchaseId, seats: count().as("seats") })
    .from(coupons)
    .groupBy(coupons.purchaseId)
    .as("seat_counts");
  const viaSeat = db
    .select({
      userId: coupons.redeemedByUserId,
      // Sum fractional shares before rounding, so five seats out of 3333 cents add up.
      paid: sql<number>`sum(${purchases.amountPaid} * 1.0 / ${seatCounts.seats})`,
    })
    .from(coupons)
    .innerJoin(purchases, eq(coupons.purchaseId, purchases.id))
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .innerJoin(seatCounts, eq(seatCounts.purchaseId, coupons.purchaseId))
    .where(
      and(inArray(coupons.redeemedByUserId, studentIds), ownedBy(instructorId))
    )
    .groupBy(coupons.redeemedByUserId)
    .all();
  const paidByUser = new Map<number, number>();
  const credit = (userId: number | null, paid: unknown) => {
    if (userId === null) return;
    paidByUser.set(userId, (paidByUser.get(userId) ?? 0) + Number(paid ?? 0));
  };
  for (const row of direct) credit(row.userId, row.paid);
  for (const row of viaSeat) credit(row.userId, row.paid);
  return students.map((student) => ({
    ...student,
    revenueCents: Math.round(paidByUser.get(student.userId) ?? 0),
  }));
}

const TOP_BUYER_LIMIT = 10;
function getTopBuyers(
  db: AnalyticsDb,
  instructorId: number | null,
  start: string | null
): TopBuyer[] {
  const buyers = db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      spend: sum(purchases.amountPaid),
      purchaseCount: count(purchases.id),
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .innerJoin(users, eq(users.id, purchases.userId))
    .where(purchaseScope(instructorId, start))
    .groupBy(users.id)
    .orderBy(desc(sum(purchases.amountPaid)))
    .limit(TOP_BUYER_LIMIT)
    .all();
  if (buyers.length === 0) return [];
  const buyerIds = buyers.map((buyer) => buyer.userId);
  // A separate query avoids multiplying spend once per seat.
  const seats = db
    .select({
      userId: purchases.userId,
      bought: count(coupons.id),
      unredeemed: sql<number>`sum(case when ${coupons.redeemedByUserId} is null then 1 else 0 end)`,
    })
    .from(coupons)
    .innerJoin(purchases, eq(coupons.purchaseId, purchases.id))
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(
      and(
        inArray(purchases.userId, buyerIds),
        purchaseScope(instructorId, start)
      )
    )
    .groupBy(purchases.userId)
    .all();
  const seatsByUser = new Map(seats.map((row) => [row.userId, row]));
  // "Never enrolled" is a fact about the person, not the selected period.
  const enrolled = new Set(
    db
      .selectDistinct({ userId: enrollments.userId })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(and(inArray(enrollments.userId, buyerIds), ownedBy(instructorId)))
      .all()
      .map((row) => row.userId)
  );
  return buyers.map((buyer) => ({
    userId: buyer.userId,
    name: buyer.name,
    email: buyer.email,
    spendCents: Number(buyer.spend ?? 0),
    purchaseCount: buyer.purchaseCount,
    seatsBought: seatsByUser.get(buyer.userId)?.bought ?? 0,
    seatsUnredeemed: Number(seatsByUser.get(buyer.userId)?.unredeemed ?? 0),
    enrolled: enrolled.has(buyer.userId),
  }));
}

function getRatingSummary(
  db: AnalyticsDb,
  instructorId: number | null,
  start: string | null
): RatingSummary {
  const row = db
    .select({
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: count(courseRatings.id),
    })
    .from(courseRatings)
    .innerJoin(courses, eq(courseRatings.courseId, courses.id))
    .where(scopeOn(courseRatings.createdAt, instructorId, start))
    .get();
  if (!row || row.count === 0 || row.average === null)
    return { average: null, count: 0 };
  return { average: Math.round(row.average * 10) / 10, count: row.count };
}

/** The bucket an ISO timestamp falls in, at the given granularity. */
function bucketOf(iso: string, granularity: "day" | "month"): string {
  return iso.slice(0, granularity === "day" ? 10 : 7);
}

/** Every bucket from `first` to `last` inclusive, with none skipped. */
function bucketRange(
  first: string,
  last: string,
  granularity: "day" | "month"
): string[] {
  const buckets: string[] = [];
  const cursor = new Date(
    `${first}${granularity === "day" ? "" : "-01"}T00:00:00.000Z`
  );
  while (bucketOf(cursor.toISOString(), granularity) <= last) {
    buckets.push(bucketOf(cursor.toISOString(), granularity));
    if (granularity === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return buckets;
}

function getRevenueOverTime(
  db: AnalyticsDb,
  instructorId: number | null,
  range: AnalyticsRange,
  start: string | null,
  now: Date
): RevenueSeries {
  const granularity = range === "all" ? "month" : "day";
  const bucketExpr = sql<string>`substr(${purchases.createdAt}, 1, ${granularity === "day" ? 10 : 7})`;
  const rows = db
    .select({ bucket: bucketExpr, gross: sum(purchases.amountPaid) })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(purchaseScope(instructorId, start))
    .groupBy(bucketExpr)
    .orderBy(bucketExpr)
    .all();
  if (rows.length === 0 && range === "all") return { granularity, points: [] };
  const grossByBucket = new Map(
    rows.map((row) => [row.bucket, Number(row.gross ?? 0)])
  );
  // Fixed ranges span the whole window; all time begins with the first sale.
  const first = start ?? rows[0].bucket;
  const points = bucketRange(
    bucketOf(first, granularity),
    bucketOf(now.toISOString(), granularity),
    granularity
  ).map((bucket) => {
    const { grossCents, netCents } = splitRevenue(
      grossByBucket.get(bucket) ?? 0
    );
    return { bucket, grossCents, netCents };
  });
  return { granularity, points };
}

/** Every lesson of a course, as a subquery for the progress joins. */
function courseLessonIds(db: AnalyticsDb, courseId: number) {
  return db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId));
}

function getCourseProgressSummary(
  db: AnalyticsDb,
  courseId: number
): CourseProgressSummary {
  const totals = db
    .select({ totalLessons: count(lessons.id) })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .get();
  const totalLessons = totals?.totalLessons ?? 0;
  // Keep enrollees who never started: they are part of the denominator.
  const perStudent = db
    .select({
      userId: enrollments.userId,
      completed: countDistinct(lessonProgress.lessonId),
    })
    .from(enrollments)
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.userId, enrollments.userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        inArray(lessonProgress.lessonId, courseLessonIds(db, courseId))
      )
    )
    .where(eq(enrollments.courseId, courseId))
    .groupBy(enrollments.userId)
    .all();
  if (perStudent.length === 0 || totalLessons === 0) {
    return {
      enrolledCount: perStudent.length,
      totalLessons,
      averageProgressPercent: null,
      finishedCount: 0,
    };
  }
  const totalPercent = perStudent.reduce(
    (running, student) => running + (student.completed / totalLessons) * 100,
    0
  );
  return {
    enrolledCount: perStudent.length,
    totalLessons,
    averageProgressPercent: Math.round(totalPercent / perStudent.length),
    finishedCount: perStudent.filter(
      (student) => student.completed >= totalLessons
    ).length,
  };
}

const REACHED_STATUSES = [
  LessonProgressStatus.InProgress,
  LessonProgressStatus.Completed,
];
function getCourseDropOff(db: AnalyticsDb, courseId: number): CourseFunnel {
  const enrolled = db
    .select({ enrolledCount: countDistinct(enrollments.userId) })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();
  const enrolledCount = enrolled?.enrolledCount ?? 0;
  const curriculum = db
    .select({
      moduleId: modules.id,
      moduleTitle: modules.title,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
    })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position, lessons.position)
    .all();
  if (curriculum.length === 0) return { enrolledCount, modules: [] };
  const positionOf = new Map(
    curriculum.map((row, position) => [row.lessonId, position])
  );
  // Progress from somebody not enrolled must not inflate the funnel.
  const touched = db
    .selectDistinct({
      userId: lessonProgress.userId,
      lessonId: lessonProgress.lessonId,
    })
    .from(lessonProgress)
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.userId, lessonProgress.userId),
        eq(enrollments.courseId, courseId)
      )
    )
    .where(
      and(
        inArray(lessonProgress.lessonId, courseLessonIds(db, courseId)),
        inArray(lessonProgress.status, REACHED_STATUSES)
      )
    )
    .all();
  const furthest = new Map<number, number>();
  for (const row of touched) {
    const position = positionOf.get(row.lessonId);
    if (position === undefined) continue;
    furthest.set(
      row.userId,
      Math.max(furthest.get(row.userId) ?? -1, position)
    );
  }
  // Reaching a later lesson implies passing through every preceding one.
  const stoppedAt = curriculum.map(() => 0);
  for (const position of furthest.values()) stoppedAt[position] += 1;
  const reachedAt: number[] = [];
  let running = 0;
  for (let position = curriculum.length - 1; position >= 0; position--) {
    running += stoppedAt[position];
    reachedAt[position] = running;
  }
  const grouped: FunnelModule[] = [];
  let previousReached = enrolledCount;
  curriculum.forEach((row, position) => {
    const reachedCount = reachedAt[position];
    const lesson: FunnelLesson = {
      lessonId: row.lessonId,
      title: row.lessonTitle,
      reachedCount,
      dropFromPrevious: previousReached - reachedCount,
    };
    previousReached = reachedCount;
    const current = grouped.at(-1);
    if (current?.moduleId === row.moduleId) {
      current.lessons.push(lesson);
      current.dropWithin = current.reachedCount - reachedCount;
    } else {
      grouped.push({
        moduleId: row.moduleId,
        title: row.moduleTitle,
        reachedCount,
        dropWithin: 0,
        lessons: [lesson],
      });
    }
  });
  return { enrolledCount, modules: grouped };
}

function getCourseQuizPassRates(
  db: AnalyticsDb,
  courseId: number,
  start: string | null
): QuizPassRate[] {
  const quizRows = db
    .select({
      quizId: quizzes.id,
      title: quizzes.title,
      passingScore: quizzes.passingScore,
      moduleTitle: modules.title,
      lessonTitle: lessons.title,
    })
    .from(quizzes)
    .innerJoin(lessons, eq(quizzes.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position, lessons.position, quizzes.id)
    .all();
  if (quizRows.length === 0) return [];
  const quizIds = quizRows.map((quiz) => quiz.quizId);
  // SQLite takes bare `passed` from the row providing max(score), preserving
  // the recorded verdict of each student's best attempt rather than recalculating it.
  const bestAttempts = db
    .select({
      quizId: quizAttempts.quizId,
      bestScore: sql<number>`max(${quizAttempts.score})`.as("best_score"),
      passed: sql<number>`${quizAttempts.passed}`.as("best_passed"),
    })
    .from(quizAttempts)
    .where(
      and(
        inArray(quizAttempts.quizId, quizIds),
        sinceRange(quizAttempts.attemptedAt, start)
      )
    )
    .groupBy(quizAttempts.quizId, quizAttempts.userId)
    .as("best_attempts");
  const stats = db
    .select({
      quizId: bestAttempts.quizId,
      studentCount: count(),
      passedCount: sql<number>`sum(${bestAttempts.passed})`,
      averageBestScore: sql<number>`avg(${bestAttempts.bestScore})`,
    })
    .from(bestAttempts)
    .groupBy(bestAttempts.quizId)
    .all();
  const statsByQuiz = new Map(stats.map((row) => [row.quizId, row]));
  return quizRows.map((quiz) => {
    const row = statsByQuiz.get(quiz.quizId);
    const studentCount = row?.studentCount ?? 0;
    const passedCount = Number(row?.passedCount ?? 0);
    return {
      quizId: quiz.quizId,
      title: quiz.title,
      moduleTitle: quiz.moduleTitle,
      lessonTitle: quiz.lessonTitle,
      passingScorePercent: Math.round(quiz.passingScore * 100),
      studentCount,
      passedCount,
      passRatePercent:
        studentCount === 0
          ? null
          : Math.round((passedCount / studentCount) * 100),
      averageBestScorePercent:
        studentCount === 0
          ? null
          : Math.round(Number(row?.averageBestScore ?? 0) * 100),
    };
  });
}

function getCourseRevenueByCountry(
  db: AnalyticsDb,
  courseId: number,
  start: string | null
): CourseCountryRevenue {
  const rows = db
    .select({
      country: purchases.country,
      gross: sum(purchases.amountPaid),
      purchaseCount: count(purchases.id),
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.courseId, courseId),
        sinceRange(purchases.createdAt, start)
      )
    )
    .groupBy(purchases.country)
    .all()
    .map((row) => ({
      country: row.country,
      grossCents: Number(row.gross ?? 0),
      purchaseCount: row.purchaseCount,
    }))
    .sort((a, b) => b.grossCents - a.grossCents);
  const grossCents = rows.reduce((total, row) => total + row.grossCents, 0);
  const purchaseCount = rows.reduce(
    (total, row) => total + row.purchaseCount,
    0
  );
  const share = (cents: number) =>
    grossCents === 0 ? 0 : Math.round((cents / grossCents) * 100);
  let discountedGrossCents = 0;
  const breakdown = rows.map((row) => {
    const discountPercent =
      row.country === null ? null : getDiscountForCountry(row.country) * 100;
    if (discountPercent !== null && discountPercent > 0)
      discountedGrossCents += row.grossCents;
    return {
      ...row,
      netCents: splitRevenue(row.grossCents).netCents,
      sharePercent: share(row.grossCents),
      averagePaidCents: Math.round(row.grossCents / row.purchaseCount),
      discountPercent,
    };
  });
  return {
    grossCents,
    netCents: splitRevenue(grossCents).netCents,
    purchaseCount,
    discountedGrossCents,
    discountedNetCents: splitRevenue(discountedGrossCents).netCents,
    discountedSharePercent: share(discountedGrossCents),
    rows: breakdown,
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Preserve local calendar-day refund semantics; revenue buckets remain UTC.
function calendarDay(when: Date): string {
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${when.getFullYear()}-${month}-${day}`;
}

function lastDayOfRefundWindow(purchasedAtIso: string): string {
  const deadline = new Date(purchasedAtIso);
  deadline.setDate(deadline.getDate() + REFUND_WINDOW_DAYS);
  return calendarDay(deadline);
}

/**
 * Reads analytics for an already authenticated instructor or admin.
 * Enforces viewer scope and validates course selection before reading detail.
 * Uses only the supplied instant and connection; performs no writes.
 * Query errors propagate to the caller.
 */
export function getInstructorAnalytics(
  { viewer: { userId, isAdmin }, searchParams }: AnalyticsInput,
  { db, now }: AnalyticsDependencies
) {
  const range = parseAnalyticsRange(searchParams.get("range"));
  const start = rangeStart(range, now);
  const tab: AnalyticsTab =
    searchParams.get("tab") === "course" ? "course" : "overview";
  // Only admins may select another instructor; null means platform-wide.
  const instructorId = isAdmin
    ? parseId(searchParams.get("instructor"))
    : userId;
  const courseOptions = db
    .select({ courseId: courses.id, title: courses.title })
    .from(courses)
    .where(ownedBy(instructorId))
    .orderBy(courses.title)
    .all();
  const requestedCourseId = parseId(searchParams.get("course"));
  const selectedCourseId = courseOptions.some(
    (course) => course.courseId === requestedCourseId
  )
    ? requestedCourseId
    : null;

  const questionAuthor = alias(users, "author");
  const reply = alias(comments, "reply");
  const replyAuthor = alias(users, "reply_author");
  const staffReply = db
    .select({ one: sql`1` })
    .from(reply)
    .innerJoin(replyAuthor, eq(replyAuthor.id, reply.userId))
    .where(
      and(
        eq(reply.parentId, comments.id),
        isNull(reply.deletedAt),
        or(
          eq(replyAuthor.role, UserRole.Admin),
          eq(reply.userId, courses.instructorId)
        )
      )
    );
  // Live top-level student questions without a live staff reply.
  const questionRow = db
    .select({
      inRange:
        start === null
          ? count(comments.id)
          : sql<number>`sum(case when ${comments.createdAt} >= ${start} then 1 else 0 end)`,
      total: count(comments.id),
    })
    .from(comments)
    .innerJoin(questionAuthor, eq(comments.userId, questionAuthor.id))
    .innerJoin(lessons, eq(comments.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(
      and(
        isNull(comments.parentId),
        isNull(comments.deletedAt),
        ne(questionAuthor.role, UserRole.Admin),
        ne(comments.userId, courses.instructorId),
        notExists(staffReply),
        ownedBy(instructorId)
      )
    )
    .get();
  const questionsInRange = Number(questionRow?.inRange ?? 0);
  const questions = {
    inRange: questionsInRange,
    older: (questionRow?.total ?? 0) - questionsInRange,
  };
  const summaryRow = db
    .select({
      gross: sum(purchases.amountPaid),
      purchaseCount: count(purchases.id),
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(purchaseScope(instructorId, start))
    .get();
  const summary: RevenueSummary = {
    ...splitRevenue(Number(summaryRow?.gross ?? 0)),
    purchaseCount: summaryRow?.purchaseCount ?? 0,
  };
  const courseRevenueRows = db
    .select({
      courseId: courses.id,
      title: courses.title,
      gross: sum(purchases.amountPaid),
      purchaseCount: count(purchases.id),
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(purchaseScope(instructorId, start))
    .groupBy(courses.id)
    .all();
  const courseRevenue = courseRevenueRows
    .map((row) => ({
      courseId: row.courseId,
      title: row.title,
      ...splitRevenue(Number(row.gross ?? 0)),
      purchaseCount: row.purchaseCount,
    }))
    .sort((a, b) => b.grossCents - a.grossCents);
  const buyerCountRow = db
    .select({ buyerCount: countDistinct(purchases.userId) })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(purchaseScope(instructorId, start))
    .get();
  const students = getStudentRevenue(db, instructorId, start);
  const attributedRevenue = students.reduce(
    (total, student) => total + student.revenueCents,
    0
  );
  const audience = {
    buyerCount: buyerCountRow?.buyerCount ?? 0,
    studentCount: students.length,
    revenuePerStudentCents:
      students.length === 0
        ? null
        : Math.round(attributedRevenue / students.length),
  };
  // Owners, including admins who own courses, rather than just users with an instructor role.
  const instructors = isAdmin
    ? db
        .selectDistinct({ id: users.id, name: users.name })
        .from(courses)
        .innerJoin(users, eq(courses.instructorId, users.id))
        .orderBy(users.name)
        .all()
    : [];
  const publishedRow =
    instructorId === null
      ? undefined
      : db
          .select({ id: courses.id })
          .from(courses)
          .where(
            and(
              eq(courses.instructorId, instructorId),
              eq(courses.status, CourseStatus.Published)
            )
          )
          .get();
  const exposureRows = db
    .select({
      courseId: courses.id,
      title: courses.title,
      amountPaid: purchases.amountPaid,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(purchaseScope(instructorId, start))
    .all();
  const today = calendarDay(now);
  const exposedByCourse = new Map<number, ExposedCourse>();
  let exposedGrossCents = 0;
  let exposedPurchaseCount = 0;
  let closingTodayCount = 0;
  for (const row of exposureRows) {
    const lastDay = lastDayOfRefundWindow(row.createdAt);
    if (today > lastDay) continue;
    const daysLeft = Math.round(
      (new Date(`${lastDay}T00:00:00.000Z`).getTime() -
        new Date(`${today}T00:00:00.000Z`).getTime()) /
        MS_PER_DAY
    );
    exposedGrossCents += row.amountPaid;
    exposedPurchaseCount += 1;
    if (daysLeft === 0) closingTodayCount += 1;
    const existing = exposedByCourse.get(row.courseId);
    if (existing === undefined) {
      exposedByCourse.set(row.courseId, {
        courseId: row.courseId,
        title: row.title,
        grossCents: row.amountPaid,
        purchaseCount: 1,
        daysLeft,
      });
    } else {
      existing.grossCents += row.amountPaid;
      existing.purchaseCount += 1;
      existing.daysLeft = Math.min(existing.daysLeft, daysLeft);
    }
  }
  const refundExposure: RefundExposure = {
    grossCents: exposedGrossCents,
    netCents: splitRevenue(exposedGrossCents).netCents,
    purchaseCount: exposedPurchaseCount,
    sharePercent:
      summary.grossCents === 0
        ? 0
        : Math.round((exposedGrossCents / summary.grossCents) * 100),
    closingTodayCount,
    courses: [...exposedByCourse.values()].sort(
      (a, b) => b.grossCents - a.grossCents
    ),
  };
  return {
    questions,
    audience,
    buyers: getTopBuyers(db, instructorId, start),
    ratings: getRatingSummary(db, instructorId, start),
    tab,
    range,
    isAdmin,
    instructorId,
    selectedCourseId,
    summary,
    series: getRevenueOverTime(db, instructorId, range, start, now),
    courses: courseRevenue,
    courseOptions,
    // Progress and drop-off have no usable timestamp and always span all time.
    progress:
      selectedCourseId === null
        ? null
        : getCourseProgressSummary(db, selectedCourseId),
    funnel:
      selectedCourseId === null ? null : getCourseDropOff(db, selectedCourseId),
    quizzes:
      selectedCourseId === null
        ? null
        : getCourseQuizPassRates(db, selectedCourseId, start),
    countries:
      selectedCourseId === null
        ? null
        : getCourseRevenueByCountry(db, selectedCourseId, start),
    instructors,
    refundExposure,
    unpublished: instructorId !== null && publishedRow === undefined,
  };
}

export type InstructorAnalyticsData = ReturnType<typeof getInstructorAnalytics>;
