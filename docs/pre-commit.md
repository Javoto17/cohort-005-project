# Pre-commit checks

`npm install` installs Husky's Git hook through the `prepare` script.
If install scripts were disabled, run `npm run prepare` manually.

Before each commit, `.husky/pre-commit` only runs `npm run check:staged`:
**lint-staged** selects added, copied, modified, and renamed files and passes
their paths to `scripts/check-staged-files.ts` for Prettier and file-size checks.

The pre-commit budget is **three seconds** for normal commits. Type checking,
module boundary checks, and tests are deliberately excluded from the hook;
run `npm run check` separately before pushing or in CI. Runtime still depends
on machine speed and the number and size of staged files; this is not a timeout
that silently skips unfinished checks.

The size limit is **5,000 estimated tokens per text file**, calculated as
`Math.ceil(bytes / 4)` (at most 20,000 bytes). Binary files and the generated
`package-lock.json` are excluded. Unsupported Prettier file types still get the
size check. Prettier ignores do not exempt text files from the size limit.
Deleted files and unchanged legacy files are not checked.

Errors include instructions for splitting large files into cohesive modules,
components, test suites, or topic-specific documents. Update consumers, run the
checks, and stage the resulting changes before retrying.

Use `npx prettier --write <file>` to fix formatting, then review and stage the
result. The custom checker reads the Git index and never rewrites files.
lint-staged manages its backup and restores unstaged changes, so partially
staged changes are preserved.

The `lint-staged` configuration lives in `package.json`. Its `*` pattern
matches files at any directory depth, including dotfiles. File selection and
argument batching are handled by lint-staged, not by the custom script.

`npm run format` and `npm run format:check` format/check the whole repository.
The hook deliberately checks formatting incrementally instead of requiring a
repository-wide reformat of existing files. `npm run check` remains independent
of the Git index and can be used in CI.
