# Medical Resource Check-In & Glide Path

Implemented as a GCP-ready React + TypeScript monorepo. Local run: [docs/local-dev.md](docs/local-dev.md). Operator guide: [docs/operator-guide.md](docs/operator-guide.md). GCP: [infra/gcp-setup.md](infra/gcp-setup.md). Plan (HTML): [implementation-plan.html](implementation-plan.html).

## Purpose

Give the Medical Unit a single, reliable place to check in wildfire medical resources (ambulances, REMS teams, EMPFs, MEDL, and related positions) and see who is on the incident, where they are assigned, and when they demobilize — without copying rows between Microsoft Forms and Excel, and without storing clinical or patient data.

Field personnel scan an incident QR and each submit one 34-question form for themselves. The tracker stores that response once, groups people under the resource they were ordered on, and lets staff add only the operational facts the form cannot know (Division, Camp, Call Sign, extensions, document status).

## Objective

- Replace the manual Forms-plus-spreadsheet workflow with a GCP-hosted public check-in form and an IAP-protected admin tracker.
- Enforce one response = one person, safe resource matching (no silent merges), and separate resource vs personnel counts.
- Calculate Last Work Day and demobilization dates consistently, and surface them on a one-page Glide Path.
- Keep original answers immutable; store admin corrections as overrides; store document **status** only (files stay in the Fire email).
- Protect restricted personal and contractual fields from roster and Glide Path views.
- Make an incident closable and reusable as a clean package with no leftover people, responses, or ids.

---

# Handoff: Medical Resource Check-In & Glide Path — Admin Web App

## Prompt for Claude Code

> Paste everything below into Claude Code as the opening prompt, with this folder in the working directory.

---

Build a web app called **Medical Resource Check-In & Glide Path**. It is the Medical Unit administrator's tracker for wildfire incident medical resources (ambulances, REMS teams, EMPFs, MEDL). The design reference is `Medical Check-In Ops.dc.html` in this folder, and the full behavioral contract is `approval-rfc.md`.

Read both files before writing code. The HTML file is a **design reference prototype**, not production code — recreate its screens in a real stack, do not copy its markup. If the target repo already has a framework and component library, use those. If not, use React + TypeScript + Vite with plain CSS modules or Tailwind, and no component library.

### What the app does

Medical personnel arriving at a wildfire incident scan a QR code and each fill out one mobile form (34 questions, one person per submission). Responses are stored immutably. The admin app groups people under the resource they were ordered on, lets the admin add operational detail that the form cannot know (Division, Camp, Call Sign, extensions), calculates demobilization dates, and surfaces who is leaving when.

### Non-negotiable business rules

These come from the approved RFC and must be enforced in the data layer, not just the UI:

1. One form response equals exactly one person. A team submission must never create several people.
2. Ambulance and REMS members submit separately and link to the same **Resource Instance** when the match is unambiguous.
3. Resource matching key is Incident + normalized Resource Order Number + Company + Date Assigned. Resource Order Number alone is not sufficient across later rotations.
4. One clear match links the person. No match creates a provisional resource. **Multiple plausible matches produce `Needs Resource Review` and never trigger a silent merge.**
5. Submitted values are append-only and immutable. Admin corrections are stored separately as overrides and become the effective operational values. Clearing an override reverts the displayed value to the submitted one.
6. Resource totals and personnel totals are counted separately. A four-person REMS team is one resource and four people.
7. `Last Work Day = First Work Day + Assignment Length − 1 + Extension Days`. `Demobilization/Travel Start = Last Work Day + 1`. Reassignment is stored as Yes/No plus From and does not change the formula.
8. No file uploads anywhere. No attachments, images, copied email content, or public file links are ever stored. The tracker stores **document status only**; the files live in the incident Fire email.
9. No clinical, patient, treatment, diagnosis, or medication data may be collected or stored.
10. Restricted fields (home address, vehicle plate, emergency contacts, EERA/contract #, medical director contact, supervisor phone) never appear in quick views or the Glide Path.

### Data model

```
Incident        id, name, number, opPeriod, timezone, fireEmail, formUrl, status
Response        id, incidentId, formsResponseId, submittedAt, payload (frozen JSON of all 34 answers)
ResourceInstance id, incidentId, callSign, company, resourceOrderRaw, resourceOrderNormalized,
                 type (Ambo|EMPF|EMTF|REMS|Medical Support Trailer|MEDL/MEDLt|IMS),
                 dateAssigned, state, isProvisional
Person          id, incidentId, responseId, resourceInstanceId|null,
                 submitted { firstName, lastName, position, cert, phone, firstWorkDay,
                             assignmentLength, dateAssigned, isReassignment, from, ... },
                 overrides { division, camp, callSign, firstWorkDay, assignmentLength,
                             extensionDays, operationalStatus, notes },
                 status
DocumentStatus  id, personId, documentType, status, verifier, verifiedAt, notes
AuditEvent      id, entityType, entityId, kind, actor, at, before, after
```

Calculated values (`lastWorkDay`, `dmbStart`, `workdaysRemaining`, `glidePathState`) are **derived, never stored**.

Operational statuses: `Checked In - Needs Assignment`, `Needs Resource Review`, `Enroute`, `Active`, `DMB/Travel`, `Released`, `Cancelled`.

Document statuses: `Not Required`, `Requested`, `Received`, `Verified`, `Rejected`, `Expired`.

Glide Path states, from inclusive workdays remaining:

| Days remaining | State | Hex |
|---|---|---|
| 8 or more | Green | `#3f8f5e` |
| 4–7 | Yellow | `#d1a02a` |
| 2–3 | Red | `#c4452c` |
| 1 | LWD | `#b8461d` |
| 0 | DMB/TVL | `#5b53a3` |
| complete / released / out of range | Gray | `#a09a90` |
| dates missing or invalid | REVIEW | `#e2691f` |

### Screens to build

**1. Roster (default).** Personnel grouped under their resource instance. Each group header shows Call Sign, company, Resource Order #, type, headcount, and resource state. Each person row shows a status dot, name + Forms response id, position + certification, phone, Division/Camp, First Work Day → Last Work Day, a glide-state badge with days remaining, and an open-document count. Filter chips: All / Active / Enroute / Needs Review. Clicking a row opens the detail drawer. Table scrolls horizontally below ~780px of available width; group headers and rows share one minimum width so they scroll together.

**2. Person detail drawer** (fixed right panel, 340px, closes with ×). Three visually distinct zones, in this order:
  - *Submitted — locked.* Dashed dividers, muted labels, no inputs.
  - *Admin fields — editable.* Every input carries a 3px ember left border (`#e2691f`) — this is the only place that treatment appears in the app, and it is how staff know what they may change. Fields: Division, Camp, effective First Work Day, effective Assignment Length, Extension Days.
  - *Calculated.* Tinted panel showing Last Work Day, DMB/Travel start, and Glide Path state, with the formula printed underneath. Recomputes live as admin fields change.
  - *Documents.* One chip per applicable document type; clicking cycles through the six statuses.

**3. Glide Path.** Rolling 14-day grid, one row per person, grouped by resource, with a frozen 260px identity column and 14 day columns. Cells are tinted by that day's glide state; the last work day is marked `LWD` and the demobilization day `DMB`. Today's column is highlighted. Legend in the header, summary totals in the footer (active resources, active personnel, Yellow, Red, LWD/DMB, needs review). **This view must also print landscape, one page wide, legend included, key fields legible.**

**4. Review queue.** One card per ambiguous match. Shows the person, why the match was held (state the actual conflict, e.g. same order number across two companies), and each candidate resource with a match-quality note and a Link button. A "Create provisional resource instead" action is always available. Nothing merges without an explicit decision, and every decision writes an AuditEvent.

**5. Document tracker.** Matrix of people × document types (Contract, Driver's License, NREMT, Med Director letter). Cells are clickable status chips. Verifier and timestamp column. Footer states plainly that no files are stored here. Selecting Narcotics in the capabilities question must create a required Medical Director letter status item.

**6. Mobile check-in preview.** The field-facing Microsoft Form rendered as a 6-section stepper, shown in a phone frame beside the incident QR panel. Sections: Order & identity (Q1–4), Position & qualification (Q5–10), Assignment dates (Q11–18), Travel & vehicle (Q17–21), Home agency (Q22–30), Certification (Q31–34). Restricted fields render greyed with a "Restricted" note rather than a value. Hit targets are never below 44px. The form intro and confirmation both display the incident's Fire email and the document checklist.

Preserve the supplied choice labels verbatim, including the misspellings **"Extrication Equiptment"** and **"Nerv"** — they are in the live form and must not be silently corrected in code.

### Visual system

- Fonts: IBM Plex Sans for UI, IBM Plex Mono for identifiers, dates, counts, and eyebrow labels.
- Background `#f6f2ec`, surfaces `#ffffff`, warm charcoal `#1c1814` for the sidebar/headers, ember accent `#e2691f` with `#b8461d` for hover/emphasis.
- Borders `#e3dbcf`, hairlines `#f4efe6`, muted text `#8b8072`, body text `#3a332b`.
- Radii: 5–8px on controls and chips, 10px on cards.
- Type scale: 23px/600 page titles, 12.5–13px body, 11–11.5px table cells, 9.5–10px uppercase mono eyebrows with .09–.1em tracking.
- Ember is reserved for two things only: the active nav state, and admin-editable affordances. Do not spread it as decoration.
- Status color is the app's only other color source, and it always means glide state or document state — never brand.

### Definition of done

Implement the developer completion contract in section 9 of `approval-rfc.md` as an automated test suite over synthetic data. At minimum:

- One valid response stores once and creates exactly one person record.
- Two ambulance responses with one clear match create one resource and two people.
- Four REMS responses with one clear match create one resource and four people.
- An ambiguous match lands in `Needs Resource Review` and does not merge.
- A later rotation reusing the same Resource Order Number creates a new Resource Instance without altering the prior rotation.
- Admin edits change working views and never the stored response.
- Date math passes for varied lengths, extensions, staggered starts, and reassignment metadata.
- Glide Path returns Green at 8+, Yellow at 4–7, Red at 2–3, LWD at 1, DMB/TVL at 0, REVIEW for invalid dates.
- Resource counts and personnel counts reconcile separately.
- Selecting Narcotics creates a required Medical Director letter item.
- No credential file, image, attachment, or public document link exists anywhere in the app or its logs.
- A load test produces no lost responses, duplicate person rows, or incorrect merges.
- An incident can be closed and a clean new incident created with no old responses, ids, or test data.

### Out of scope

No patient or clinical data. No automatic credential validation, inbox attachment extraction, OCR, or document storage. No automatic ICS-206 publication. No public access beyond submitting the form.

---

## About the design files

`Medical Check-In Ops.dc.html` is a **high-fidelity design reference** built in HTML. Open it in a browser to see intended layout, color, type, spacing, and interaction. It is a prototype with synthetic data and no backend — recreate it in the target codebase's environment rather than shipping it.

`approval-rfc.md` is the approved plain-language contract the design implements. Where the two disagree, the RFC wins on behavior and the HTML wins on appearance.

Synthetic data in the prototype: incident "Bearclaw Creek" (OR-WIF-000412), nine people across five resources, with today pinned to 2026-08-30 so the glide states are visible.
