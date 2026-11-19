import { describe, expect, it } from "vitest";
import { getNoteSaveStatus } from "../index";

describe("getNoteSaveStatus", () => {
  it("shows progress while a note is being saved", () => {
    expect(getNoteSaveStatus(true)).toEqual({
      kind: "saving",
      message: "Saving your note…",
    });
  });

  it("shows a correction when the note could not be saved", () => {
    expect(
      getNoteSaveStatus(false, "Write something before saving your note.")
    ).toEqual({
      kind: "error",
      message: "Write something before saving your note.",
    });
  });

  it("reassures the Student that their note is private when idle", () => {
    expect(getNoteSaveStatus(false)).toEqual({
      kind: "private",
      message: "Private to you",
    });
  });
});
