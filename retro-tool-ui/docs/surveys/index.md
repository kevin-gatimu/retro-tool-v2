# Surveys

Surveys are longer-form questionnaires for collecting structured feedback. Where a
[poll](../polls/) is a single quick question with one set of options, a survey
bundles multiple questions of different types — free text, a 1–5 rating, or
multiple choice — under one title, and can be aimed at a team, a whole
organization, or everyone in the system.

![A survey card showing its scope badge, actions menu, and response counts](/surveys/survey-card-annotated.png)

1. **Scope, status & response badges** — who the survey is for (Team /
   Organization / Everyone), whether it's Active or Closed, and whether you've
   already responded.
2. **Survey actions** — Edit, Close/Reopen, and Delete, shown only to people
   with permission to manage this survey.
3. **Question count, response count, and creator.**

## Surveys vs. polls

|                | Poll          | Survey                              |
| -------------- | ------------- | ----------------------------------- |
| Questions      | One           | Up to 15                            |
| Question types | Single choice | Text, Rating (1–5), Multiple choice |
| Scope          | Team only     | Team, Organization, or System-wide  |
| Anonymity      | Optional      | Optional                            |

## The scope model

Every survey is created at one of three scopes, chosen when it's created and
**locked afterwards**:

- **Team** — visible to members of one team you belong to.
- **Organization** — visible to everyone in one organization you're an
  owner/admin of.
- **System** ("Everyone") — visible to every user in the system. Creating
  these is restricted to select roles.

## The three screens

- **Surveys list** (`/surveys`) — every survey you can see, as cards, with a
  **New Survey** button to create one.
- **Create / Edit dialog** — title, description, scope, anonymity, and the
  question list.
- **Survey detail** (`/surveys/:surveyId`) — the response form (if you haven't
  responded and the survey is open), or the results view (summary charts and,
  where visible, individual responses).

## In this guide

- **Overview** — you're here.
- [Creating a survey](./creating-a-survey) — the create dialog, scope
  selection, and anonymity.
- [Question types](./question-types) — Text, Rating, and Multiple choice.
- [Responding to a survey](./responding-to-a-survey) — filling out and
  submitting, and editing your response later.
- [Results and reports](./results-and-reports) — the Summary and Responses
  tabs, PDF export, and emailing results.
- [Roles and permissions](./roles-and-permissions) — who can create, edit,
  close, delete, and see responses at each scope.
