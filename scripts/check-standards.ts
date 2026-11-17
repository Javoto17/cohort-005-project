import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { checkSource, findNewViolations, violationKey } from "./standards";
import type { StandardsBaseline } from "./standards.types";

const root = process.cwd();
const baselinePath = path.join(root, "scripts/standards-baseline.json");
for (const argument of process.argv.slice(2)) {
  if (!["--write-baseline", "--prune-baseline"].includes(argument)) {
    throw new Error(`Unknown argument: ${argument}`);
  }
}

function sourceFiles(directory: string): string[] {
  return readdirSync(path.join(root, directory), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (file === "app/test" || file === "app/components/ui") return [];
        return sourceFiles(file);
      }
      return /\.tsx?$/.test(file) && !/\.(?:test|spec|d)\.tsx?$/.test(file)
        ? [file]
        : [];
    });
}

const violations = sourceFiles("app").flatMap((file) =>
  checkSource(file, readFileSync(path.join(root, file), "utf8"))
);

if (process.argv.includes("--write-baseline")) {
  if (process.argv.includes("--prune-baseline"))
    throw new Error("Choose one baseline operation.");
  const baseline: StandardsBaseline = {};
  for (const violation of violations) {
    const key = violationKey(violation);
    baseline[key] = (baseline[key] ?? 0) + 1;
  }
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(
    `Recorded ${violations.length} existing exceptions. Review the baseline diff.`
  );
} else {
  const baseline: StandardsBaseline = JSON.parse(
    readFileSync(baselinePath, "utf8")
  );
  if (process.argv.includes("--prune-baseline")) {
    const current: StandardsBaseline = {};
    for (const violation of violations) {
      const key = violationKey(violation);
      current[key] = (current[key] ?? 0) + 1;
    }
    for (const key of Object.keys(baseline)) {
      baseline[key] = Math.min(baseline[key], current[key] ?? 0);
      if (baseline[key] === 0) delete baseline[key];
    }
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  }
  const added = findNewViolations(violations, baseline);
  for (const violation of added) {
    console.error(
      `${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`
    );
  }
  if (added.length > 0) {
    console.error(`${added.length} new coding standards violation(s).`);
    process.exitCode = 1;
  } else {
    console.log("Coding standards: no new violations.");
  }
}
