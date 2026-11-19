import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function modulesWithoutTests(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const tests = join(root, name, "tests");
      try {
        return !readdirSync(tests, { recursive: true }).some((file) =>
          /\.test\.[cm]?[jt]sx?$/.test(file)
        );
      } catch (error) {
        if (error.code === "ENOENT") return true;
        throw error;
      }
    });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const missing = modulesWithoutTests("app/modules");
  if (missing.length) {
    console.error(`Modules without tests: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("Every module has a test.");
  }
}
