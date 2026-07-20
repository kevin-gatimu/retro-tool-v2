# Roles and permissions

| Action                                            |          Team member           | Team lead | Org owner/admin |
| ------------------------------------------------- | :----------------------------: | :-------: | :-------------: |
| View a standup room and its submissions           |               ✅               |    ✅     |       ✅        |
| Create a standup                                  |               ❌               |    ✅     |       ✅        |
| Submit / edit / delete **your own** update        |               ✅               |    ✅     |       ✅        |
| Comment on any submission                         |               ✅               |    ✅     |       ✅        |
| Delete **your own** comment                       |               ✅               |    ✅     |       ✅        |
| Delete **anyone's** comment                       |               ❌               |    ✅     |       ✅        |
| Add a poll or icebreaker to a room                | if the day accepts submissions |    ✅     |       ✅        |
| Export / email the report                         |               ✅               |    ✅     |       ✅        |
| Edit standup (name, cadence, schedule, questions) |               ❌               |    ✅     |       ✅        |
| Skip / restore a day                              |               ❌               |    ✅     |       ✅        |
| End / reactivate a standup                        |               ❌               |    ✅     |       ✅        |
| Delete a standup                                  |               ❌               |    ✅     |       ✅        |

The standup's **creator** also always has manage rights on it, even if their
team role later changes.

## What "manage" unlocks

The room's **⋮** menu (edit, skip management, reactivate/end, delete) only
appears if you can manage the standup — a team lead on the standup's team, an
org owner/admin of its organization, or the person who created it.

## Submitting is scoped to active, non-skipped days

Adding a submission (or a poll/icebreaker) to a room requires:

- the standup is still **active** (not ended),
- the day isn't **skipped**, and
- the date is today or earlier (you can't submit for a future day).

An ended standup or a skipped day shows a banner explaining why new
submissions are disabled; a manager can reactivate the standup or restore
the day to unlock it again.
