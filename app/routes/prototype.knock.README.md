# Knock vendor-fit spike — THROWAWAY

Question: [Does Knock hold up against Cadence?](https://github.com/Javoto17/cohort-005-project/issues/42).
Branch: `prototype/knock-vendor-fit`. Do not merge. No production integration or schema changes.

## Run

`npm run dev`, select a person in DevUI, then open `/prototype/knock`.
Uses the existing gitignored `.env` variables `KNOCK_PUBLIC_API_KEY`,
`KNOCK_SECRET_API_KEY`, `KNOCK_SIGNING_KEY`, `KNOCK_FEED_CHANNEL_ID`.
The route rejects requests outside development. Only public keys and the
current person's short-lived signed token reach the browser.

## Required vendor configuration

In https://dashboard.knock.app, create and **commit to Development** a workflow:

- Key: `cadence-prototype-discussion-reply`
- One in-app feed step using the existing Cadence feed channel.
- Message body: `{{ data.message }}`.
- No email or push steps; this spike should not contact real email addresses.

Dashboard navigation must be confirmed with the human rather than guessed.
Background: https://docs.knock.app/send-and-manage-data/environments

## Human walkthrough

1. As Sarah Chen, choose Emma Wilson's Discussion Question and send.
   The event is simulated; it does not insert a new Discussion Reply.
2. Switch DevUI to Emma Wilson. Use **List + counts** until the Notification
   arrives. Check its `data.question_id` against the selected question.
3. Mark first seen, then first read. Fetch again; check timestamps and counts.
4. Switch to another Student and fetch: Emma's Notification must not appear.
5. Switch to an Instructor. Read preferences, initialize the prototype Enrollment
   category off, read back, opt into feed only, and read back. Email stays off.

## Remaining preference proof

Preference round-tripping alone does not prove that delivery honors preferences
or that fresh recipients are off by default. Before resolving the decision:

- Configure a dedicated Enrollment workflow tagged `cadence-prototype-enrollment`
  with an in-app feed step and an opt-in default, if supported.
- Verify a fresh Instructor receives nothing before opt-in and does receive the
  Notification after opt-in.
- If defaults require application-side initialization, record that explicitly
  and verify it before the first trigger, rather than claiming native defaults.

Do not call this ticket passed until all four acceptance checks and the human
walkthrough are complete.

## Observed live, 2026-11-15

- Server SDK `signUserToken("5")`: own feed HTTP 200, empty, unread/unseen 0.
- Same token requesting person `6`'s feed: HTTP 403.
- Own feed without user token: HTTP 400.
- Node SDK workflow trigger: HTTP 404 `workflow_missing`, so delivery is
  **blocked on workflow configuration**, not verified or a vendor-fit failure.

No secrets or signed tokens are recorded here.
