import { beforeEach, describe, expect, it } from "vitest";
import { createRouteTestDb, routeArgs, routeRequest } from "~/test/routes";
import { seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { loader as savedLoader } from "./saved";
import {
  loader as lessonLoader,
  action as lessonAction,
} from "./courses.$slug.lessons.$lessonId";
import { loader as rosterLoader } from "./instructor.$courseId.students";
import { toggleBookmark, isBookmarked } from "~/lib/bookmarks.server";
import { saveNote, getNote } from "~/lib/notes.server";
import { approveRefundRequest, raiseRefundRequest } from "~/lib/refunds.server";
import { fakeNotifications } from "~/lib/notifications.fake.server";
import { eq } from "drizzle-orm";

let db: ReturnType<typeof createRouteTestDb>;
let base: ReturnType<typeof seedBaseData>;
let lesson: typeof schema.lessons.$inferSelect;
const now = new Date("2026-11-17T12:00:00Z");

beforeEach(() => {
  db = createRouteTestDb();
  base = seedBaseData(db);
  const module = db
    .insert(schema.modules)
    .values({
      courseId: base.course.id,
      title: "Basics",
      position: 1,
    })
    .returning()
    .get();
  lesson = db
    .insert(schema.lessons)
    .values({
      moduleId: module.id,
      title: "First Lesson",
      position: 1,
    })
    .returning()
    .get();
});

function enroll() {
  db.insert(schema.enrollments)
    .values({
      userId: base.user.id,
      courseId: base.course.id,
    })
    .run();
}

function savePrivateData() {
  toggleBookmark(db, base.user.id, lesson.id, now);
  saveNote(db, base.user.id, lesson.id, "Private Student thoughts", now);
}

async function loadLesson(studentId: number | null) {
  return lessonLoader(
    routeArgs(
      await routeRequest(
        `/courses/${base.course.slug}/lessons/${lesson.id}`,
        studentId
      ),
      { slug: base.course.slug, lessonId: String(lesson.id) }
    )
  );
}

async function loadSaved(studentId: number | null) {
  return savedLoader(routeArgs(await routeRequest("/saved", studentId), {}));
}

async function postLesson(
  intent: string,
  studentId: number | null,
  lessonId = lesson.id
) {
  return lessonAction(
    routeArgs(
      await routeRequest(
        `/courses/${base.course.slug}/lessons/${lessonId}`,
        studentId,
        {
          intent,
          body: "A new private Note",
        }
      ),
      { slug: base.course.slug, lessonId: String(lessonId) }
    )
  );
}

describe("Saved content access", () => {
  it("hides saved rows without content access without deleting them", async () => {
    savePrivateData();
    const saved = await savedLoader(
      routeArgs(await routeRequest("/saved", base.user.id), {})
    );
    expect(saved.savedNotes).toEqual([]);
    expect(saved.savedBookmarks).toEqual([]);
    expect(getNote(db, base.user.id, lesson.id)?.body).toBe(
      "Private Student thoughts"
    );
    expect(isBookmarked(db, base.user.id, lesson.id)).toBe(true);
  });

  it("returns the owner's Note and Bookmark when they have access", async () => {
    enroll();
    savePrivateData();
    const saved = await loadSaved(base.user.id);
    expect(saved.savedNotes.map((note) => note.body)).toEqual([
      "Private Student thoughts",
    ]);
    expect(saved.savedBookmarks.map((bookmark) => bookmark.lesson.id)).toEqual([
      lesson.id,
    ]);
    const loaded = await loadLesson(base.user.id);
    expect(loaded.note?.body).toBe("Private Student thoughts");
    expect(loaded.bookmarked).toBe(true);
  });

  it("filters each Course independently on Saved", async () => {
    enroll();
    savePrivateData();
    const course = db
      .insert(schema.courses)
      .values({
        title: "Locked Course",
        slug: "locked-course",
        description: "",
        salesCopy: "",
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();
    const module = db
      .insert(schema.modules)
      .values({
        courseId: course.id,
        title: "Locked Module",
        position: 1,
      })
      .returning()
      .get();
    const lockedLesson = db
      .insert(schema.lessons)
      .values({
        moduleId: module.id,
        title: "Locked Lesson",
        position: 1,
      })
      .returning()
      .get();
    saveNote(
      db,
      base.user.id,
      lockedLesson.id,
      "Inaccessible Course Note",
      now
    );
    toggleBookmark(db, base.user.id, lockedLesson.id, now);
    const saved = await loadSaved(base.user.id);
    expect(saved.savedNotes.map((note) => note.body)).toEqual([
      "Private Student thoughts",
    ]);
    expect(saved.savedBookmarks.map((bookmark) => bookmark.lesson.id)).toEqual([
      lesson.id,
    ]);
  });

  it("requires a session on Saved and hides private Lesson data when signed out", async () => {
    enroll();
    savePrivateData();
    await expect(loadSaved(null)).rejects.toMatchObject({
      init: { status: 401 },
    });
    const loaded = await loadLesson(null);
    expect(loaded.note).toBeNull();
    expect(loaded.bookmarked).toBe(false);
  });

  it.each([
    schema.UserRole.Student,
    schema.UserRole.Instructor,
    schema.UserRole.Admin,
  ])("never returns another Student's Note to %s", async (role) => {
    enroll();
    savePrivateData();
    const viewer = db
      .insert(schema.users)
      .values({
        name: "Other person",
        email: "other@example.com",
        role,
      })
      .returning()
      .get();
    db.insert(schema.enrollments)
      .values({
        userId: viewer.id,
        courseId: base.course.id,
      })
      .run();
    const loaded = await loadLesson(viewer.id);
    expect(loaded.canViewContent).toBe(true);
    expect(loaded.note).toBeNull();
    expect(loaded.bookmarked).toBe(false);
    const saved = await loadSaved(viewer.id);
    expect(saved.savedNotes).toEqual([]);
    expect(saved.savedBookmarks).toEqual([]);
  });

  it.each([schema.UserRole.Instructor, schema.UserRole.Admin])(
    "does not serialize Student Notes in the %s roster",
    async (role) => {
      enroll();
      savePrivateData();
      const viewer =
        role === schema.UserRole.Instructor
          ? base.instructor
          : db
              .insert(schema.users)
              .values({
                name: "Platform Admin",
                email: "admin@example.com",
                role,
              })
              .returning()
              .get();
      const roster = await rosterLoader(
        routeArgs(
          await routeRequest(
            `/instructor/${base.course.id}/students`,
            viewer.id
          ),
          { courseId: String(base.course.id) }
        )
      );
      expect(roster.students).toHaveLength(1);
      expect(roster.students[0].userId).toBe(base.user.id);
      expect(JSON.stringify(roster)).not.toContain("Private Student thoughts");
      expect(roster.students[0]).not.toHaveProperty("notes");
    }
  );

  describe.each(["toggle-bookmark", "save-note"])("%s POST", (intent) => {
    it("rejects a signed-out request without a prior loader", async () => {
      await expect(postLesson(intent, null)).rejects.toMatchObject({
        init: { status: 401 },
      });
      expect(getNote(db, base.user.id, lesson.id)).toBeUndefined();
      expect(isBookmarked(db, base.user.id, lesson.id)).toBe(false);
    });

    it("rejects an unenrolled Student without a prior loader", async () => {
      await expect(postLesson(intent, base.user.id)).rejects.toMatchObject({
        init: { status: 403 },
      });
      expect(getNote(db, base.user.id, lesson.id)).toBeUndefined();
      expect(isBookmarked(db, base.user.id, lesson.id)).toBe(false);
    });

    it("rejects a Lesson from another Course even when enrolled in both", async () => {
      enroll();
      const otherCourse = db
        .insert(schema.courses)
        .values({
          title: "Other Course",
          slug: "other-course",
          description: "",
          salesCopy: "",
          instructorId: base.instructor.id,
          categoryId: base.category.id,
          status: schema.CourseStatus.Published,
        })
        .returning()
        .get();
      db.insert(schema.enrollments)
        .values({
          userId: base.user.id,
          courseId: otherCourse.id,
        })
        .run();
      const module = db
        .insert(schema.modules)
        .values({
          courseId: otherCourse.id,
          title: "Other Module",
          position: 1,
        })
        .returning()
        .get();
      const otherLesson = db
        .insert(schema.lessons)
        .values({
          moduleId: module.id,
          title: "Other Lesson",
          position: 1,
        })
        .returning()
        .get();
      await expect(
        postLesson(intent, base.user.id, otherLesson.id)
      ).rejects.toMatchObject({ init: { status: 404 } });
      expect(getNote(db, base.user.id, otherLesson.id)).toBeUndefined();
      expect(isBookmarked(db, base.user.id, otherLesson.id)).toBe(false);
    });

    it("accepts a direct request from a Student with content access", async () => {
      enroll();
      await expect(postLesson(intent, base.user.id)).resolves.toMatchObject({
        ok: true,
      });
      const loaded = await loadLesson(base.user.id);
      if (intent === "save-note")
        expect(loaded.note?.body).toBe("A new private Note");
      else expect(loaded.bookmarked).toBe(true);
    });
  });

  it("hides saved data and refuses both intents when PPP blocks content access", async () => {
    enroll();
    savePrivateData();
    db.update(schema.courses)
      .set({ price: 7900, pppEnabled: true })
      .where(eq(schema.courses.id, base.course.id))
      .run();
    db.insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid: 3950,
        country: "IN",
      })
      .run();
    const loaded = await loadLesson(base.user.id);
    expect(loaded.pppBlocked).toBe(true);
    expect(loaded.note).toBeNull();
    expect(loaded.bookmarked).toBe(false);
    expect(await loadSaved(base.user.id)).toMatchObject({
      savedNotes: [],
      savedBookmarks: [],
    });
    for (const intent of ["save-note", "toggle-bookmark"]) {
      await expect(postLesson(intent, base.user.id)).rejects.toMatchObject({
        init: { status: 403 },
      });
    }
    expect(getNote(db, base.user.id, lesson.id)?.body).toBe(
      "Private Student thoughts"
    );
    expect(isBookmarked(db, base.user.id, lesson.id)).toBe(true);
    const allowed = await savedLoader(
      routeArgs(await routeRequest("/saved", base.user.id, undefined, "IN"), {})
    );
    expect(allowed.savedNotes).toHaveLength(1);
    expect(allowed.savedBookmarks).toHaveLength(1);
  });

  it("keeps rows after an approved Refund but hides them until access returns", async () => {
    enroll();
    savePrivateData();
    const purchase = db
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid: 7900,
        createdAt: now.toISOString(),
      })
      .returning()
      .get();
    const admin = db
      .insert(schema.users)
      .values({
        name: "Platform Admin",
        email: "admin@example.com",
        role: schema.UserRole.Admin,
      })
      .returning()
      .get();
    const notifications = fakeNotifications();
    const raised = await raiseRefundRequest(
      db,
      purchase.id,
      base.user.id,
      "Not for me",
      now,
      notifications
    );
    if (!raised.ok) throw new Error(raised.error);
    const approved = await approveRefundRequest(
      db,
      raised.refundRequestId,
      admin.id,
      null,
      now,
      notifications
    );
    expect(approved.ok).toBe(true);
    expect(await loadSaved(base.user.id)).toMatchObject({
      savedNotes: [],
      savedBookmarks: [],
    });
    const loaded = await loadLesson(base.user.id);
    expect(loaded.canViewContent).toBe(false);
    expect(loaded.note).toBeNull();
    expect(loaded.bookmarked).toBe(false);
    for (const intent of ["save-note", "toggle-bookmark"]) {
      await expect(postLesson(intent, base.user.id)).rejects.toMatchObject({
        init: { status: 403 },
      });
    }
    expect(getNote(db, base.user.id, lesson.id)?.body).toBe(
      "Private Student thoughts"
    );
    expect(isBookmarked(db, base.user.id, lesson.id)).toBe(true);
    enroll();
    const restored = await loadSaved(base.user.id);
    expect(restored.savedNotes.map((note) => note.body)).toEqual([
      "Private Student thoughts",
    ]);
    expect(restored.savedBookmarks).toHaveLength(1);
  });
});
