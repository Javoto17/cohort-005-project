type Comment = { path: string; line: number; body: string };

export function partitionComments<T extends Comment>(
  comments: T[],
  hunks: Map<string, Set<number>>
) {
  const anchored: T[] = [];
  const unanchored: T[] = [];
  for (const comment of comments) {
    (hunks.get(comment.path)?.has(comment.line) ? anchored : unanchored).push(
      comment
    );
  }
  return { anchored, unanchored };
}

export function formatUnanchored(comments: Comment[]): string {
  return (
    "\n\n## Findings outside the diff\n\n" +
    comments
      .map(({ path, line, body }) => `- \`${path}:${line}\`: ${body}`)
      .join("\n") +
    "\n"
  );
}
