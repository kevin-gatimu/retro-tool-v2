# Creating a standup

Creating a standup is a manager action. **New Standup** only appears on the
standup list if you're a team lead on at least one team, an org owner/admin,
or a system admin — the same rule the server enforces.

![New standup form: details, schedule, and questions](/standups/new-standup-annotated.png)

1. **Standup details** — name the standup (pre-filled with the current
   day/time, e.g. "Standup - Monday 9th March, 8pm", but fully editable) and
   pick the team it belongs to. Only that team's members can see and submit
   to it.
2. **Schedule** — cadence (Daily, Weekly, Fortnightly, or One-time), which
   days it runs, and an optional start/end time.
3. **Questions** — one or more prompts members answer each day, each with a
   color, a Required toggle, and a drag handle to reorder.

## Cadence and schedule

| Cadence         | Behavior                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------- |
| **Daily**       | Runs on every day you check in the **Days** picker (defaults to weekdays).                        |
| **Weekly**      | Runs on the checked days, every week.                                                             |
| **Fortnightly** | Runs on the checked days, every other week — anchored to the ISO week the standup was created in. |
| **One-time**    | Runs once, for the day the standup was created. The Days picker is hidden.                        |

For recurring cadences, pick which days of the week the standup runs by
toggling **Mon–Sun**. You also set an optional **start/end time** — this is
shown on the standup card and room as a guideline; it doesn't lock
submissions to that window.

## Questions

Every standup ships with three default questions ("What did you complete
yesterday?", "What are you working on today?", "What blockers do you have?"),
but you can edit, remove, reorder (drag the grip handle), or add up to 10
questions. Each question has:

- A **prompt** (required, up to 500 characters).
- A **color** swatch, used as a left-border accent wherever the question's
  answer appears.
- A **Required** checkbox — required questions must be answered before a
  submission can be saved.

Click **Create standup** once a team, valid times, and at least one
non-empty question are set. You land on the standup list; open the room for
today to start submitting.

::: tip Editing later
Once created, a standup's name, cadence, schedule, and questions can still be
changed from the room's **Edit standup** menu — see
[Roles and permissions](./roles-and-permissions).
:::
