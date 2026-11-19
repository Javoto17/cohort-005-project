export type NoteSaveStatus =
  | { kind: "saving"; message: string }
  | { kind: "error"; message: string }
  | { kind: "private"; message: string };

export function getNoteSaveStatus(
  isSaving: boolean,
  error?: string
): NoteSaveStatus {
  if (isSaving) return { kind: "saving", message: "Saving your note…" };
  if (error) return { kind: "error", message: error };
  return { kind: "private", message: "Private to you" };
}
