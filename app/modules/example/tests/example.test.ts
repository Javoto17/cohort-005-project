import { expect, it } from "vitest";
import { summarizeResults } from "../index";

it("summarizes valid scores through the entry point", () => {
  expect(summarizeResults([60, 81, NaN, -1, 101])).toEqual({
    count: 2,
    average: 71,
  });
});

it("has no average without valid scores", () => {
  expect(summarizeResults([])).toEqual({ count: 0, average: null });
});
