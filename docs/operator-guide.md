# Operator guide — Medical Resource Check-In

One page for Medical Unit staff.

## Incident setup

1. Open the admin app (Google sign-in via Cloud IAP).
2. Confirm incident name, number, Fire document email, timezone, and operating period.
3. Print or share the **Check-in form** QR. It encodes only the public form URL. Respondents do not sign in.

## Field check-in

Each person submits once, including every ambulance and REMS member. Confirmation shows the Fire email and the document checklist. **Do not accept file uploads.** Documents stay in the Fire email.

## Daily admin work

- **Roster** — people grouped under resources. Ember-bordered fields are the only admin edits (Division, Camp, effective dates, extension). Submitted answers stay locked.
- **Glide Path** — 14-day view. Print landscape, one page wide. Last work day = first work day + length − 1 + extension. DMB starts the next day.
- **Review queue** — ambiguous matches never auto-merge. Link to a candidate or create a provisional resource. Every decision is audited.
- **Documents** — cycle status only (Not Required → Requested → Received → Verified → Rejected → Expired). Narcotics on the form requires a Medical Director letter status.

## Close and reuse

Close the incident to stop submissions. Create a **clean incident** from the Check-in page. It copies no people, responses, or ids.
