# Deep modules

Copy or delete `example/` as a starter template. Modules are flat: each immediate
child of `app/modules` is one module, not a container for nested modules.

```text
app/modules/<name>/
  index.ts       # public entry point
  index.server.ts # optional server-only entry point (React Router convention)
  lib/           # private implementation, freely nested
  tests/         # tests and fixtures
```

**Entry points.** Import only through a module's entry points (its root files).
Everything in any subfolder is private, regardless of its name or extension.
Discourage barrel files: expose several small entry points instead of re-exporting
a whole subtree through one index.

**Intra-module freedom.** Implementation files can import any file within their
own module. Other modules and app code use only its entry points.

**Tests through entry points.** Files in `tests/` exercise behaviour through root
entry points, including when testing across modules. They can import their own
`tests/` fixtures, but no module's private implementation or another module's
fixtures. Production code never imports test fixtures.

**No cycles.** Dependency cycles are errors. Run `npm run lint:boundaries` to
check these rules across `app/`. Layering between modules is a separate concern.
