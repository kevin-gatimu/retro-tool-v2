# Voting

When the facilitator clicks **Move to Voting**, card inputs and grouping
controls disappear and a thumbs-up button appears on every card.

![Voting phase with thumbs-up buttons and vote counts](/retrospectives/retro-voting-annotated.png)

## Casting a vote

Click the **👍** button on any card to give it a vote. The button turns solid
and the vote count on the card increments immediately (optimistic update).

A banner at the top of the board shows how many votes you have used out of
your maximum, for example: _"You have used 2 of 3 votes"_.

## Vote limits

Each participant has a fixed number of votes set at retro creation time
(default: **3**). Once you have used all your votes, clicking another card
shows a warning toast:

> _"You have used all 3 votes. Remove a vote to change your selection."_

## Removing a vote

Click the same **👍** button on a card you already voted for to remove your
vote. The button returns to its outline state, the count decrements, and one
vote becomes available again.

## What others see

During the voting phase, all cards and their running vote totals are visible
to all participants. There is no hidden-ballot mechanic — vote counts update
live for everyone as votes are cast or removed.

## Moving on

When the facilitator is satisfied with the voting (there is no automatic
cutoff), they click **Move to Discuss** in the header to advance to the
discussing phase. Cards are then sorted in the discussion queue by descending
vote count.

::: tip Vote early, adjust later
You can freely change your votes at any point during the Voting phase. Remove
a vote from one card and place it on another as many times as you like, as
long as you stay within your maximum.
:::
