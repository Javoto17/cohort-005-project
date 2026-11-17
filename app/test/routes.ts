import { afterEach, vi } from "vitest";
import { RouterContextProvider } from "react-router";
import { createTestDb } from "./setup";
import { setCurrentUserId } from "~/lib/session";

const database = vi.hoisted(() => ({
  current: undefined as ReturnType<typeof createTestDb> | undefined,
}));

// Replace only the database boundary. Routes still use real sessions,
// access rules, services and migrations, without opening data.db.
vi.mock("~/db", () => ({
  get db() {
    if (!database.current) throw new Error("Call createRouteTestDb first.");
    return database.current;
  },
}));

afterEach(() => {
  database.current?.$client.close();
  database.current = undefined;
});

export function createRouteTestDb() {
  database.current = createTestDb();
  return database.current;
}

export async function routeRequest(
  pathname: string,
  studentId: number | null,
  form?: Record<string, string>,
  country = "US"
) {
  const url = `http://localhost${pathname}`;
  const headers = new Headers({ "CF-IPCountry": country });
  if (studentId !== null) {
    const cookie = await setCurrentUserId(new Request(url), studentId);
    headers.set("Cookie", cookie.split(";")[0]);
  }
  return new Request(url, {
    method: form ? "POST" : "GET",
    headers,
    body: form ? new URLSearchParams(form) : undefined,
  });
}

export function routeArgs<Params extends Record<string, string>>(
  request: Request,
  params: Params,
  pattern = new URL(request.url).pathname
) {
  return {
    request,
    url: new URL(request.url),
    pattern,
    params,
    context: new RouterContextProvider(),
  };
}
