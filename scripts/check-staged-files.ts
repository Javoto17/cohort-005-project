import { execFileSync } from "node:child_process";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import * as prettier from "prettier";

const MAX_TOKENS = 5_000;

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  });
}

export async function checkStagedFiles(
  cwd: string,
  files: string[],
  report: (message: string) => void = console.error
) {
  let isValid = true;

  for (const file of files) {
    const path = relative(cwd, resolve(cwd, file)).split(sep).join("/");
    // Inspect the index, not the working tree: partial staging must be safe.
    const content = git(cwd, "show", `:${path}`);
    // Dependency lockfiles are machine-generated; binary assets aren't text.
    if (path === "package-lock.json" || content.includes(0)) continue;

    const tokens = Math.ceil(content.byteLength / 4);
    if (tokens > MAX_TOKENS) {
      isValid = false;
      report(
        `${path}: ~${tokens.toLocaleString("en-US")} tokens ` +
          `(${content.byteLength} bytes); maximum is 5,000 tokens (20,000 bytes).\n` +
          "Split this file by responsibility before committing:\n" +
          "- Extract cohesive domain logic into focused modules with a small public API.\n" +
          "- Move independent UI sections into components; keep route wiring in the route.\n" +
          "- Split tests by behavior and extract shared fixtures.\n" +
          "- Split documentation by topic and link the resulting documents.\n" +
          "Keep dependencies acyclic, update imports, and run the checks. " +
          "Do not minify, remove tests, or bypass the hook to fit the limit.\n" +
          "Stage the resulting files with git add and retry the commit."
      );
    }

    const filepath = resolve(cwd, path);
    const info = await prettier.getFileInfo(filepath, {
      ignorePath: [resolve(cwd, ".gitignore"), resolve(cwd, ".prettierignore")],
    });
    if (info.ignored || !info.inferredParser) continue;

    const config = await prettier.resolveConfig(filepath);
    if (
      !(await prettier.check(content.toString("utf8"), {
        ...config,
        filepath,
      }))
    ) {
      isValid = false;
      report(
        `${path}: staged content does not match Prettier. ` +
          `Run npx prettier --write ${JSON.stringify(path)}, review the diff, ` +
          "and stage the formatting changes with git add."
      );
    }
  }

  return isValid;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (!(await checkStagedFiles(process.cwd(), process.argv.slice(2)))) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Staged-file checks failed:", error);
    process.exitCode = 1;
  }
}
