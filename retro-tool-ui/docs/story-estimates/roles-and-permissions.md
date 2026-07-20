# Roles & permissions

Story estimate sessions have two permission tiers on top of standard team
membership: **facilitator** (controls the session flow) and **admin** (can also
end a session started by someone else).

## Who is the facilitator?

The facilitator is the person who **created the session**. Facilitator
permissions apply only to that person.

## Permission matrix

| Action                     | Any team member | Facilitator (creator) | Team lead | Org/system admin |
| -------------------------- | :-------------: | :-------------------: | :-------: | :--------------: |
| View the session list      |       Yes       |          Yes          |    Yes    |       Yes        |
| Join a session and vote    |       Yes       |          Yes          |    Yes    |       Yes        |
| View the completed session |       Yes       |          Yes          |    Yes    |       Yes        |
| Export PDF / email report  |       Yes       |          Yes          |    Yes    |       Yes        |
| Start a round              |        —        |          Yes          |    Yes    |        —         |
| Reveal votes               |        —        |          Yes          |    Yes    |        —         |
| Set Agreed Points          |        —        |          Yes          |    Yes    |        —         |
| Revote                     |        —        |          Yes          |    Yes    |        —         |
| Start the next round       |        —        |          Yes          |    Yes    |        —         |
| End the session            |        —        |          Yes          |    Yes    |       Yes        |
| Delete a completed session |        —        |          Yes          |    Yes    |       Yes        |

::: tip Facilitator vs team lead
Team leads share the facilitator controls (start rounds, reveal, set agreed
points). Any org or system admin can end or delete a session regardless of who
created it.
:::

## Session states

Sessions move through these states in order:

| Status        | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| **Waiting**   | Session created, no round started yet.                         |
| **Voting**    | A round is open — participants can vote.                       |
| **Revealed**  | Votes are visible — facilitator sets Agreed Points or revotes. |
| **Completed** | Session ended — report available, no further voting.           |

## Ambient music

The session creator sees a floating **Music Player** for ambient background
music (genres: Ambient, Lo-fi, Jazz, Nature, Trap). This control is only
visible to the session creator and does not affect other participants.
