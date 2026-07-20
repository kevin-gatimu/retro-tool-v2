# Creating a survey

Click **New Survey** on the [Surveys list](/surveys/) to open the create
dialog. The button is disabled if you don't belong to any team, since team
membership is required for the default (Team) scope.

![The Create Survey dialog with a Text, a Rating, and a Multiple choice question](/surveys/create-dialog-annotated.png)

1. **Scope** — Team, Organization, or System-wide. Only the scopes you're
   allowed to use appear in the list (see
   [Roles and permissions](./roles-and-permissions)).
2. **Text question** — the default type for a new question.
3. **Rating question** — a 1–5 scale.
4. **Multiple choice question** — with its own set of options.

## Fields

| Field               | Notes                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Title               | Required, up to 200 characters.                                                              |
| Description         | Optional, up to 1,000 characters.                                                            |
| Scope               | Team / Organization / System — **locked once the survey is created**.                        |
| Team / Organization | Shown only when there's more than one you could pick; auto-filled when you have exactly one. |
| Anonymous survey    | When on, individual responses hide who submitted them.                                       |
| Questions           | 1–15 questions, each with a type, a prompt (up to 500 characters), and a Required checkbox.  |

## Adding questions

Click **Add question** to add another row, up to 15. Each question has:

- A **type** dropdown — see [Question types](./question-types) for what each
  one looks like when answered.
- A **prompt** text field.
- A **Required** checkbox (checked by default) — required questions must be
  answered before a response can be submitted.
- A trash icon to remove the question (disabled while only one question
  remains).

Multiple choice questions additionally show an options list (2–10 options,
each up to 255 characters) with **Add option** / remove-option controls.

A survey needs at least a title and, for every question, a non-empty prompt;
multiple choice questions need at least two non-empty options. The **Create
Survey** button stays disabled until the form is valid.

## Editing a survey

People with edit permission (see
[Roles and permissions](./roles-and-permissions)) can reopen this same dialog
from a survey card's **⋮ → Edit survey** menu. In edit mode:

- **Scope, team, and organization are locked** — only title, description,
  anonymity, and the question list can change.
- Existing questions keep their identity (so existing answers stay linked to
  them) — you can still add new questions, edit prompts, or remove questions.
