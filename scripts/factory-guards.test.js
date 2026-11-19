import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import input from "../lint-rules/input.js";
import { modulesWithoutTests } from "./check-modules.mjs";

describe("module test guard", () => {
  it("requires a test under each module's tests directory", () => {
    const root = mkdtempSync(join(tmpdir(), "modules-"));
    try {
      mkdirSync(join(root, "covered", "tests"), { recursive: true });
      mkdirSync(join(root, "missing"));
      writeFileSync(join(root, "covered", "tests", "index.test.ts"), "");
      expect(modulesWithoutTests(root)).toEqual(["missing"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("request Number guard", () => {
  it("reports direct request values but permits ordinary numeric conversion", () => {
    const reports = [];
    const visitor = input.rules["no-number-coercion"].create({
      report: (report) => reports.push(report),
    });
    const call = (object) => ({
      type: "CallExpression",
      callee: { type: "Identifier", name: "Number" },
      arguments: [
        {
          type: "MemberExpression",
          object: { type: "Identifier", name: object },
          property: { type: "Identifier", name: "id" },
        },
      ],
    });
    visitor.CallExpression(call("params"));
    visitor.CallExpression(call("value"));
    expect(reports).toHaveLength(1);
  });
});

describe("server component boundary", () => {
  it("rejects server imports of components and allows ordinary server imports", () => {
    const root = mkdtempSync(join(tmpdir(), "boundaries-"));
    try {
      mkdirSync(join(root, "app", "components"), { recursive: true });
      mkdirSync(join(root, "app", "lib"), { recursive: true });
      writeFileSync(join(root, "tsconfig.json"), "{}");
      writeFileSync(
        join(root, "app", "components", "view.ts"),
        "export const view = 1;"
      );
      writeFileSync(
        join(root, "app", "lib", "helper.ts"),
        "export const helper = 1;"
      );
      const server = join(root, "app", "lib", "test.server.ts");
      const cruise = () =>
        spawnSync(
          resolve("node_modules/.bin/depcruise"),
          ["--config", resolve(".dependency-cruiser.cjs"), "app"],
          { cwd: root, encoding: "utf8" }
        );
      writeFileSync(
        server,
        'import { helper } from "./helper"; console.log(helper);'
      );
      expect(cruise().status).toBe(0);
      writeFileSync(
        server,
        'import { view } from "../components/view"; console.log(view);'
      );
      const result = cruise();
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain(
        "server-code-no-components"
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
