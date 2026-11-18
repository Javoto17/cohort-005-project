export function summarizeScores(scores: readonly number[]) {
  const valid = scores.filter(
    (score) => Number.isFinite(score) && score >= 0 && score <= 100
  );
  return {
    count: valid.length,
    average:
      valid.length === 0
        ? null
        : Math.round(
            valid.reduce((sum, score) => sum + score, 0) / valid.length
          ),
  };
}
