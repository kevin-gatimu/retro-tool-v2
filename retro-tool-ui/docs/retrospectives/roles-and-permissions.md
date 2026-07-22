# Roles and permissions

Retrospective permissions are determined by the user's relationship to the
retro and their broader org role.

## Role matrix

| Action                                       | Creator | Team Lead | Org Admin | Other Member |
| -------------------------------------------- | :-----: | :-------: | :-------: | :----------: |
| View a retro (participant)                   |   Yes   |    Yes    |    Yes    |     Yes      |
| Add cards (active phase)                     |   Yes   |    Yes    |    Yes    |     Yes      |
| Vote (voting phase)                          |   Yes   |    Yes    |    Yes    |     Yes      |
| Add discussion notes                         |   Yes   |    Yes    |    Yes    |     Yes      |
| Signal Ready                                 |   Yes   |    Yes    |    Yes    |     Yes      |
| **Open Lobby / Start / phase transitions**   |   Yes   |    Yes    |    No     |      No      |
| Mark card as Discussed                       |   Yes   |    Yes    |    No     |      No      |
| Navigate discussion queue (Prev/Next)        |   Yes   |    Yes    |    No     |      No      |
| Mark carried item Done / Carry Forward Again |   Yes   |    Yes    |    No     |      No      |
| **End (Complete) the retro**                 |   Yes   |    Yes    |    Yes    |      No      |
| Delete the retro                             |   Yes   |    Yes    |    Yes    |      No      |
| Carry items forward from report              |   Yes   |    No     |    No     |      No      |

## Role definitions

**Creator** — the user who created the retro. Identified by the `isCreator`
flag on the retro detail.

**Team Lead** — a member whose role on the retro's team is `team-lead`.
Identified by `isTeamLead`.

**Org Admin** — an `org-admin` (or `org-owner`) of the organisation that owns
the team. Identified by `isOrgAdmin`.

**Other Member** — any team member who is none of the above.

## Phase transitions vs completion

The code distinguishes two permission tiers:

- `canControlPhases` — creator or team lead only. Controls **Open Lobby**,
  **Start Now / Start Early**, **Move to Grouping**, **Move to Voting**, **Move
  to Discuss**, and the discussion navigation/mark-discussed controls. Org
  admins do **not** have this permission, so they will never see phase-advance
  buttons that would 403.
- `canComplete` — creator, team lead, or org admin. Controls the **End**
  button and the **Delete** trash icon in the header.

## Participants

Every user who opens a retro URL is automatically recorded as a participant.
The participant list is shown in the retro header (avatar stack) and in the
lobby screen. Participants are counted in the report stats.

::: tip Minimum role to create
Any team member can create a retrospective. There is no special "retro
creator" role you need to be assigned; being a member of at least one team is
sufficient.
:::
