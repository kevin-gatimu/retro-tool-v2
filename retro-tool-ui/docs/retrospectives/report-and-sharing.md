# Report and sharing

When a retro is completed, the board is replaced by the **Retro Report**.

![The completed retro report with stats and card sections](/retrospectives/retro-report-annotated.png)

## Report overview

The report is accessible to any participant who opens the retro link after
completion. It contains:

- **Stats row** — participants, total cards, total votes cast, total discussion
  notes.
- **Most Voted** — the single card with the highest vote count (if any).
- **Discussed (N)** — collapsible section listing all cards that were marked as
  discussed, grouped by column. Each card shows its vote count and any
  discussion notes.
- **Not Discussed (N)** — cards the team did not reach. The creator can select
  any of these and carry them forward to the next retro.
- **Carried Forward (N)** — cards that were explicitly carried forward during
  the current retro's completion step.
- **Carried From Previous Retro (N)** — items brought in from the previous
  session; shows their resolution status.

## Exporting to PDF

Click the **Export / Email** menu icon (top right of the report header) and
choose **Export PDF**. The PDF is generated entirely in the browser — no server
round-trip — and downloads automatically. The file is named
`retro-<name>-<date>.pdf`.

The PDF contains:

- Header: retro name, team name, completion date, participant/card/vote/comment
  counts.
- Discussed cards grouped by column, with vote counts and discussion notes.
- Not-discussed cards grouped by column.
- Carried-forward cards (if any).
- Carried-from-previous-retro items (if any).
- Page numbers.

::: tip Emoji rendering
The PDF uses the standard Helvetica font which does not support emoji. Emoji
in card text are stripped automatically; the remaining text renders correctly.
:::

## Emailing the report

Click the **Export / Email** menu and choose **Send Email**. A dialog appears
where you can send the report to the whole team or to specific recipients.
Click **Send**. The server sends the email and a toast confirms how many
recipients received it.

## Carrying items forward

In the **Not Discussed** section, the retro creator sees a checkbox next to
each undiscussed card. Select the cards you want to bring to the next retro,
then click **Carry Forward**. This creates action items on the current retro
that will appear in the next retro's discussion phase as **Carried Forward**
items.

![Not Discussed section with two cards checked, Carry Forward button active — markers: 1 = Not Discussed section, 2–3 = checked cards, 4 = Carry Forward button](/retrospectives/carry-forward-selection-annotated.png)

| Marker | Element                                                                   |
| ------ | ------------------------------------------------------------------------- |
| 1      | **Not Discussed** section header                                          |
| 2–3    | Cards checked for carry-forward                                           |
| 4      | **Carry Forward (2)** button — enabled once at least one card is selected |

After clicking **Carry Forward**, the report immediately updates: the selected
cards are removed from **Not Discussed** and appear in a new **Carried
Forward** section on this retro's report. The next retro on the same team
will show them in the **Carried From Previous Retro** section of its report.

![Sprint 43 Retro report showing 'Carried From Previous Retro (2)' section with two items brought forward from Sprint 42 Retro](/retrospectives/carried-from-previous-report-annotated.png)

Only the retro **creator** can carry items forward from the report (not the
team lead or admins). The carry-forward button and checkboxes are hidden for
all other roles.

## Deleting a retrospective

The trash icon in the retro header is available to the creator, the team lead,
org admins, and system admins. Clicking it opens a confirmation dialog. Deleting
a retro permanently removes it along with all its cards, votes, comments, and
action items and cannot be undone.

::: warning Deletion is permanent
There is no soft-delete or recycle bin. If you delete a retro, all data
associated with it is gone immediately.
:::
