# Calendar and skipped days

## Navigating days

The standup list page shows a calendar so you can jump to any date, plus a
day-navigation control inside each room.

![Standup list calendar with dots marking scheduled and active days](/standups/calendar-annotated.png)

1. **Month grid** — days with a scheduled or ongoing standup are marked; click
   a day to see that day's standups below the calendar.
2. **Day/date navigation** — inside a room, step to the previous/next day or
   jump back to **Today**. The room for any date loads that day's
   submissions, comments, and reactions — future dates that haven't happened
   yet show an empty room.

For a past date, only rooms that actually received submissions are listed;
for today or future dates, all standups scheduled for that day are shown
even if empty.

## Skipping a day

A team lead, org admin, or system admin can mark a scheduled day as skipped
— useful for holidays or days the team is off. From the room's manage menu
(**⋮**), choose **Skip this day** (or **Restore this day** if it's already
skipped), or open **Manage skipped days…** for a full calendar view.

![Manage skipped days dialog with a month grid](/standups/skip-days-dialog-annotated.png)

1. **Scheduled day marker** — a green dot under a day that's on the
   standup's schedule; click it to toggle skip/restore. Only today and future
   scheduled days are editable — past days are read-only.
2. **Skipped day** — shown amber and struck through.
3. **Has-updates marker** — a blue dot flags a day that already has
   submissions; skipping one of these asks for confirmation first (existing
   submissions are kept, just marked as not expected).

Skipping a day doesn't delete anything — submissions made on a skipped day
remain visible, and the day can be restored at any time. A skipped day's
room shows a banner ("This day is skipped") and disables new submissions.
