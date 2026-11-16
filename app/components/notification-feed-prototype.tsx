// THROWAWAY: three Notification Feed layouts in the real app shell, ?variant=A/B/C.
// Knock reads are real; every read/seen mutation and catalogue example is local.
import { useEffect, useState } from "react";
import { useFetcher, useSearchParams } from "react-router";
import {
  Bell,
  X,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  Receipt,
  Users,
  CheckCheck,
} from "lucide-react";
import type { loader } from "~/routes/prototype.notification-feed-data";

type Item = {
  id: string;
  title: string;
  body: string;
  category: string;
  target: string;
  read: boolean;
  seen: boolean;
  time: string;
};
const examples: Item[] = [
  {
    id: "example-reply",
    title: "Maya replied to your Discussion Question",
    body: "React Foundations · Effects\n“Try moving the subscription inside the effect.”",
    category: "Discussion",
    target: "Exact lesson, with the Discussion Question highlighted",
    read: false,
    seen: false,
    time: "2 minutes ago",
  },
  {
    id: "example-refund",
    title: "Your Refund Request was approved",
    body: "TypeScript Essentials · Individual Purchase\nDecision note: Approved within the Watch Limit. This does not confirm the money has been sent.",
    category: "Refund Request",
    target: "Purchase / Refund Request details (destination needs specifying)",
    read: false,
    seen: false,
    time: "1 hour ago",
  },
  {
    id: "example-seat",
    title: "Alex claimed a Seat",
    body: "Advanced React · Acme Team Licence\n3 Unclaimed Seats remain.",
    category: "Team Licence",
    target: "/team — relevant Team Licence",
    read: true,
    seen: true,
    time: "Yesterday",
  },
  {
    id: "example-question",
    title: "Sam asked a Discussion Question",
    body: "React Foundations · State\n“When should I use a reducer instead?”",
    category: "Discussion",
    target: "Exact lesson, with the Discussion Question highlighted",
    read: false,
    seen: false,
    time: "Yesterday",
  },
];
const variants = ["A", "B", "C"] as const;
type Variant = (typeof variants)[number];
const names = { A: "Bell popover", B: "Side drawer", C: "Full-width Feed" };

export function NotificationFeedPrototype({
  userId,
}: {
  userId: number | null;
}) {
  const [params] = useSearchParams();
  if (
    !import.meta.env.DEV ||
    !variants.includes(params.get("variant") as Variant)
  )
    return null;
  return <Prototype key={userId} userId={userId} />;
}

function Prototype({ userId }: { userId: number | null }) {
  const [params, setParams] = useSearchParams();
  const variant = params.get("variant") as Variant;
  const fetcher = useFetcher<typeof loader>();
  const [source, setSource] = useState<"live" | "examples">("live");
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [destination, setDestination] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (userId) fetcher.load("/prototype/notification-feed-data");
  }, [userId]); // Identity remount cancels old feed state.

  useEffect(() => {
    if (source === "examples") {
      setItems(examples.map((item) => ({ ...item })));
      return;
    }
    if (!fetcher.data || fetcher.data.userId !== userId) return;
    setItems(
      fetcher.data.entries.map(
        (entry: {
          id: string;
          read_at: string | null;
          seen_at: string | null;
          inserted_at: string;
          data?: Record<string, unknown>;
          blocks?: { type: string; content?: string; rendered?: string }[];
        }) => ({
          id: entry.id,
          title: String(
            entry.data?.title ?? entry.data?.message ?? "Notification"
          ),
          // Render vendor text as text, never inject vendor HTML.
          body:
            entry.blocks
              ?.map((block) => block.rendered ?? block.content ?? "")
              .join(" ")
              .replace(/<[^>]*>/g, "") ||
            "Open the raw vendor state below to inspect this Notification.",
          category: "Knock",
          target: String(
            entry.data?.action_url ??
              entry.data?.url ??
              "No destination supplied by this workflow"
          ),
          read: !!entry.read_at,
          seen: !!entry.seen_at,
          time: entry.inserted_at,
        })
      )
    );
  }, [fetcher.data, source, userId]);

  function cycle(direction: number) {
    const next =
      variants[
        (variants.indexOf(variant) + direction + variants.length) %
          variants.length
      ];
    setParams((previous) => {
      previous.set("variant", next);
      return previous;
    });
  }
  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (
        (event.target as HTMLElement).closest(
          "input, textarea, select, [contenteditable], [role=slider]"
        )
      )
        return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        cycle(event.key === "ArrowLeft" ? -1 : 1);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [variant, setParams]);

  const unread = items.filter((item) => !item.read).length;
  const unseen = items.filter((item) => !item.seen).length;
  const visible = items.filter((item) => !onlyUnread || !item.read);
  function toggleFeed() {
    setOpen(!open);
    if (!open)
      setItems((previous) => previous.map((item) => ({ ...item, seen: true })));
  }
  function rows(spacious: boolean) {
    return (
      <div className="divide-y">
        {visible.length === 0 && (
          <div className="p-10 text-center text-muted-foreground">
            <CheckCheck className="mx-auto mb-3" />
            {onlyUnread ? "You're all caught up" : "No Notifications yet"}
          </div>
        )}
        {visible.map((item) => (
          <article
            key={item.id}
            className={`flex gap-3 ${spacious ? "p-6" : "p-4"} ${!item.read ? "bg-primary/5" : ""}`}
          >
            <div className="mt-1 rounded-full bg-muted p-2 h-fit">
              {item.category === "Refund Request" ? (
                <Receipt size={18} />
              ) : item.category === "Team Licence" ? (
                <Users size={18} />
              ) : (
                <MessageSquare size={18} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <button
                className={`text-left hover:underline ${!item.read ? "font-semibold" : ""}`}
                onClick={() => {
                  setItems((previous) =>
                    previous.map((row) =>
                      row.id === item.id
                        ? { ...row, read: true, seen: true }
                        : row
                    )
                  );
                  setDestination(item.target);
                }}
              >
                {!item.read && (
                  <span
                    aria-label="Unread"
                    className="mr-2 inline-block size-2 rounded-full bg-primary"
                  />
                )}
                {item.title}
              </button>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {item.body}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{item.time}</span>
                <span>{item.category}</span>
                <button
                  className="underline"
                  onClick={() =>
                    setItems((previous) =>
                      previous.map((row) =>
                        row.id === item.id ? { ...row, read: !row.read } : row
                      )
                    )
                  }
                >
                  {item.read ? "Mark unread" : "Mark read"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  }
  const heading = (
    <div className="flex items-center justify-between gap-4 border-b p-4">
      <div>
        <h2 className="text-lg font-semibold">Notification Feed</h2>
        <p className="text-xs text-muted-foreground">{unread} unread</p>
      </div>
      <button
        className="text-xs underline"
        onClick={() =>
          setItems((previous) =>
            previous.map((item) => ({ ...item, read: true }))
          )
        }
      >
        Mark all read
      </button>
      <button
        aria-label="Close Notification Feed"
        onClick={() => setOpen(false)}
      >
        <X size={18} />
      </button>
    </div>
  );
  const filters = (
    <div className="flex gap-2 border-b p-3">
      {[false, true].map((value) => (
        <button
          key={String(value)}
          onClick={() => setOnlyUnread(value)}
          className={`rounded-full px-3 py-1 text-sm ${onlyUnread === value ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          {value ? "Unread" : "All"}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="fixed right-6 top-4 z-40">
        <button
          onClick={toggleFeed}
          aria-label={`Notification Feed, ${unread} unread`}
          aria-expanded={open}
          className="relative flex items-center gap-2 rounded-full border bg-background p-3 shadow"
        >
          <Bell size={20} />
          {variant !== "A" && <span className="text-sm">Notifications</span>}
          {unread > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </div>
      {open && variant === "A" && (
        <section
          aria-label="Notification Feed popover"
          className="fixed right-6 top-20 z-40 max-h-[65vh] w-[min(420px,calc(100vw-3rem))] overflow-y-auto rounded-xl border bg-background shadow-xl"
        >
          {heading}
          {filters}
          {rows(false)}
        </section>
      )}
      {variant === "B" && (
        <div
          aria-hidden={!open}
          inert={!open}
          className={open ? "" : "pointer-events-none"}
        >
          <button
            aria-label="Close drawer backdrop"
            className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-300 ease-out motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
            onClick={() => setOpen(false)}
          />
          <section
            aria-label="Notification Feed drawer"
            className={`fixed inset-y-0 right-0 z-40 w-[min(540px,100vw)] overflow-y-auto border-l bg-background pb-48 shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
          >
            {heading}
            {filters}
            {rows(true)}
          </section>
        </div>
      )}
      {open && variant === "C" && (
        <section
          aria-label="Full-width Notification Feed"
          className="fixed inset-y-0 left-0 right-0 z-30 overflow-y-auto bg-background pb-48 md:left-64"
        >
          <div className="mx-auto max-w-4xl pt-16">
            {heading}
            {filters}
            {rows(true)}
          </div>
        </section>
      )}
      <aside className="fixed bottom-20 left-1/2 z-50 w-[min(680px,94vw)] -translate-x-1/2 rounded-lg border bg-background p-3 text-xs shadow-lg">
        <p className="font-semibold">
          THROWAWAY ·{" "}
          {source === "live"
            ? "Live Knock read"
            : "Fictional catalogue examples — mixed roles, not delivery rules"}{" "}
          · All mutations are local
        </p>
        <div className="my-2 flex flex-wrap gap-3">
          <button
            className="underline"
            onClick={() => {
              setSource("live");
              if (userId) fetcher.load("/prototype/notification-feed-data");
            }}
          >
            Load Knock
          </button>
          <button
            className="underline"
            onClick={() => {
              setSource("examples");
              setItems(examples.map((item) => ({ ...item })));
            }}
          >
            Reset catalogue examples
          </button>
          <button
            className="underline"
            onClick={() => {
              setItems([]);
              setNotice("Empty state selected");
            }}
          >
            Preview empty state
          </button>
          <span>
            Person {userId ?? "not selected"} · loaded {items.length} · unread{" "}
            {unread} · unseen {unseen}
          </span>
        </div>
        <p>
          Candidate behavior: opening marks loaded items seen, not read.
          Clicking marks read and previews a destination (no navigation).
        </p>
        {source === "live" && (
          <p role="status">
            {!userId
              ? "Select a person in DevUI."
              : fetcher.state !== "idle"
                ? "Loading Knock…"
                : (fetcher.data?.error ??
                  "Read-only vendor snapshot; first 50 items, no real-time updates.")}
          </p>
        )}
        {destination && (
          <p className="mt-1 font-semibold">
            Destination preview: {destination}
          </p>
        )}
        {notice && <p>{notice}</p>}
        <details>
          <summary className="cursor-pointer">
            Relevant state / raw vendor snapshot
          </summary>
          <pre className="max-h-40 overflow-auto">
            {JSON.stringify(
              {
                source,
                variant,
                open,
                onlyUnread,
                items,
                vendor: fetcher.data,
              },
              null,
              2
            )}
          </pre>
        </details>
      </aside>
      <nav
        aria-label="Prototype variants"
        className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-5 rounded-full bg-slate-950 px-5 py-3 text-white shadow-xl"
      >
        <button aria-label="Previous variant" onClick={() => cycle(-1)}>
          <ArrowLeft size={18} />
        </button>
        <span className="whitespace-nowrap text-sm">
          {variant} · {names[variant]}
        </span>
        <button aria-label="Next variant" onClick={() => cycle(1)}>
          <ArrowRight size={18} />
        </button>
      </nav>
    </>
  );
}
