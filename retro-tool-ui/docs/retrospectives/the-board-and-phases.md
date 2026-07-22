# The board and phases

A retrospective moves through seven phases in order. The **facilitator**
(creator or team lead) controls when to advance. Other participants see the
phase transition live as it happens — no page reload required.

## Phase reference

| Phase label      | Status       | What participants see                                           |
| ---------------- | ------------ | --------------------------------------------------------------- |
| **Draft**        | `draft`      | Only the facilitator; the retro is not yet open.                |
| **Waiting**      | `waiting`    | The lobby screen — participants join and the facilitator waits. |
| **Adding Cards** | `active`     | The card grid with an input field at the bottom of each column. |
| **Grouping**     | `grouping`   | The card grid with drag-to-merge and checkboxes.                |
| **Voting**       | `voting`     | The card grid with a thumbs-up button on each card.             |
| **Discussing**   | `discussing` | The split discussion view (queue + focused card + notes).       |
| **Completed**    | `completed`  | The report view.                                                |

## Starting the retro

### From Draft

A newly created retro is in **Draft**. The facilitator has two choices:

- **Open Lobby** — transitions to **Waiting** and opens the participant
  gathering screen. A countdown timer auto-starts (shown in the header and on
  the lobby screen); when it hits zero, the retro transitions to
  **Adding Cards** automatically. The facilitator can also click **Start
  Early** at any point while in Waiting.
- **Start Now** — skips the lobby entirely and goes straight to
  **Adding Cards**.

### The Lobby (Waiting)

![The lobby screen showing participants and auto-start countdown](/retrospectives/retro-lobby.png)

The lobby screen shows:

- A live participant list (everyone who has opened the retro link).
- An auto-start countdown in the header and in the centre of the screen.
- A **Start Early** button (facilitator only) to skip the remaining wait.

Participants who are not the facilitator see a message: _"Waiting for the
facilitator to start the retro…"_

## Advancing through phases

Each phase has a single **advance** button shown on the right side of the
retro header. Only the creator or a team lead can click it.

| Current phase | Button label     | Advances to  |
| ------------- | ---------------- | ------------ |
| Draft         | Open Lobby       | Waiting      |
| Draft         | Start Now        | Adding Cards |
| Waiting       | Start Early      | Adding Cards |
| Adding Cards  | Move to Grouping | Grouping     |
| Grouping      | Move to Voting   | Voting       |
| Voting        | Move to Discuss  | Discussing   |
| Discussing    | End              | Completed    |

## The Ready bar (Adding Cards phase)

During **Adding Cards**, a small bar appears below the header:

- **Typing indicator** (left) — shows names of other participants currently
  typing a card (e.g. _"Alice is typing…"_). This is a Convex real-time
  feature and only appears when the app is using the Convex realtime backend.
- **Ready? / Ready!** button (right) — each participant can click this to
  signal they are done adding cards. The header shows a live count such as
  `2/4 ready`. This helps the facilitator know when to advance to Grouping.
  Ready status is cleared automatically when the phase changes.

## Phase alerts

Contextual banners appear at the top of the board:

- **Voting Phase** — shows how many votes you have used out of your maximum
  (e.g. _"You have used 2 of 3 votes"_).
- **Grouping Phase** — reminder that cards can be merged before voting.

## The facilitator music player

A floating **Focus Music** button appears in the bottom-right corner for the
facilitator from the Waiting phase onwards. It plays ambient focus music
during the session and is invisible to participants.

::: tip Auto-start timer
The lobby auto-start timer is set by the server when the facilitator clicks
**Open Lobby**. The facilitator can always click **Start Early** before the
countdown finishes. If the countdown reaches zero, the retro starts
automatically without any further click.
:::
