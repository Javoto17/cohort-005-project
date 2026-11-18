import { summarizeScores } from "./lib/impl";

/** Summarize valid percentage scores, ignoring invalid observations. */
export function summarizeResults(scores: readonly number[]) {
  return summarizeScores(scores);
}
