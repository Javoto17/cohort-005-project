import { describe, expect, it } from "vitest";
import { explorePlanSchema } from "../.sandcastle/agent-workflows/explore/plan-schema";

describe("explore verdicts", () => {
  it.each(["easy-call", "needs-a-human", "blocked"])("accepts %s", (tag) => {
    expect(
      explorePlanSchema.safeParse({
        issues: [{ number: 1, tag, comment: "Findings" }],
      }).success
    ).toBe(true);
  });

  it.each([undefined, "approve", ""])("rejects verdict %s", (tag) => {
    expect(
      explorePlanSchema.safeParse({
        issues: [{ number: 1, tag, comment: "Findings" }],
      }).success
    ).toBe(false);
  });
});
