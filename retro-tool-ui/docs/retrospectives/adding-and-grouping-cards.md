# Adding and grouping cards

## Adding cards (Adding Cards phase)

Once the facilitator starts the session, every participant sees the card grid
with one column per template. An input field sits at the bottom of each
column.

![Active board with cards added to each column](/retrospectives/retro-active-annotated.png)

### How to add a card

1. Click the textarea at the bottom of any column.
2. Type your card content.
3. Press **Enter** (without Shift) **or** click the **Add** button to submit.

The card appears instantly at the bottom of the column for you. Other
participants see new cards as they arrive in real time.

::: tip Timer and card visibility
When the card-creation timer is enabled, your cards are visible to only you
until the timer expires. The timer countdown is shown in the header. Once
time is up, all cards become visible to everyone simultaneously.
:::

### Deleting your own card

During the **Adding Cards** phase you can delete a card you wrote. Click the
**⋮** (more options) menu on the card and choose **Delete**. You can only
delete your own cards; no other participant's cards can be removed.

### Typing indicator

If another participant is currently typing in any column, their name appears
in the ready bar at the top: _"Alice is typing…"_ This only appears when the
Convex realtime backend is in use.

---

## Grouping cards (Grouping phase)

After the facilitator clicks **Move to Grouping**, card input fields disappear
and grouping controls activate. The goal is to merge cards that describe the
same or very similar topic before voting starts.

![Grouping phase with checkboxes on each card](/retrospectives/retro-grouping-annotated.png)

### Merging by drag and drop

Drag one card on top of another card **in the same column** to merge them.
The dragged card is absorbed into the target card. Cross-column merging is not
allowed.

### Merging by checkbox selection

1. Click a card (anywhere except the checkbox itself) or tick its **Select**
   checkbox to select it.
2. Select one or more additional cards in the same column.
3. A **Merge (N)** button appears in the column header. Click it to merge all
   selected cards.

**Before** — three separate cards selected, Merge (3) button active:

![Three cards selected in grouping phase, Merge (3) button shown — markers: 1 = Merge button, 2–4 = individual selected cards](/retrospectives/merge-before-annotated.png)

| Marker | Element                                    |
| ------ | ------------------------------------------ |
| 1      | **Merge (3)** button in the column header  |
| 2–4    | Individual cards, each checked for merging |

**After** — the three cards become one merged group:

![Single merged card showing bulleted list of source content and '3 cards merged' badge](/retrospectives/merge-after-annotated.png)

| Marker | Element                                                        |
| ------ | -------------------------------------------------------------- |
| 1      | Merged card showing all source texts as a bulleted list        |
| 2      | **3 cards merged** badge (tooltip shows original author names) |
| 3      | **Unmerge** button — available only during the Grouping phase  |

### Merged card appearance

After merging, the resulting card shows all source texts as a bulleted list
and a **N cards merged** badge with a tooltip listing the original authors.
The card also gets an **Unmerge** button during the Grouping phase.

### Unmerging

Click the red **Unmerge** button on any merged card to split it back into its
individual source cards. This is only available during the Grouping phase.

::: warning Cards can only be merged within the same column
Dragging a card from **Start** into **Stop** will show a warning toast and
cancel the drag. Merging is column-scoped.
:::

::: tip When to skip grouping
If your team has few cards and nothing is clearly duplicated, the facilitator
can click **Move to Voting** immediately without merging anything.
:::
