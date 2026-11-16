# Notification Feed UI — throwaway, never merge

Question: [What does the Notification Feed look like in Cadence?](https://github.com/Javoto17/cohort-005-project/issues/50)

Run `npm run dev`, then open `/dashboard?variant=A` and select a person in DevUI.
No extra dependencies, database changes, workflow provisioning, or vendor writes.
Uses the existing `.env` Knock public key, signing key and Feed channel id.

The bottom arrows (or keyboard left/right) cycle three designs in the actual
Cadence shell, preserving the host page's loader and content:

- `?variant=A`: compact bell popover, keep the current task visible.
- `?variant=B`: wide right drawer, more room for context alongside the current task.
- `?variant=C`: full-width Notification Feed, prioritise scanning over the host task.

Click the bell to open. Try All / Unread, mark read / unread, mark all read,
clicking a row, closing/reopening, empty state, and switching people with DevUI.

## Real versus simulated

- **Real:** a server-side Knock GET, authenticated with a five-minute RS256 token
  whose subject is the selected Cadence person. No keys or tokens reach the browser.
  The vendor snapshot shows total / unread / unseen counts. Only the first 50
  entries are loaded; no pagination or live updates are implemented.
- **Simulated:** all read / seen mutations. Local counts describe loaded rows,
  not necessarily the vendor total. Reloading Knock resets local changes.
- **Fictional:** catalogue examples deliberately mix recipients across roles to
  compare row content. They are not evidence of recipient targeting or delivery.
- **Clicks:** preview a proposed destination without navigation or modifying
  course content. Actual destinations, missing resources and authorization still
  need agreement.
- UI and data endpoint are development-only. This is not a production dialog:
  focus trapping, focus restoration, responsive polish, background inertness,
  realtime delivery, pagination, token renewal and accessibility testing remain
  implementation work.

## Proposed, not yet approved

Bell badge = unread count (99+ cap). Opening marks loaded Notifications seen
without reading them. A row click marks it read. Explicit read/unread and mark-all
controls are available. All and Unread filters preserve chronology. Newest first
comes from the vendor snapshot.

## Human feedback needed before resolution

- Which layout, or which combination?
- Unread badge versus unseen badge? Does opening leave the badge intact?
- Click-to-read, explicit marking, or another rule?
- Are snippets, course / lesson context and timestamps enough?
- What happens for a deleted Discussion Question / Reply, removed Enrollment,
  or already-decided Refund Request?
- Should clicking close the surface and navigate directly? What is the buyer's
  Refund Request detail destination, which does not currently have its own route?

Keep the ticket open until a live discussion settles these questions. Record the
answer on the ticket, not in the map. Production implementation is outside this map.
