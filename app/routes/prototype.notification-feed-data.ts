import { data } from "react-router";
import type { Route } from "./+types/prototype.notification-feed-data";
import { loadPrototypeFeed } from "~/lib/notification-feed-prototype.server";

export async function loader({ request }: Route.LoaderArgs) {
  return data(await loadPrototypeFeed(request), {
    headers: { "Cache-Control": "no-store" },
  });
}
