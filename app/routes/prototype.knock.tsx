// THROWAWAY vendor-fit spike. Never merge into the production app.
import { useEffect, useState } from "react";
import { Form, data } from "react-router";
import KnockClient from "@knocklabs/client";
import { Knock, signUserToken } from "@knocklabs/node";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "~/db";
import { comments, users } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import type { Route } from "./+types/prototype.knock";

async function currentUser(request: Request) {
  if (!import.meta.env.DEV) throw new Response("Not found", { status: 404 });
  const id = await getCurrentUserId(request);
  const user = id
    ? db.select().from(users).where(eq(users.id, id)).get()
    : null;
  if (!user)
    throw new Response("Select a user from the DevUI panel", { status: 401 });
  return user;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await currentUser(request);
  const questions = db
    .select()
    .from(comments)
    .where(and(isNull(comments.parentId), isNull(comments.deletedAt)))
    .all();
  return data(
    {
      user: { id: String(user.id), name: user.name, role: user.role },
      token: await signUserToken(String(user.id), { expiresInSeconds: 900 }),
      publicKey: process.env.KNOCK_PUBLIC_API_KEY!,
      channelId: process.env.KNOCK_FEED_CHANNEL_ID!,
      questions: questions.filter((q) => q.userId !== user.id),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const actor = await currentUser(request);
  const form = await request.formData();
  const question = db
    .select()
    .from(comments)
    .where(eq(comments.id, Number(form.get("questionId"))))
    .get();
  if (
    !question ||
    question.parentId ||
    question.deletedAt ||
    question.userId === actor.id
  ) {
    throw new Response("Choose another person's Discussion Question", {
      status: 400,
    });
  }
  const recipient = db
    .select()
    .from(users)
    .where(eq(users.id, question.userId))
    .get()!;
  const knock = new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY! });
  try {
    const result = await knock.workflows.trigger(
      "cadence-prototype-discussion-reply",
      {
        actor: { id: String(actor.id), name: actor.name },
        recipients: [{ id: String(recipient.id), name: recipient.name }],
        data: {
          question_id: question.id,
          lesson_id: question.lessonId,
          message: `${actor.name} replied to your Discussion Question (vendor-fit simulation).`,
        },
      }
    );
    return { result, recipient: { id: recipient.id, name: recipient.name } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export default function Prototype({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  // A keyed child discards old feed state immediately when DevUI changes identity.
  return (
    <Probe
      key={loaderData.user.id + loaderData.token}
      config={loaderData}
      actionData={actionData}
    />
  );
}

function Probe({
  config,
  actionData,
}: {
  config: Route.ComponentProps["loaderData"];
  actionData: Route.ComponentProps["actionData"];
}) {
  const [client, setClient] = useState<KnockClient>();
  const [output, setOutput] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const knock = new KnockClient(config.publicKey);
    knock.authenticate({ id: config.user.id }, config.token);
    setClient(knock);
    return () => knock.teardown();
  }, [config]);
  async function run(operation: (knock: KnockClient) => Promise<unknown>) {
    if (!client) return;
    setBusy(true);
    try {
      setOutput(await operation(client));
    } catch (error) {
      setOutput({ error: String(error) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="max-w-4xl space-y-5 p-8">
      <h1 className="text-2xl font-bold">
        Knock vendor-fit prototype — throwaway
      </h1>
      <p>
        Does Knock support signed per-user feeds, Discussion Reply delivery,
        read/seen state and category × channel opt-in preferences? This is not
        the Notification Feed design.
      </p>
      <p>
        Current identity: <strong>{config.user.name}</strong> ({config.user.id},{" "}
        {config.user.role}). Token: RS256, 15 minutes; reload to renew. Use
        DevUI to switch people.
      </p>
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-bold">1. Simulate a Discussion Reply</h2>
        <p>
          Sends a real Notification to an existing Discussion Question’s author.
          Does not write a Discussion Reply to SQLite. Requires the workflow
          described in the README.
        </p>
        <Form method="post" className="flex gap-3">
          <select name="questionId" className="max-w-lg border p-2">
            {config.questions.map((q) => (
              <option key={q.id} value={q.id}>
                Question {q.id} → person {q.userId}: {q.body.slice(0, 70)}
              </option>
            ))}
          </select>
          <button className="rounded border p-2">Send Notification</button>
        </Form>
        <pre className="overflow-auto text-xs">
          {JSON.stringify(actionData, null, 2)}
        </pre>
      </section>
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-bold">2. Inspect the signed-in person’s feed</h2>
        <p>
          After sending, switch to the recipient in DevUI. Refresh until the
          asynchronous delivery arrives. Compare unread and unseen counts
          before/after each operation.
        </p>
        <div className="flex flex-wrap gap-3">
          {(["fetch", "markAsRead", "markAsSeen"] as const).map((op) => (
            <button
              key={op}
              disabled={!client || busy}
              className="rounded border p-2"
              onClick={() =>
                run(async (knock) => {
                  const feed = knock.feeds.initialize(config.channelId);
                  await feed.fetch();
                  if (op !== "fetch" && feed.getState().items.length)
                    await feed[op](feed.getState().items[0]);
                  await feed.fetch();
                  const { items, metadata, pageInfo } = feed.getState();
                  return { identity: config.user, items, metadata, pageInfo };
                })
              }
            >
              {op === "fetch"
                ? "List + counts"
                : op === "markAsRead"
                  ? "Mark first read"
                  : "Mark first seen"}
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-bold">3. New Enrollment → Instructor opt-in</h2>
        <p>
          Use an Instructor. These controls merge only the prototype category.
          Off is an explicit initial value, not proof of a vendor-level default.
          Email remains off when the feed is enabled.
        </p>
        <div className="flex gap-3">
          <button
            disabled={!client || busy}
            className="rounded border p-2"
            onClick={() => run((k) => k.user.getPreferences())}
          >
            Read preferences
          </button>
          {[false, true].map((enabled) => (
            <button
              key={String(enabled)}
              disabled={!client || busy}
              className="rounded border p-2"
              onClick={() =>
                run(async (k) => {
                  const existing = await k.user.getPreferences();
                  return k.user.setPreferences({
                    workflows: existing.workflows ?? undefined,
                    channel_types: existing.channel_types ?? undefined,
                    channels: existing.channels ?? undefined,
                    categories: {
                      ...existing.categories,
                      "cadence-prototype-enrollment": {
                        channel_types: { in_app_feed: enabled, email: false },
                      },
                    },
                  });
                })
              }
            >
              {enabled ? "Opt into feed only" : "Initialize off"}
            </button>
          ))}
        </div>
      </section>
      <h2 className="font-bold">Latest vendor state / error</h2>
      <pre className="max-h-[36rem] overflow-auto rounded border p-3 text-xs">
        {JSON.stringify(output, null, 2)}
      </pre>
    </main>
  );
}
