import { beforeEach, describe, expect, it, vi } from "vitest";

const collaborators = vi.hoisted(() => ({
  getNote: vi.fn(),
  saveNote: vi.fn(),
  isBookmarked: vi.fn(),
  toggleBookmark: vi.fn(),
  createComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("~/db", () => ({ db: {} }));
vi.mock("~/lib/bookmarks.server", () => ({
  isBookmarked: collaborators.isBookmarked,
  toggleBookmark: collaborators.toggleBookmark,
}));
vi.mock("~/lib/comments.server", () => ({
  createComment: collaborators.createComment,
  editComment: collaborators.editComment,
  deleteComment: collaborators.deleteComment,
}));
vi.mock("~/lib/notes.server", () => ({
  getNote: collaborators.getNote,
  saveNote: collaborators.saveNote,
}));

import {
  createLessonComment,
  deleteLessonComment,
  editLessonComment,
  getLessonNote,
  isLessonBookmarked,
  saveLessonNote,
  toggleLessonBookmark,
} from "../data.server";

describe("lesson data adapters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the student's note through the notes service", () => {
    const note = { body: "A key idea", updatedAt: "2026-11-19" };
    collaborators.getNote.mockReturnValue(note);

    expect(getLessonNote(7, 12)).toBe(note);
    expect(collaborators.getNote).toHaveBeenCalledWith({}, 7, 12);
  });

  it("saves the student's note through the notes service", () => {
    const note = {
      userId: 7,
      lessonId: 12,
      body: "A key idea",
      now: new Date("2026-11-19T12:00:00.000Z"),
    };
    const saved = { ok: true };
    collaborators.saveNote.mockReturnValue(saved);

    expect(saveLessonNote(note)).toBe(saved);
    expect(collaborators.saveNote).toHaveBeenCalledWith(
      {},
      7,
      12,
      note.body,
      note.now
    );
  });

  it("checks whether the student bookmarked the lesson", () => {
    collaborators.isBookmarked.mockReturnValue(true);

    expect(isLessonBookmarked(7, 12)).toBe(true);
    expect(collaborators.isBookmarked).toHaveBeenCalledWith({}, 7, 12);
  });

  it("toggles the student's lesson bookmark", () => {
    const now = new Date("2026-11-19T12:00:00.000Z");
    collaborators.toggleBookmark.mockReturnValue(false);

    expect(toggleLessonBookmark(7, 12, now)).toBe(false);
    expect(collaborators.toggleBookmark).toHaveBeenCalledWith({}, 7, 12, now);
  });

  it("creates a lesson comment through the comments service", () => {
    const comment = {
      authorId: 7,
      lessonId: 12,
      parentId: 3,
      body: "A question",
      now: new Date("2026-11-19T12:00:00.000Z"),
      notifications: {} as never,
    };
    const created = { ok: true };
    collaborators.createComment.mockReturnValue(created);

    expect(createLessonComment(comment)).toBe(created);
    expect(collaborators.createComment).toHaveBeenCalledWith(
      {},
      comment.authorId,
      comment.lessonId,
      comment.parentId,
      comment.body,
      comment.now,
      comment.notifications
    );
  });

  it("edits a lesson comment through the comments service", () => {
    const comment = {
      commentId: 3,
      userId: 7,
      body: "An answer",
      now: new Date("2026-11-19T12:00:00.000Z"),
    };
    const edited = { ok: true };
    collaborators.editComment.mockReturnValue(edited);

    expect(editLessonComment(comment)).toBe(edited);
    expect(collaborators.editComment).toHaveBeenCalledWith(
      {},
      comment.commentId,
      comment.userId,
      comment.body,
      comment.now
    );
  });

  it("deletes a lesson comment through the comments service", () => {
    const comment = {
      commentId: 3,
      userId: 7,
      canModerate: true,
      now: new Date("2026-11-19T12:00:00.000Z"),
      notifications: {} as never,
    };
    const deleted = { ok: true };
    collaborators.deleteComment.mockReturnValue(deleted);

    expect(deleteLessonComment(comment)).toBe(deleted);
    expect(collaborators.deleteComment).toHaveBeenCalledWith(
      {},
      comment.commentId,
      comment.userId,
      comment.canModerate,
      comment.now,
      comment.notifications
    );
  });
});
