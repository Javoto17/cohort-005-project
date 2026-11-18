import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import lintStaged from "lint-staged";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkStagedFiles } from "./check-staged-files";

describe("staged-file guardrails", () => {
  let cwd: string;
  let messages: string[];

  function git(...args: string[]) {
    return execFileSync("git", args, { cwd });
  }

  function stage(path: string, content: string | Buffer) {
    writeFileSync(join(cwd, path), content);
    git("add", "--", path);
  }

  function commit() {
    git(
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "--quiet",
      "-m",
      "test fixture"
    );
  }

  async function check() {
    const files = git(
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMR",
      "-z"
    )
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
    return checkStagedFiles(cwd, files, (message: string) =>
      messages.push(message)
    );
  }

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "staged-checks-"));
    messages = [];
    git("init", "--quiet");
    writeFileSync(join(cwd, ".prettierrc"), "{}");
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it("accepts an empty index and exactly 5,000 tokens", async () => {
    expect(await check()).toBe(true);
    stage("limit.txt", "a".repeat(20_000));
    expect(await check()).toBe(true);
  });

  it("rejects one byte over the limit with actionable guidance", async () => {
    stage("large file.txt", "a".repeat(20_001));
    expect(await check()).toBe(false);
    expect(messages.join("\n")).toContain("large file.txt: ~5,001 tokens");
    expect(messages.join("\n")).toContain("Split this file by responsibility");
    expect(messages.join("\n")).toContain("git add");
  });

  it("counts UTF-8 bytes, not JavaScript characters", async () => {
    stage("unicode.txt", "é".repeat(10_001));
    expect(await check()).toBe(false);
  });

  it("accepts absolute file paths supplied by lint-staged", async () => {
    stage("absolute path.txt", "a".repeat(20_001));
    expect(
      await checkStagedFiles(cwd, [join(cwd, "absolute path.txt")], (message) =>
        messages.push(message)
      )
    ).toBe(false);
    expect(messages.join("\n")).toContain("absolute path.txt: ~5,001 tokens");
  });

  it("checks only the files supplied by lint-staged", async () => {
    stage("excluded.txt", "a".repeat(20_001));
    stage("included.txt", "small");
    expect(await checkStagedFiles(cwd, ["included.txt"])).toBe(true);
  });

  it("runs through lint-staged and preserves partially staged changes", async () => {
    stage("partial file.js", "const value = 0;\n");
    commit();
    stage("partial file.js", "const value = 1;\n");
    writeFileSync(join(cwd, "partial file.js"), "const value=2");

    const command = [
      process.execPath,
      fileURLToPath(
        new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)
      ),
      fileURLToPath(new URL("./check-staged-files.ts", import.meta.url)),
    ]
      .map((part) => JSON.stringify(part))
      .join(" ");
    const output: string[] = [];
    const log = (...parts: unknown[]) => output.push(parts.join(" "));
    const options = {
      cwd,
      config: { "*": command },
      quiet: true,
      relative: true,
    };
    const logger = { log, warn: log, error: log, debug: log };

    const success = await lintStaged(options, logger);
    expect(success, output.join("\n")).toBe(true);
    expect(git("show", ":partial file.js").toString()).toBe(
      "const value = 1;\n"
    );
    expect(readFileSync(join(cwd, "partial file.js"), "utf8")).toBe(
      "const value=2"
    );

    stage("too large.txt", "a".repeat(20_001));
    expect(await lintStaged(options, logger)).toBe(false);
    expect(output.join("\n")).toContain("maximum is 5,000 tokens");
  });

  it("rejects unformatted staged content even if the working tree is fixed", async () => {
    stage("file with spaces.js", "const value=1");
    writeFileSync(join(cwd, "file with spaces.js"), "const value = 1;\n");
    expect(await check()).toBe(false);
    expect(messages.join("\n")).toContain("does not match Prettier");
  });

  it("accepts formatted staged content even if unstaged edits are invalid", async () => {
    stage("valid.js", "const value = 1;\n");
    writeFileSync(join(cwd, "valid.js"), "a".repeat(20_001));
    expect(await check()).toBe(true);
  });

  it("skips binary assets and the generated dependency lockfile", async () => {
    stage("asset.bin", Buffer.alloc(30_000));
    stage("package-lock.json", "a".repeat(30_000));
    expect(await check()).toBe(true);
  });

  it("honors Prettier ignores without exempting text from the token limit", async () => {
    writeFileSync(join(cwd, ".prettierignore"), "ignored.js\n");
    stage("ignored.js", "const value=1");
    expect(await check()).toBe(true);
    stage("ignored.js", "a".repeat(20_001));
    expect(await check()).toBe(false);
  });

  it("ignores staged deletions", async () => {
    stage("deleted.txt", "a".repeat(20_001));
    commit();
    git("rm", "--", "deleted.txt");
    expect(await check()).toBe(true);
  });

  it("checks staged modifications and renamed files", async () => {
    stage("original.txt", "a".repeat(20_001));
    stage("modified.txt", "small");
    commit();
    git("mv", "--", "original.txt", "renamed file.txt");
    stage("modified.txt", "a".repeat(20_001));
    expect(await check()).toBe(false);
    expect(messages.join("\n")).toContain("renamed file.txt: ~5,001 tokens");
    expect(messages.join("\n")).toContain("modified.txt: ~5,001 tokens");
  });
});
