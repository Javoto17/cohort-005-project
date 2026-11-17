# Coding standards

For private-data or content-access changes, consult the route-test seam in
[`docs/agents/guardrails.md`](docs/agents/guardrails.md). For component structure,
intent constants and object-type placement, that document points to the
automated checks and their legacy exceptions.

## Make calculated values readable

Name intermediate values when that reveals a condition's meaning or separates
calculation from presentation. Keep simple expressions inline when a name
would merely repeat them. Review for clarity, not a mandatory variable count.

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
