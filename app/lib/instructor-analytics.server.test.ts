import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { markdown } from "./text";
import { getInstructorAnalytics } from "./instructor-analytics.server";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const CUTOFF = "2026-06-08T12:00:00.000Z";
const BEFORE_CUTOFF = "2026-06-08T11:59:59.999Z";
let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

afterEach(() => {
  db.$client.close();
});

function read(
  params = "",
  viewer = { userId: base.instructor.id, isAdmin: false },
  now = NOW
) {
  return getInstructorAnalytics(
    { viewer, searchParams: new URLSearchParams(params) },
    { db, now }
  );
}

function addUser(name: string, role = schema.UserRole.Student) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name}@example.com`,
      role,
    })
    .returning()
    .get();
}

function buy(
  amountPaid: number,
  createdAt = NOW.toISOString(),
  courseId = base.course.id,
  userId = base.user.id,
  country: string | null = null
) {
  return db
    .insert(schema.purchases)
    .values({
      userId,
      courseId,
      amountPaid,
      createdAt,
      country,
    })
    .returning()
    .get();
}

function curriculum() {
  const module = db
    .insert(schema.modules)
    .values({
      courseId: base.course.id,
      title: "Basics",
      position: 1,
    })
    .returning()
    .get();
  const lessons = [1, 2].map((position) =>
    db
      .insert(schema.lessons)
      .values({
        moduleId: module.id,
        title: `Lesson ${position}`,
        position,
      })
      .returning()
      .get()
  );
  return { module, lessons };
}

describe("getInstructorAnalytics", () => {
  it("returns the existing empty result and defaults without changing input", () => {
    const searchParams = new URLSearchParams(
      "range=invalid&tab=invalid&course=bad"
    );
    const before = searchParams.toString();
    const now = new Date(NOW);
    const result = getInstructorAnalytics(
      { viewer: { userId: base.instructor.id, isAdmin: false }, searchParams },
      { db, now }
    );

    expect(result).toMatchObject({
      tab: "overview",
      range: "30d",
      instructorId: base.instructor.id,
      isAdmin: false,
      selectedCourseId: null,
      unpublished: false,
      summary: { grossCents: 0, feeCents: 0, netCents: 0, purchaseCount: 0 },
      audience: {
        buyerCount: 0,
        studentCount: 0,
        revenuePerStudentCents: null,
      },
      questions: { inRange: 0, older: 0 },
      ratings: { average: null, count: 0 },
      buyers: [],
      courses: [],
      instructors: [],
      progress: null,
      funnel: null,
      quizzes: null,
      countries: null,
      refundExposure: {
        grossCents: 0,
        netCents: 0,
        purchaseCount: 0,
        sharePercent: 0,
        closingTodayCount: 0,
        courses: [],
      },
    });
    expect(result.courseOptions).toEqual([
      { courseId: base.course.id, title: base.course.title },
    ]);
    expect(searchParams.toString()).toBe(before);
    expect(now.getTime()).toBe(NOW.getTime());
  });

  it("ignores another instructor in the URL and rejects their course", () => {
    const other = addUser("other", schema.UserRole.Instructor);
    const course = db
      .insert(schema.courses)
      .values({
        ...base.course,
        id: undefined,
        slug: "other-course",
        instructorId: other.id,
      })
      .returning()
      .get();
    buy(1000);
    buy(9000, NOW.toISOString(), course.id);

    const result = read(
      `instructor=${other.id}&course=${course.id}&tab=course`
    );
    expect(result.instructorId).toBe(base.instructor.id);
    expect(result.summary.grossCents).toBe(1000);
    expect(result.courseOptions.map((row) => row.courseId)).toEqual([
      base.course.id,
    ]);
    expect(result.courses.map((row) => row.courseId)).toEqual([base.course.id]);
    expect(result).toMatchObject({
      tab: "course",
      selectedCourseId: null,
      progress: null,
      funnel: null,
      quizzes: null,
      countries: null,
    });
  });

  it("allows admins to view all owners, including admins, or one instructor", () => {
    const admin = addUser("admin", schema.UserRole.Admin);
    const course = db
      .insert(schema.courses)
      .values({
        ...base.course,
        id: undefined,
        slug: "admin-course",
        instructorId: admin.id,
      })
      .returning()
      .get();
    buy(1000);
    buy(2000, NOW.toISOString(), course.id);
    const viewer = { userId: admin.id, isAdmin: true };

    const all = read(`course=${course.id}`, viewer);
    expect(all.instructorId).toBeNull();
    expect(all.summary.grossCents).toBe(3000);
    expect(all.selectedCourseId).toBe(course.id);
    expect(all.instructors.map((row) => row.id).sort()).toEqual(
      [base.instructor.id, admin.id].sort()
    );
    expect(all.unpublished).toBe(false);

    const scoped = read(
      `instructor=${base.instructor.id}&course=${course.id}`,
      viewer
    );
    expect(scoped.summary.grossCents).toBe(1000);
    expect(scoped.selectedCourseId).toBeNull();
    expect(scoped.courseOptions.map((row) => row.courseId)).toEqual([
      base.course.id,
    ]);
  });

  it.each(["bad", "0", "-1", "1.5", "999999"])(
    "ignores an invalid or unknown course: %s",
    (course) => {
      const result = read(`course=${course}`);
      expect(result).toMatchObject({
        selectedCourseId: null,
        progress: null,
        funnel: null,
        quizzes: null,
        countries: null,
      });
    }
  );

  it("includes the exact cutoff across all timestamped panels and fills empty days", () => {
    const { lessons } = curriculum();
    const oldStudent = addUser("old-student");
    buy(1001, CUTOFF, base.course.id, base.user.id, "US");
    buy(9000, BEFORE_CUTOFF, base.course.id, oldStudent.id, "US");
    db.insert(schema.enrollments)
      .values([
        { courseId: base.course.id, userId: base.user.id, enrolledAt: CUTOFF },
        {
          courseId: base.course.id,
          userId: oldStudent.id,
          enrolledAt: BEFORE_CUTOFF,
        },
      ])
      .run();
    db.insert(schema.courseRatings)
      .values([
        {
          courseId: base.course.id,
          userId: base.user.id,
          rating: 5,
          createdAt: CUTOFF,
        },
        {
          courseId: base.course.id,
          userId: oldStudent.id,
          rating: 1,
          createdAt: BEFORE_CUTOFF,
        },
      ])
      .run();
    db.insert(schema.comments)
      .values([
        {
          lessonId: lessons[0].id,
          userId: base.user.id,
          body: markdown("New"),
          createdAt: CUTOFF,
        },
        {
          lessonId: lessons[0].id,
          userId: oldStudent.id,
          body: markdown("Old"),
          createdAt: BEFORE_CUTOFF,
        },
      ])
      .run();
    const quiz = db
      .insert(schema.quizzes)
      .values({
        lessonId: lessons[0].id,
        title: "Quiz",
        passingScore: 0.7,
      })
      .returning()
      .get();
    db.insert(schema.quizAttempts)
      .values([
        {
          quizId: quiz.id,
          userId: base.user.id,
          score: 0.8,
          passed: true,
          attemptedAt: CUTOFF,
        },
        {
          quizId: quiz.id,
          userId: oldStudent.id,
          score: 0.2,
          passed: false,
          attemptedAt: BEFORE_CUTOFF,
        },
      ])
      .run();

    const result = read(`range=7d&course=${base.course.id}`);
    expect(result.summary).toEqual({
      grossCents: 1001,
      feeCents: 200,
      netCents: 801,
      purchaseCount: 1,
    });
    expect(result.courses[0].grossCents).toBe(1001);
    expect(result.buyers.map((buyer) => buyer.userId)).toEqual([base.user.id]);
    expect(result.audience).toEqual({
      buyerCount: 1,
      studentCount: 1,
      revenuePerStudentCents: 1001,
    });
    expect(result.ratings).toEqual({ average: 5, count: 1 });
    expect(result.questions).toEqual({ inRange: 1, older: 1 });
    expect(result.countries).toMatchObject({
      grossCents: 1001,
      purchaseCount: 1,
    });
    expect(result.quizzes).toMatchObject([
      {
        studentCount: 1,
        passedCount: 1,
        passRatePercent: 100,
        averageBestScorePercent: 80,
      },
    ]);
    // These panels deliberately include the enrollee from before the cutoff.
    expect(result.progress?.enrolledCount).toBe(2);
    expect(result.funnel?.enrolledCount).toBe(2);
    expect(result.refundExposure).toMatchObject({
      grossCents: 1001,
      purchaseCount: 1,
    });
    expect(result.series.granularity).toBe("day");
    expect(result.series.points).toEqual(
      Array.from({ length: 8 }, (_, index) => ({
        bucket: `2026-06-${String(8 + index).padStart(2, "0")}`,
        grossCents: index === 0 ? 1001 : 0,
        netCents: index === 0 ? 801 : 0,
      }))
    );
  });

  it("returns a complete fixed window even without sales", () => {
    const result = read("range=7d");
    expect(result.series.points).toHaveLength(8);
    expect(
      result.series.points.every(
        (point) => point.grossCents === 0 && point.netCents === 0
      )
    ).toBe(true);
    expect(result.series.points[0].bucket).toBe("2026-06-08");
    expect(result.series.points.at(-1)?.bucket).toBe("2026-06-15");
  });

  it("uses monthly buckets for all time, starting at the first sale", () => {
    expect(read("range=all").series).toEqual({
      granularity: "month",
      points: [],
    });
    buy(1000, "2026-04-01T12:00:00.000Z");
    buy(2000);
    expect(read("range=all").series).toEqual({
      granularity: "month",
      points: [
        { bucket: "2026-04", grossCents: 1000, netCents: 800 },
        { bucket: "2026-05", grossCents: 0, netCents: 0 },
        { bucket: "2026-06", grossCents: 2000, netCents: 1600 },
      ],
    });
  });

  it("uses the supplied date for whole-day refund deadlines and the most urgent purchase", () => {
    // Local dates intentionally mirror the existing refund policy, independently of the host's timezone.
    const now = new Date(2026, 5, 15, 12);
    buy(1000, new Date(2026, 5, 1, 23).toISOString()); // closes today
    buy(2000, new Date(2026, 5, 2, 0).toISOString()); // closes tomorrow
    buy(7000, new Date(2026, 4, 31, 23).toISOString()); // already closed
    const result = read("range=all", undefined, now);
    expect(result.refundExposure).toEqual({
      grossCents: 3000,
      netCents: 2400,
      purchaseCount: 2,
      sharePercent: 30,
      closingTodayCount: 1,
      courses: [
        {
          courseId: base.course.id,
          title: base.course.title,
          grossCents: 3000,
          purchaseCount: 2,
          daysLeft: 0,
        },
      ],
    });
    expect(
      read("range=all", undefined, new Date(2026, 5, 17, 0)).refundExposure
        .purchaseCount
    ).toBe(0);
    expect(now).toEqual(new Date(2026, 5, 15, 12));
  });

  it("attributes seat shares without multiplying buyer spend or crediting the whole team purchase", () => {
    const teammate = addUser("teammate");
    const team = db.insert(schema.teams).values({}).returning().get();
    const purchase = buy(3333);
    db.insert(schema.coupons)
      .values([
        {
          teamId: team.id,
          courseId: base.course.id,
          purchaseId: purchase.id,
          code: "seat-1",
          redeemedByUserId: base.user.id,
        },
        {
          teamId: team.id,
          courseId: base.course.id,
          purchaseId: purchase.id,
          code: "seat-2",
          redeemedByUserId: teammate.id,
        },
        {
          teamId: team.id,
          courseId: base.course.id,
          purchaseId: purchase.id,
          code: "seat-3",
        },
      ])
      .run();
    db.insert(schema.enrollments)
      .values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: NOW.toISOString(),
        },
        {
          userId: teammate.id,
          courseId: base.course.id,
          enrolledAt: NOW.toISOString(),
        },
      ])
      .run();
    const result = read();
    expect(result.summary.grossCents).toBe(3333);
    expect(result.audience).toEqual({
      buyerCount: 1,
      studentCount: 2,
      revenuePerStudentCents: 1111,
    });
    expect(result.buyers).toMatchObject([
      {
        userId: base.user.id,
        spendCents: 3333,
        purchaseCount: 1,
        seatsBought: 3,
        seatsUnredeemed: 1,
        enrolled: true,
      },
    ]);
  });

  it("keeps all-time purchase attribution and enrolment facts outside the revenue range", () => {
    buy(2000, BEFORE_CUTOFF);
    buy(1000);
    db.insert(schema.enrollments)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        enrolledAt: CUTOFF,
      })
      .run();
    const result = read("range=7d");
    expect(result.summary.grossCents).toBe(1000);
    expect(result.audience.revenuePerStudentCents).toBe(3000);
    expect(result.buyers[0].enrolled).toBe(true);
    expect(
      read("range=7d", undefined, new Date("2026-06-16T12:00:00.000Z")).audience
        .studentCount
    ).toBe(0);
    expect(
      read("range=7d", undefined, new Date("2026-06-16T12:00:00.000Z"))
        .buyers[0].enrolled
    ).toBe(true);
  });

  it("keeps progress and inferred drop-off all-time, excluding progress from non-enrollees", () => {
    const { lessons } = curriculum();
    const inactive = addUser("inactive");
    const outsider = addUser("outsider");
    db.insert(schema.enrollments)
      .values([
        {
          userId: base.user.id,
          courseId: base.course.id,
          enrolledAt: BEFORE_CUTOFF,
        },
        {
          userId: inactive.id,
          courseId: base.course.id,
          enrolledAt: BEFORE_CUTOFF,
        },
      ])
      .run();
    db.insert(schema.lessonProgress)
      .values([
        {
          userId: base.user.id,
          lessonId: lessons[0].id,
          status: schema.LessonProgressStatus.Completed,
        },
        {
          userId: base.user.id,
          lessonId: lessons[1].id,
          status: schema.LessonProgressStatus.Completed,
        },
        {
          userId: outsider.id,
          lessonId: lessons[1].id,
          status: schema.LessonProgressStatus.Completed,
        },
      ])
      .run();
    const result = read(`range=7d&course=${base.course.id}`);
    expect(result.audience.studentCount).toBe(0);
    expect(result.progress).toEqual({
      enrolledCount: 2,
      totalLessons: 2,
      averageProgressPercent: 50,
      finishedCount: 1,
    });
    expect(result.funnel?.modules[0].lessons).toMatchObject([
      { reachedCount: 1, dropFromPrevious: 1 },
      { reachedCount: 1, dropFromPrevious: 0 },
    ]);
  });
});
