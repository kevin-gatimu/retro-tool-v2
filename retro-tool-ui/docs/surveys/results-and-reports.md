# Results and reports

Once a survey has results to show — you've responded, or you manage it — its
detail page shows a results view instead of the response form.

## Summary

The **Summary** tab shows one card per question, aggregated across every
response received so far.

![Survey results: text answers listed, a rating bar chart, and a choice bar chart](/surveys/results-summary-annotated.png)

1. **Report menu** — export or email these results (see below).
2. **Summary / Responses tabs** — switch between the aggregate view and
   individual respondents.
3. **Text question results** — every text answer listed.
4. **Rating question results** — a count and percentage bar per value (1–5),
   plus the average.

Multiple choice questions render the same way as ratings: one bar per option,
with its count and percentage of responses.

## Individual responses

If a **Responses** tab appears (alongside Summary), you can page through each
respondent's full submission one at a time.

![Paging through individual survey responses](/surveys/responses-tab-annotated.png)

1. **Previous / Next** — step through responses; the counter shows your
   position (e.g. "Response 1 of 2").
2. **Respondent identity** — name and avatar, or "Anonymous" when the server
   has stripped identity (see below).
3. **Answers** — this respondent's answer to every question, or "No answer"
   for anything they skipped.

**Who sees the Responses tab, and what identity it shows, is decided by the
server, not by a UI toggle:**

- **Non-anonymous surveys** — everyone who can see results sees the
  Responses tab with real names.
- **Anonymous surveys** — only people who can manage the survey see a
  Responses tab, and every respondent is shown as "Anonymous" regardless of
  who they are.
- If neither condition is met, no Responses tab is shown — only the Summary.

## Export and share

People who can manage a survey (see
[Roles and permissions](./roles-and-permissions)) see a **Report** button on
the survey detail page once there are results.

![The Report dropdown with Export as PDF and Email results options](/surveys/report-menu-annotated.png)

1. **Export as PDF** — builds and downloads a text-based (selectable) PDF
   entirely in the browser, no server round-trip. It includes the Summary
   section and, when per-respondent data is visible, a full per-response
   breakdown (with "Anonymous" in place of stripped identities). The file is
   named `survey-<title>-<date>.pdf`.
2. **Email results…** — opens a dialog to send the results by email.

### Emailing results

![The Email results dialog for a team-scoped survey, with a recipient checklist](/surveys/email-results-dialog-annotated.png)

1. **Select all** — check every listed recipient.
2. **Recipient checklist** — for **Team** and **Organization** surveys, this
   lists the team's or organization's members; leaving no one selected sends
   to the whole audience instead of requiring you to pick everyone
   individually.
3. **Send** — for team/org surveys, sends to your selection, or to everyone
   if nothing is checked. For **System** ("Everyone") surveys, the dialog is a
   search box instead of a checklist — you must search for and add at least
   one recipient, since system-wide surveys have no "send to all" bulk
   option.

The server independently restricts any recipients you pick to the survey's
actual audience — the recipient picker is a UX convenience, not the security
boundary.
