# Organizing the list

The Story Estimates dashboard has a toolbar that lets you group, sort, filter,
and change the layout of your sessions. Every setting is saved to your account
automatically, so your preferences survive a page refresh and follow you across
devices.

![Story Estimates list showing the toolbar with Group, Sort, Layout, and Show completed controls](/story-estimates/organize-cards-annotated.png)

1. **Group** — controls how sessions are divided into sections (Space/Status/None).
2. **Sort** — controls order within each group (Most recent, Oldest first, Name A–Z).
3. **Cards layout button** — active in this view; switches to expanded card display.
4. **Show completed toggle** — hides or shows completed sessions.
5. **Start Estimating** — opens the wizard to create a new session.

## Toolbar controls

### Group

Controls how sessions are divided into sections.

| Option                           | What it shows                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| **Space, then status** (default) | Outer group per team/space; inner sections for Ongoing and Completed within each space. |
| **Status**                       | Two sections — Ongoing and Completed — across all spaces.                               |
| **Space**                        | One section per team/space, no status sub-sections.                                     |
| **None**                         | A flat list with no grouping.                                                           |

### Sort

Controls the order of sessions within each group.

| Option                    | What it shows                                    |
| ------------------------- | ------------------------------------------------ |
| **Most recent** (default) | Sessions ordered newest first by last activity.  |
| **Oldest first**          | Sessions ordered oldest first.                   |
| **Name (A–Z)**            | Sessions ordered alphabetically by session name. |

### Layout

Toggles between two display modes.

| Option                         | What it shows                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| **Cards** (grid icon, default) | Expanded cards with team name, participant count, sprint link, and an action button. |
| **List** (rows icon)           | Compact rows — one session per row with key stats inline.                            |

The **Cards** layout is useful when you want to scan status at a glance. The
**List** layout fits more sessions on screen at once.

![List layout — compact rows with one session per row and the list button active](/story-estimates/organize-list-annotated.png)

1. **Group** — same grouping control as in Cards layout.
2. **Sort** — same sort control.
3. **List layout button** — active here; each session displays as a compact row.
4. **Show completed toggle** — visible to the right of the layout buttons.

### Show completed

A toggle switch to the right of the layout buttons. When **on** (default),
completed sessions are shown in their own group or section. When **off**, only
ongoing sessions are visible, reducing clutter during an active sprint.

## Collapsible group sections

Each group section header has a chevron button. Click any header to collapse
or expand that section.

![ONGOING sub-group collapsed while COMPLETED remains expanded](/story-estimates/organize-collapsed-annotated.png)

1. **ONGOING collapsed** — the right-pointing chevron shows this sub-group is collapsed; click to expand.
2. **COMPLETED expanded** — the down-pointing chevron shows this sub-group is open; click to collapse.

::: tip Completed groups auto-collapse
When you first open the list, completed sessions are collapsed by default to
keep the view focused on active work. Expand them whenever you need to open a
past report.
:::

## Preference persistence

All view settings — group, sort, layout, show completed, and which groups are
collapsed — are saved to your user preferences on the server. Changes are
applied immediately in the UI and written to the server within 500 ms. If you
open the list on a different device or browser, your saved preferences load
automatically.
