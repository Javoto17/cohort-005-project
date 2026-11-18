# Coding standards

## Import a module only through its entry points

A module in `app/modules/` exposes its root files and hides everything in
its subfolders. Outside the module, import `~/modules/<name>/index.server`,
for example, never `~/modules/<name>/lib/...`. The module's own tests also use
entry points; fixtures within their own `tests/` folder are allowed.
See the [deep-module convention](./app/modules/README.md).

## A route does not query data a module owns

Once a module owns a feature's data, the route asks the module for it.
Keep those queries and domain decisions inside the module instead of importing
`~/db` or `drizzle-orm` into the route to reproduce them.

## Expose focused behaviour, not implementation

Prefer several small root entry points over a barrel re-exporting a whole
subtree. Extend the interface deliberately when a caller needs new behaviour,
rather than reaching into private files or relaxing the lint rules.

## Keep browser entry points free of server dependencies

Expose separate server and browser entry points when execution requirements
differ. Browser entry points must not import server-only dependencies, directly
or transitively.

## Verify module imports before completing a change

Run `npm run check`; it includes `lint:boundaries`. During review, also check
that callers delegate domain behaviour to the module and tests assert public
results rather than implementation details.

## Fail with a thrown response, not a return value

A loader or an action that cannot continue throws. It does not return an
error shape for the component to unpack.

```ts
if (!course) throw data("Course not found", { status: 404 });
```

The route then has one success path. A returned error shape gives every
component a second path to forget about.

## Parse untrusted input with a schema

Form data, search parameters and request bodies get a zod schema before the
values reach any query. Do not read `formData.get("x") as string`. The cast
is a lie the type checker believes.

## Do not write `any`, and do not write `!`

Both switch the type checker off at the exact point you are least sure. If a
value can be missing, narrow it with a check. If you cannot name the type,
the shape is wrong — fix the shape.

## Let the code explain itself

Name and extract until a comment is unnecessary. A comment earns its place
only for a _why_ the code cannot express: a constraint, a decision, a link to
the ADR behind it. A comment that restates _what_ the code does goes stale the
first time the code changes.

## Arrange tests through the module under test

Test setup calls the module's own functions. When the function you need does
not exist, add it to the module rather than inserting rows directly, so a
change to how the module stores its data leaves its tests alone.
