# Icebreakers

Icebreakers are a quick warm-up before a standup or retrospective. A host
picks prompts from a deck (a built-in template, a random shuffle, or
one-off prompts they write themselves), the team answers each prompt out
loud together, and anyone can fire off a reaction when someone gives a great
answer.

## Ephemeral by design — no history

Icebreaker sessions have **no report and no history**. Ending a session
permanently deletes it — there is no completed-sessions list to revisit
afterwards, and nothing is archived. The icebreaker list at `/icebreakers`
only ever shows the (usually small) set of **currently active** sessions
across your teams. If you want a record of what was discussed, note it down
elsewhere before you end the session — once it's gone, it's gone.

## The swipe deck

Once a session starts, the host browses a stack of prompt cards one at a
time — dragging the card (or using the on-screen buttons) moves between
prompts without committing to anything. **Skip** or **Select** decide the
card that's currently on screen: Skip drops it, Select puts it up for
discussion. There's also a **Shuffle** to re-randomize the browsing order.

![Icebreaker list with an active session card](/icebreakers/list-annotated.png)

1. **Start Icebreaker** — opens the new-session form.
2. **Active session card** — name, status badge, and team for a session
   currently in progress.
3. **Join session** — jumps into the live runner.

## The three screens

1. **Icebreaker list** (`/icebreakers`) — every active session across your
   teams, with a search box and a **Start Icebreaker** button.
2. **New icebreaker** (`/icebreakers/new`) — name the session, pick a team,
   and choose how prompts are sourced (template, random mix, or your own).
   The same flow is also available as a dialog when starting an icebreaker
   from inside a standup room.
3. **Session runner** (`/icebreakers/:id`) — the live session: the swipe
   deck while curating, and the prompt on screen with reactions while
   presenting. Finishing or ending the session deletes it immediately and
   sends everyone back to the list.

## In this guide

- **Overview** — you're here.
- [Starting an icebreaker](./starting-an-icebreaker) — naming a session,
  picking a team, and choosing where prompts come from.
- [Swiping prompts](./swiping-prompts) — how the host browses and decides
  the deck.
- [Reactions and celebration](./reactions-and-celebration) — firing
  confetti bursts for a great answer.
- [Ending a session](./ending-a-session) — finishing the deck vs. ending
  early, and what happens to the session afterwards.
- [Roles and permissions](./roles-and-permissions) — who can start, curate,
  and end a session.

::: tip Reused inside standups
An icebreaker can be attached to a standup day and run right inside that
day's room — the create dialog there is the same as the standalone
**New icebreaker** page, just with the team fixed to the standup's team.
:::
