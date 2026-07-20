# Running rounds

A round corresponds to one story. Facilitators start, manage, and advance
rounds; participants vote within each round.

## Start the first round

When the session first opens, the **Current Story** area shows the placeholder
text "Click 'Start Round' in the controls below to begin the first round."

Click **Start Round** in the Session Controls panel. A dialog opens:

![Start First Round dialog with ticket number input](/story-estimates/round-modal-annotated.png)

1. **Ticket number field** — enter the story identifier (e.g. `AUTH-142`); required before the button enables.
2. **Start Round button** — confirms the ticket and opens voting for all participants.

Type the ticket number (e.g. `PROJ-123`) and click **Start Round** (or press
**Enter**). The ticket number is required — the button stays disabled while the
field is empty. The round opens and participants can begin voting.

## Start subsequent rounds

After the current round is complete (votes revealed and Agreed Points set),
click **New Round** to open the same dialog for the next ticket.

::: tip Round counter
The session header shows the current round number. Completed rounds are listed
in the session report.
:::

## Timer

If you chose a **Default Timer per Story** when creating the session, a
countdown progress bar and badge (`mm:ss`) appear in the session header when a
round starts. The timer auto-starts at the configured duration and counts to
zero. It does not end the round — revealing votes and starting the next round
are always manual actions.

A timer of **None** skips the countdown entirely.

## End the session

Once all stories are estimated, click **End Session** in the Session Controls
panel. A confirmation dialog reads:

> "This will complete the estimation session and move it to history. All votes
> will be preserved for the report."

Confirm to close the session. The page transitions to the
[completed session report](./report-and-sharing). The session moves to the
**History** section on the Story Estimates list page.

::: warning Ending is permanent
Ending a session cannot be undone. Make sure all rounds are complete and Agreed
Points are recorded before ending.
:::
