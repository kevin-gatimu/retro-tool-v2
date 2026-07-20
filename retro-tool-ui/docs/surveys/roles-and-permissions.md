# Roles and permissions

Survey permissions depend on the survey's **scope** (Team / Organization /
System) and, within that scope, your role.

## Who can create a survey at each scope

| Scope               | Who can create                           |
| ------------------- | ---------------------------------------- |
| Team                | Any member of that team.                 |
| Organization        | An org owner/admin of that organization. |
| System ("Everyone") | Restricted to select roles.              |

The **Scope** dropdown in the create dialog only ever shows the scopes you're
actually allowed to use.

## Who can edit a survey (title, description, questions)

The survey's **creator**. This holds at every scope. Scope, team, and
organization can never be changed after creation, even by someone who can
edit everything else.

## Who can close, reopen, or delete a survey

| Scope        | Who can manage (close/reopen/delete)                                                   |
| ------------ | -------------------------------------------------------------------------------------- |
| Team         | The creator, the team's lead, or an org owner/admin of the team's parent organization. |
| Organization | The creator, or an org owner/admin of that organization.                               |
| System       | Restricted to select roles — not even the creator otherwise.                           |

## Who can see a survey

| Scope        | Visible to                    |
| ------------ | ----------------------------- |
| Team         | Members of that team.         |
| Organization | Members of that organization. |
| System       | Everyone.                     |

## Who can see results and individual responses

- **Results (Summary)** appear for anyone who manages the survey, or who has
  responded to it, or once the survey is closed.
- **Individual responses (Responses tab)**:
  - Non-anonymous surveys — visible to anyone who can see results, with real
    names.
  - Anonymous surveys — visible only to people who can manage the survey, and
    every respondent shows as "Anonymous".

## Report actions (Export PDF / Email results)

Shown only to people who can manage the survey, and only once it has results
to show.
