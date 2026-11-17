import { describe, expect, it } from "vitest";
import { checkSource, findNewViolations } from "./standards";

describe("coding standards checks", () => {
  it("rejects literal intents in both actions and hidden form inputs", () => {
    const violations = checkSource(
      "app/features/saved/editor.tsx",
      `
      if (intent === "save-note") save();
      export default function Editor() {
        return <input name="intent" value="save-note" />;
      }
    `
    );
    expect(violations.map((violation) => violation.rule)).toEqual([
      "intent-literal",
      "intent-literal",
    ]);
  });

  it("accepts shared intents and already typed router states", () => {
    expect(
      checkSource(
        "app/features/saved/editor.tsx",
        `
      if (intent === SavedIntent.SaveNote) save();
      export default function Editor() {
        const fetcher = useFetcher<SaveNoteResult>();
        const isSaving = fetcher.state !== "idle";
        return <input name="intent" value={SavedIntent.SaveNote} disabled={isSaving} />;
      }
    `
      )
    ).toEqual([]);
  });

  it("rejects inline object types in props and fetcher responses", () => {
    expect(
      checkSource(
        "app/features/saved/editor.tsx",
        `
      export function Editor(props: { body: string }) {
        const fetcher = useFetcher<{ ok: boolean }>();
        return <textarea />;
      }
    `
      ).map((violation) => violation.rule)
    ).toEqual(["inline-object-type", "inline-object-type"]);
    expect(
      checkSource(
        "app/features/saved/saved.types.ts",
        `
      export type EditorProps = { body: string };
      export type SaveResult = { ok: boolean };
    `
      )
    ).toEqual([]);
  });

  it("rejects multiple components, including arrow and memo components", () => {
    const violations = checkSource(
      "app/features/saved/editor.tsx",
      `
      export default function Editor() { return <textarea />; }
      const Button = () => <button />;
      const Label = memo(() => <label />);
    `
    );
    expect(violations.map((violation) => violation.rule)).toEqual([
      "one-component-per-file",
      "one-component-per-file",
    ]);
  });

  it("allows React Router boundary exports but still catches feature components in a route", () => {
    expect(
      checkSource(
        "app/routes/saved.tsx",
        `
      export default function Saved() { return <main />; }
      export function ErrorBoundary() { return <p />; }
      export function HydrateFallback() { return <p />; }
      function SavedCard() { return <article />; }
    `
      ).map((violation) => violation.rule)
    ).toEqual(["one-component-per-file"]);
    expect(
      checkSource(
        "app/features/saved/card.tsx",
        `
      export function Card() { return <article />; }
      function ErrorBoundary() { return <p />; }
    `
      ).map((violation) => violation.rule)
    ).toEqual(["one-component-per-file"]);
  });

  it("checks intent switches and schema literals as well as comparisons", () => {
    expect(
      checkSource(
        "app/features/saved/saved.ts",
        `
      switch (intent) { case "save-note": break; }
      const schema = z.object({ intent: z.literal("save-note") });
      if (formData.get("intent") === "save-note") save();
    `
      ).filter((violation) => violation.rule === "intent-literal")
    ).toHaveLength(3);
  });

  it("keeps legacy exceptions exact and rejects duplicated or changed violations", () => {
    const text = `if (intent === "legacy") save();`;
    const violations = checkSource("app/routes/old.tsx", text);
    const baseline = Object.fromEntries(
      violations.map((violation) => [
        `${violation.file}|${violation.rule}|${violation.fingerprint}`,
        1,
      ])
    );
    expect(findNewViolations(violations, baseline)).toEqual([]);
    expect(
      findNewViolations(
        checkSource("app/routes/old.tsx", `\n${text}`),
        baseline
      )
    ).toEqual([]);
    expect(
      findNewViolations(
        checkSource("app/routes/old.tsx", text.repeat(2)),
        baseline
      )
    ).toHaveLength(1);
    expect(
      findNewViolations(
        checkSource("app/routes/old.tsx", text.replace("legacy", "new")),
        baseline
      )
    ).toHaveLength(1);
    expect(
      findNewViolations(checkSource("app/routes/new.tsx", text), baseline)
    ).toHaveLength(1);
  });

  it("keeps JSX values distinct from components and enforces feature locations", () => {
    expect(
      checkSource(
        "app/features/saved/card.tsx",
        `
      const Empty = <p />;
      const Columns = [{ render: () => <td /> }];
      export function Card() { return <article />; }
    `
      )
    ).toEqual([]);
    expect(
      checkSource(
        "app/lib/card.tsx",
        `
      export function Card() { return <article />; }
    `
      ).map((violation) => violation.rule)
    ).toEqual(["component-location"]);
  });

  it("keeps a route's default arrow component valid", () => {
    expect(
      checkSource(
        "app/routes/saved.tsx",
        `
      const Saved = () => <main />;
      export default Saved;
    `
      )
    ).toEqual([]);
    expect(
      checkSource(
        "app/routes/saved.tsx",
        `
        export default class Saved { render() { return <main />; } }
        export const ErrorBoundary = () => <p />;
      `
      )
    ).toEqual([]);
  });

  it("rejects nested components rather than hiding them inside a parent", () => {
    expect(
      checkSource(
        "app/features/saved/editor.tsx",
        `
        export function Editor() {
          function Inner() { return <span />; }
          return <Inner />;
        }
      `
      ).map((violation) => violation.rule)
    ).toEqual(["one-component-per-file"]);
  });
});
