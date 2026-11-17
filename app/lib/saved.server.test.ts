import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import {
  bookmarks,
  lessons,
  modules,
  notes,
  users,
  UserRole,
} from "~/db/schema";
import {
  getBookmark,
  getNote,
  getSavedForUser,
  saveNote,
  toggleBookmark,
} from "./saved.server";

let db: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;
let lesson: typeof lessons.$inferSelect;
let otherLesson: typeof lessons.$inferSelect;
const first = new Date("2026-11-17T10:00:00.000Z");
const later = new Date("2026-11-17T11:00:00.000Z");

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  const module = db
    .insert(modules)
    .values({
      courseId: base.course.id,
      title: "Basics",
      position: 1,
    })
    .returning()
    .get();
  lesson = db
    .insert(lessons)
    .values({
      moduleId: module.id,
      title: "First lesson",
      position: 1,
    })
    .returning()
    .get();
  otherLesson = db
    .insert(lessons)
    .values({
      moduleId: module.id,
      title: "Next lesson",
      position: 2,
    })
    .returning()
    .get();
});

describe("a Student's saved lessons", () => {
  it("toggles a bookmark on and off without leaving duplicates", () => {
    expect(toggleBookmark(db, base.user.id, lesson.id, first)).toBe(true);
    expect(getBookmark(db, base.user.id, lesson.id)).toBeDefined();
    expect(getSavedForUser(db, base.user.id).savedBookmarks).toHaveLength(1);
    expect(toggleBookmark(db, base.user.id, lesson.id, later)).toBe(false);
    expect(getBookmark(db, base.user.id, lesson.id)).toBeUndefined();
    expect(getSavedForUser(db, base.user.id).savedBookmarks).toEqual([]);
  });

  it("replaces and trims a Note, advancing its last edited time", () => {
    saveNote(
      db,
      base.user.id,
      lesson.id,
      "  # Plain *text*\nsecond line  ",
      first
    );
    expect(getNote(db, base.user.id, lesson.id)).toEqual({
      body: "# Plain *text*\nsecond line",
      updatedAt: first.toISOString(),
    });
    saveNote(db, base.user.id, lesson.id, " Revised ", later);
    expect(getNote(db, base.user.id, lesson.id)).toEqual({
      body: "Revised",
      updatedAt: later.toISOString(),
    });
    expect(getSavedForUser(db, base.user.id).savedNotes).toHaveLength(1);
  });

  it("accepts 2,000 characters and refuses longer Notes without overwriting", () => {
    saveNote(db, base.user.id, lesson.id, "a".repeat(2000), first);
    expect(() =>
      saveNote(db, base.user.id, lesson.id, "b".repeat(2001), later)
    ).toThrow("2,000 characters or fewer");
    expect(getNote(db, base.user.id, lesson.id)?.body).toBe("a".repeat(2000));
    expect(getNote(db, base.user.id, lesson.id)?.updatedAt).toBe(
      first.toISOString()
    );
  });

  it("lists only the owner’s rows, newest first, with Lesson and Course references", () => {
    const other = db
      .insert(users)
      .values({
        name: "Other Student",
        email: "other@example.com",
        role: UserRole.Student,
      })
      .returning()
      .get();
    toggleBookmark(db, other.id, lesson.id, later);
    saveNote(db, other.id, lesson.id, "Private to someone else", later);
    expect(getNote(db, base.user.id, lesson.id)).toBeUndefined();
    expect(getBookmark(db, base.user.id, lesson.id)).toBeUndefined();
    toggleBookmark(db, base.user.id, lesson.id, first);
    toggleBookmark(db, base.user.id, otherLesson.id, later);
    saveNote(db, base.user.id, lesson.id, "First", first);
    saveNote(db, base.user.id, otherLesson.id, "Second", later);
    const saved = getSavedForUser(db, base.user.id);
    expect(saved.savedBookmarks.map((row) => row.lessonTitle)).toEqual([
      "Next lesson",
      "First lesson",
    ]);
    expect(saved.savedNotes.map((row) => row.body)).toEqual([
      "Second",
      "First",
    ]);
    for (const row of [...saved.savedBookmarks, ...saved.savedNotes]) {
      expect(row.courseTitle).toBe(base.course.title);
      expect(row.courseSlug).toBe(base.course.slug);
      expect(row.lessonId).toBeDefined();
    }
    saveNote(
      db,
      base.user.id,
      lesson.id,
      "Latest",
      new Date("2026-11-17T12:00:00Z")
    );
    expect(
      getSavedForUser(db, base.user.id).savedNotes.map((row) => row.body)
    ).toEqual(["Latest", "Second"]);
  });

  it("enforces one Bookmark and Note per Student and Lesson in the database", () => {
    toggleBookmark(db, base.user.id, lesson.id, first);
    saveNote(db, base.user.id, lesson.id, "Existing", first);
    expect(() =>
      db
        .insert(bookmarks)
        .values({
          userId: base.user.id,
          lessonId: lesson.id,
        })
        .run()
    ).toThrow();
    expect(() =>
      db
        .insert(notes)
        .values({
          userId: base.user.id,
          lessonId: lesson.id,
          body: "Duplicate",
        })
        .run()
    ).toThrow();
  });
});
