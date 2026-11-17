# Guardrails

## Route privacy and authorization tests

For changes to private data or content access, test the exported route
`loader`/`action`, not just the underlying service.

`app/test/routes.ts` provides an in-memory database built from the real
migrations, signed session requests and route arguments. Import it before the
route modules. It replaces only `~/db` and closes the database after each test;
sessions, access rules and services remain real. It never opens `data.db`.
Pass a route pattern to `routeArgs` when the handler depends on it; otherwise
the test helper defaults to the request pathname.

`app/routes/saved-access.test.ts` is the example:

- Check the owning Student's successful read/write as well as rejected access.
- Send POSTs directly, without first calling a loader.
- Exercise signed-out, unenrolled, PPP-blocked and wrong-Course requests.
- Check the serialized Instructor/Platform Admin loader output for private data.
- Approve a Refund Request through the real service; verify the routes hide the
  data, refuse writes and reveal the preserved data when access returns.

This seam covers server authorization and returned data, not rendering,
navigation, browser transport or textarea state.

## Mechanical coding standards

`npm run lint` runs the TypeScript-AST checks in `scripts/standards.ts`.
`npm run test` runs them automatically before Vitest. Tests of the checks live
in `scripts/standards.test.ts`.

The checks cover production `app/` TypeScript, excluding declarations, tests,
`app/test/` and generated/shared UI primitives in `app/components/ui/`.

| Rule                     | Required shape                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `intent-literal`         | Shared intent constants in action comparisons, switch cases, Zod literals and hidden form values.                                                                        |
| `inline-object-type`     | Object types and interfaces in the feature's `*.types.ts` file; components and fetchers use named types.                                                                 |
| `one-component-per-file` | One PascalCase JSX component per file; feature components outside route modules. React Router's exported `ErrorBoundary`, `HydrateFallback` and `Layout` are exceptions. |
| `component-location`     | Feature components in `app/features/<feature>/`; reusable components in `app/components/`.                                                                               |

`app/features/saved/` demonstrates the structure. Existing framework state
unions, such as `useFetcher().state`, remain framework types: comparing with
`"idle"` is already checked by TypeScript. A second enum adds no safety.

### Legacy exceptions

`scripts/standards-baseline.json` records pre-existing violations by file, rule
and source fingerprint, including occurrence counts. New or duplicated
violations fail; moving lines alone does not. An exception is not permission
to reproduce the pattern.

After fixing legacy violations, prune only resolved entries:

```sh
npm run lint -- --prune-baseline
```

`--write-baseline` bootstraps the initial inventory. Re-running it accepts all
current violations, so it is not a way to fix lint failures. Any added
exception needs explicit review. Baseline changes should remove debt rather
than silently grow it.
