// @ts-check
// Root files are entry points; every subfolder is private.
const PACKAGES_ROOT = "app/modules";
const R = PACKAGES_ROOT;
const PACKAGE_INTERNALS = `^${R}/[^/]+/[^/]+/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "entrypoint-boundary-from-app",
      comment: "App code imports only a module's root entry points.",
      severity: "error",
      from: { pathNot: `^${R}/` },
      to: { path: PACKAGE_INTERNALS },
    },
    {
      name: "entrypoint-boundary-across-packages",
      comment: "Internal imports are free within the same module.",
      severity: "error",
      from: { path: `^${R}/([^/]+)/`, pathNot: `^${R}/[^/]+/tests/` },
      to: { path: PACKAGE_INTERNALS, pathNot: `^${R}/$1/` },
    },
    {
      name: "tests-through-entrypoints",
      comment: "Tests use entry points and their own tests/ fixtures.",
      severity: "error",
      from: { path: `^${R}/([^/]+)/tests/` },
      to: { path: PACKAGE_INTERNALS, pathNot: `^${R}/$1/tests/` },
    },
    {
      name: "tests-folder-is-private",
      comment: "Production code cannot import test fixtures.",
      severity: "error",
      from: { pathNot: `^${R}/[^/]+/tests/` },
      to: { path: `^${R}/[^/]+/tests/` },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "analytics-route-through-module",
      comment: "The analytics route delegates database queries to its module.",
      severity: "error",
      from: { path: "^app/routes/instructor\\.analytics\\.tsx$" },
      to: {
        path: "^(app/db(?:/|$)|drizzle-orm(?:/|$)|node_modules/drizzle-orm/)",
      },
    },
    // Layering is separate from interface hiding. Add module dependency rules:
    // { name: "ui-not-billing", severity: "error",
    //   from: { path: `^${R}/ui/` }, to: { path: `^${R}/billing/` } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    },
  },
};
