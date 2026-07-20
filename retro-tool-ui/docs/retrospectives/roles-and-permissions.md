# Roles and permissions

Retrospective permissions are determined by the user's relationship to the
retro and their broader org/system role.

## Role matrix

| Action                                       | Creator | Team Lead | Org Admin | System Admin | Other Member |
| -------------------------------------------- | :-----: | :-------: | :-------: | :----------: | :----------: |
| View a retro (participant)                   |   Yes   |    Yes    |    Yes    |     Yes      |     Yes      |
| Add cards (active phase)                     |   Yes   |    Yes    |    Yes    |     Yes      |     Yes      |
| Vote (voting phase)                          |   Yes   |    Yes    |    Yes    |     Yes      |     Yes      |
| Add discussion notes                         |   Yes   |    Yes    |    Yes    |     Yes      |     Yes      |
| Signal Ready                                 |   Yes   |    Yes    |    Yes    |     Yes      |     Yes      |
| **Open Lobby / Start / phase transitions**   |   Yes   |    Yes    |    No     |      No      |      No      |
| Mark card as Discussed                       |   Yes   |    Yes    |    No     |      No      |      No      |
| Navigate discussion queue (Prev/Next)        |   Yes   |    Yes    |    No     |      No      |      No      |
| Mark carried item Done / Carry Forward Again |   Yes   |    Yes    |    No     |      No      |      No      |
| **End (Complete) the retro**                 |   Yes   |    Yes    |    Yes    |     Yes      |      No      |
| Delete the retro                             |   Yes   |    Yes    |    Yes    |     Yes      |      No      |
| Carry items forward from report              |   Yes   |    No     |    No     |      No      |      No      |
| Delete retro from the retros list            |   No    |    No     |    No     |    Yes\*     |      No      |

\* System admins and super admins can delete any retro from the list page.

## Role definitions

**Creator** — the user who created the retro. Identified by the `isCreator`
flag on the retro detail.

**Team Lead** — a member whose role on the retro's team is `team-lead`.
Identified by `isTeamLead`.

**Org Admin** — an `org-admin` (or `org-owner`) of the organisation that owns
the team. Identified by `isOrgAdmin`.

**System Admin** — a user with the `system-admin` or `super-admin` system role.
Identified by `isSystemAdmin`.

**Other Member** — any team member who is none of the above.

## Phase transitions vs completion

The code distinguishes two permission tiers:

- `canControlPhases` — creator or team lead only. Controls **Open Lobby**,
  **Start Now / Start Early**, **Move to Grouping**, **Move to Voting**, **Move
  to Discuss**, and the discussion navigation/mark-discussed controls. System
  admins and org admins do **not** have this permission, so they will never see
  phase-advance buttons that would 403.
- `canComplete` — creator, team lead, org admin, or system admin. Controls the
  **End** button and the **Delete** trash icon in the header.

## Participants

Every user who opens a retro URL is automatically recorded as a participant.
The participant list is shown in the retro header (avatar stack) and in the
lobby screen. Participants are counted in the report stats.

::: tip Minimum role to create
Any team member can create a retrospective. There is no special "retro
creator" role you need to be assigned; being a member of at least one team is
sufficient.
:::
