import { describe, expect, it } from "vitest";
import {
  formatUnanchored,
  partitionComments,
} from "../.sandcastle/agent-workflows/review/unanchored-comments";

describe("review comments", () => {
  it("keeps anchored findings inline and preserves the rest in the verdict", () => {
    const comments = [
      { path: "app/a.ts", line: 2, body: "Inline" },
      { path: "app/a.ts", line: 4, body: "Outside" },
    ];
    const result = partitionComments(
      comments,
      new Map([["app/a.ts", new Set([2])]])
    );
    expect(result.anchored).toEqual([comments[0]]);
    expect(formatUnanchored(result.unanchored)).toContain(
      "`app/a.ts:4`: Outside"
    );
  });

  it("accepts an empty review", () => {
    expect(partitionComments([], new Map())).toEqual({
      anchored: [],
      unanchored: [],
    });
  });
});
