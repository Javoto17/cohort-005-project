// THROWAWAY: read-only Knock adapter for the Notification Feed design discussion.
import { createPrivateKey, sign } from "node:crypto";
import { getCurrentUserId } from "./session";

export async function loadPrototypeFeed(request: Request) {
  if (!import.meta.env.DEV) throw new Response("Not found", { status: 404 });
  const userId = await getCurrentUserId(request);
  if (!userId)
    throw new Response("Select a user from the DevUI panel", { status: 401 });
  try {
    process.loadEnvFile(".env");
    const publicKey = process.env.KNOCK_PUBLIC_API_KEY;
    const signingKey = process.env.KNOCK_SIGNING_KEY;
    const channel = process.env.KNOCK_FEED_CHANNEL_ID;
    if (!publicKey || !signingKey || !channel) {
      return {
        userId,
        entries: [],
        meta: null,
        error: "Knock development keys are missing from .env.",
      };
    }
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const payload = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ sub: String(userId), iat: now, exp: now + 300 })}`;
    const pem = signingKey.includes("BEGIN")
      ? signingKey.replace(/\\n/g, "\n")
      : Buffer.from(signingKey, "base64").toString("utf8");
    const signature = sign(
      "RSA-SHA256",
      Buffer.from(payload),
      createPrivateKey(pem)
    ).toString("base64url");
    const response = await fetch(
      `https://api.knock.app/v1/users/${userId}/feeds/${encodeURIComponent(channel)}?page_size=50`,
      {
        headers: {
          Authorization: `Bearer ${publicKey}`,
          "X-Knock-User-Token": `${payload}.${signature}`,
        },
      }
    );
    if (!response.ok)
      return {
        userId,
        entries: [],
        meta: null,
        error: `Knock returned ${response.status}.`,
      };
    const feed = await response.json();
    return {
      userId,
      entries: feed.entries ?? [],
      meta: feed.meta ?? null,
      error: null,
    };
  } catch {
    return {
      userId,
      entries: [],
      meta: null,
      error: "Could not read Knock. Check the development keys and connection.",
    };
  }
}
