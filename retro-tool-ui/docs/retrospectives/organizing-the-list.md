# Organizing the list

The Retrospectives dashboard has a toolbar that lets you group, sort, filter,
and change the layout of your retrospectives. Every setting is saved to your
account automatically, so your preferences survive a page refresh and follow
you across devices.

![Retrospectives list showing the toolbar with Group, Sort, Layout, and Show completed controls](/retrospectives/organize-toolbar-annotated.png)

## Toolbar controls

### Group

Controls how retrospectives are divided into sections.

| Option                           | What it shows                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| **Space, then status** (default) | Outer group per team/space; inner sections for Ongoing and Completed within each space. |
| **Status**                       | Two sections — Ongoing and Completed — across all spaces.                               |
| **Space**                        | One section per team/space, no status sub-sections.                                     |
| **None**                         | A flat list with no grouping.                                                           |

### Sort

Controls the order of retrospectives within each group.

| Option                    | What it shows                                         |
| ------------------------- | ----------------------------------------------------- |
| **Most recent** (default) | Retrospectives ordered newest first by creation date. |
| **Oldest first**          | Retrospectives ordered oldest first.                  |
| **Name (A–Z)**            | Retrospectives ordered alphabetically by name.        |

### Layout

Toggles between two display modes.

| Option                         | What it shows                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------ |
| **Cards** (grid icon, default) | Expanded cards with team name, template name, status badge, and creation date. |
| **List** (rows icon)           | Compact rows — one retrospective per row with key details inline.              |

The **Cards** layout is useful when you want to scan status at a glance. The
**List** layout fits more retrospectives on screen at once.

![List layout — compact rows with one retrospective per row and the list button active](/retrospectives/organize-list-annotated.png)

### Show completed

A toggle switch to the right of the layout buttons. When **on** (default),
completed retrospectives are shown in their own group or section. When **off**,
only ongoing retrospectives are visible, reducing clutter during an active
sprint.

## Collapsible group sections

Each group section header has a chevron button. Click any header to collapse
or expand that section.

![ONGOING sub-group collapsed while COMPLETED remains expanded](/retrospectives/organize-collapsed-annotated.png)

::: tip Completed groups auto-collapse
When you first open the list, completed retrospectives are collapsed by default
to keep the view focused on active work. Expand them whenever you need to open
a past report.
:::

## Preference persistence

All view settings — group, sort, layout, show completed, and which groups are
collapsed — are saved to your user preferences on the server. Changes are
applied immediately in the UI and written to the server within 500 ms. If you
open the list on a different device or browser, your saved preferences load
automatically.
