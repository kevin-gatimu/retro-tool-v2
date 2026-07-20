# Report & sharing

When a session ends, it moves to **History** on the Story Estimates list and
opens a completed session report.

## The session report

The report is accessible any time by clicking the completed session from the
list.

![Completed session report with summary stats, per-round card, and Report menu open](/story-estimates/report-menu-annotated.png)

1. **Summary stats tiles** — Rounds, Date, Participants, and Votes Cast at a glance.
2. **Report menu** — click to open the Export & share panel with PDF and Email options.
3. **Per-round card** — ticket number, duration, started timestamp, and vote statistics.
4. **Export & share panel** — Export as PDF and Email report… options.

### Summary stats

A row of four tiles at the top of the report:

| Tile             | Meaning                                  |
| ---------------- | ---------------------------------------- |
| **Rounds**       | Total number of estimation rounds.       |
| **Date**         | Date the session ran.                    |
| **Participants** | Number of team members who participated. |
| **Votes Cast**   | Total votes across all rounds.           |

If a sprint link was set when creating the session, an **Open sprint board**
link appears beneath the session name.

### Per-round cards

Each round has its own card showing:

- **Ticket No.** — the identifier entered at round start.
- **Duration** and **Started** timestamp.
- **Votes, Average, Range** — computed from numeric votes only (`?` and ☕ are
  excluded).
- **Agreed Points** — the value the facilitator recorded, highlighted in the
  primary colour.
- A table of **Member / Role / Estimate** for every vote cast.

## Export as PDF

Click **Report** (top right of a completed session) to open the export menu,
then choose **Export as PDF**. The browser generates and downloads a PDF named
`estimate-<session-name>-<date>.pdf`. The PDF includes all rounds with their
ticket numbers, statistics, agreed points, and the individual votes table.

## Email the report

Choose **Email report…** from the **Report** menu. Select one or more team
members from the picker and click **Send**. Each recipient receives the session
summary by email.

::: tip Who can export
Any participant who can view the session can export its report. Exporting does
not require facilitator permissions.
:::
