# Revealing votes & reaching consensus

Once participants have voted, the facilitator reveals all votes at once and the
team agrees on a final estimate for the story.

## Reveal votes

The facilitator clicks **Reveal Votes** in the Session Controls panel. The
button is disabled until at least one participant has voted.

After reveal, every participant's card shows their actual vote value. The
statistics row at the top of the Participants panel updates:

![Participants panel after reveal — votes visible, stats row, and Agreed Points picker](/story-estimates/votes-revealed-annotated.png)

1. **Status badge** — changes to "Votes revealed" once the facilitator reveals.
2. **Statistics row** — Avg and Range computed from all numeric votes.
3. **Participant vote card** — displays the actual value after reveal.
4. **Revote / New Round** — facilitator controls to vote again or advance to the next story.
5. **Agreed Points picker** — click a value to record the agreed estimate for the story.

| Statistic  | Meaning                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| **Avg**    | Mean of all numeric votes (½ counts as 0.5; `?` and ☕ are excluded).         |
| **Range**  | Lowest and highest numeric vote, e.g. `5 – 8`.                                |
| **Agreed** | The agreed-upon value set by the facilitator (primary colour badge once set). |

## Set Agreed Points

After reveal, the facilitator sees the **Agreed Points** section in Session
Controls. It shows the same point cards used for voting. Click a value to
record it as the agreed estimate for that story. The selection auto-saves after
600 ms and is visible to all participants instantly.

::: tip Agreed Points vs average
Agreed Points is the value your team commits to — it need not match the
average. Choose whatever makes sense after the discussion.
:::

## Revote

If the team wants to discuss and vote again on the same story, the facilitator
clicks **Revote**. Votes are cleared and cards become active again. The round
stays on the same ticket — the ticket number does not change.

Revote is available after reveal, without starting a new round.

## What each role sees

| State                     | Participant sees            | Facilitator sees                                         |
| ------------------------- | --------------------------- | -------------------------------------------------------- |
| Round open, not yet voted | Cards active, others hidden | Same + Reveal Votes button                               |
| Round open, voted         | Own vote highlighted        | Same + Reveal Votes button                               |
| Votes revealed            | All votes + stats           | All votes + stats + Agreed Points picker + Revote button |
