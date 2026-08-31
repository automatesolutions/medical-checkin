# Approval RFC — Medical Resource Check-In and Glide Path System

APPROVAL RFC

Medical Resource Check-In and Glide Path System

Plain-language approval document and exact developer end-state contract

Status: Ready for approval

Audience: Medical Unit administrator and implementation developer

Current process: Manual Microsoft Forms and Excel administration

Target environment: Existing Microsoft 365 GCC/FireNet environment

Developer tool: Cursor

Approval scope: What the finished system must do; not how the code is written

Decision requested: Approve the operating outcome in this document so the developer can build the system in Cursor. The admin is approving behavior, fields, calculations, privacy rules, and pass/fail results. The developer owns the technical implementation method.


## Approval at a glance

Every person checks in separately from a phone, including every ambulance and REMS team member.

Each response is stored once, preserved unchanged, and linked to a working personnel record.

People who belong to the same ordered resource are grouped together without losing their individual information.

The Medical Unit can add missing Division, Camp, Call Sign, status, dates, extensions, grouping, and document status after arrival.

Last Work Day and demobilization timing calculate automatically from approved assignment rules.

A clean Medical Resources view and one-page Glide Path show current staffing and upcoming departures.

Contracts, licenses, certifications, and narcotics letters remain in the Fire email workflow; the tracker stores status only.

The complete package can be copied for a new incident without old responses or broken links.


### Not part of this approval

No patient, treatment, diagnosis, medication, or clinical record is collected.

No automatic credential validation, inbox attachment extraction, OCR, or document storage is included.

No automatic ICS-206 publication or approval is included.

No specific code architecture is mandated beyond remaining inside the approved Microsoft 365 environment and meeting every test in this document.


## 1. What changes from the current manual process

The existing manual process remains the operational reference for what staff need to see and change. The finished system removes repetitive copying, date calculations, row movement, and duplicate setup work. It does not remove Medical Unit judgment. Staff still review exceptions, confirm team grouping, add unknown assignment details, and verify documents received through the Fire email.

Work area

Current manual process

Approved end state

Arrival check-in

Personnel complete the existing form; the admin then organizes the information manually.

Each person completes one mobile form. The system records the response once and places the person into the working tracker.

Ambulance and REMS teams

The admin recognizes which people belong together by reviewing names, order numbers, and call signs.

Each member still submits separately. Matching responses are grouped under one resource without combining the people into one row.

Spreadsheet updates

The admin copies, rearranges, and corrects spreadsheet rows.

Original responses stay locked. The admin edits only designated working fields such as Division, Camp, Call Sign, status, and extension.

Assignment dates

Last Work Day and demobilization timing are calculated or corrected manually.

The tracker calculates dates consistently from First Work Day, Assignment Length, and Extension.

Documents

Contracts, licenses, certifications, and narcotics letters are checked through the Fire email.

Documents still go to the Fire email. The tracker records only whether each item is requested, received, verified, rejected, expired, or not required.

Daily operating view

Staff filter and rearrange the workbook to understand current coverage and upcoming demobilizations.

A clean Medical Resources view and one-page Glide Path update automatically from the working records.

New incidents

The form and workbook are copied and cleaned manually.

A clean incident package can be duplicated without carrying old responses, links, or formulas into the next incident.


## 2. Approved operating workflow

Incident setup. The incident owner copies the clean package, enters the incident name, Fire document email, timezone, approved lists, owners, and sharing permissions, then generates the incident QR code.

Individual check-in. The respondent scans the QR, confirms the incident name, completes the form for themselves, and receives instructions to send applicable documents to the Fire email.

Automatic capture. The submitted response is stored unchanged. Exactly one working personnel record is created and linked to a matching resource or placed into resource review.

Admin review. Medical Unit staff add missing operational information, correct effective assignment values without deleting the submitted values, confirm resource grouping, and update document status.

Daily use. The Medical Resources view and Glide Path update from the working records. Staff filter by status, Division, Camp, Call Sign, type, company, qualification, and date state.

Incident close and reuse. The owner stops new submissions, confirms that all responses were captured once, archives the restricted tracker, and retains a clean package for the next incident.


## 3. Required end-state components

Mobile check-in form. A no-sign-in Microsoft Form reached through an incident-specific QR code. The incident name, per-person instruction, privacy notice, Fire email, and document checklist are visible.

Locked original responses. An append-only record keeps every submitted value, the Forms response identifier, and submission timestamp. Staff do not edit this record.

Resource roster. One record represents one ordered resource or rotation. It holds the shared Resource Order Number, company, type, Call Sign, Division, Camp, grouping state, and operational status.

Personnel roster. One record represents one person and contains the exact questionnaire data, assignment values, calculated dates, operational overrides, and link to the resource.

Document-status tracker. One status record exists for each applicable person/document type. It stores status, verifier, verification timestamp, and restricted notes only.

Medical Resources view. A clean urgent-use list shows only the minimum fields needed at a glance, including Call Sign, person, Resource Order Number, qualification, location, and phone.

Glide Path. A one-page, filterable rolling date view shows one row per person, grouped by resource, with separate resource and personnel counts.

Configuration and reuse package. Incident settings, approved choices, company/directory defaults, QR procedure, validation checks, and a one-page operator guide are included.


## 4. Non-negotiable business rules

One form response equals one person. A team submission must never create several people.

Ambulance and REMS members submit separately, then link to the same Resource Instance when the match is unambiguous.

The candidate resource match uses Incident, normalized Resource Order Number, Company, and Date Assigned. Resource Order Number alone is not enough across later rotations.

One clear active match links the person. No match creates a provisional resource. Multiple plausible matches produce Needs Resource Review and never trigger a silent merge.

Original submitted values remain unchanged. Admin corrections are stored separately and become the effective operational values.

Resource totals and personnel totals remain separate. A four-person REMS team counts as one resource and four people.

Division, Camp, Call Sign, Extension, effective dates, grouping, document status, and operational status can be added after check-in.

Sensitive information does not appear in the Medical Resources quick view or Glide Path unless specifically approved for operational need.

Files are not uploaded through the anonymous form and are not stored in Excel. Only document status is stored in the tracker.

The system cannot collect clinical or patient data.

Date calculation: Last Work Day = First Work Day + Assignment Length - 1 + Extension Days. Demobilization/Travel Start = the next day. Reassignment is stored as Yes/No plus From and does not change the formula by itself.


### Operational statuses

Status

Meaning

Checked In - Needs Assignment

Submission received; one or more operational fields still need admin entry.

Needs Resource Review

The system cannot safely determine which resource the person belongs to.

Enroute

Resource/person is traveling to the incident.

Active

Resource/person is available or assigned on the incident.

DMB/Travel

Last Work Day is complete and demobilization/travel has started.

Released

Assignment is complete.

Cancelled

Resource/person will not be active on the incident.


## 5. Exact form contract

The developer must reproduce and map all 34 questions below. Each submission is for one individual. The existing form remains authoritative for required versus optional settings unless this document provides a conditional rule. Supplied labels must remain unchanged unless the admin corrects them during approval.

Label confirmation: The supplied choices include 'Extrication Equiptment' and 'Nerv'. Preserve them until the admin approves corrected wording; do not silently rename them in code.

#

Form field

Required behavior / allowed values

1

Resource Order # - O or E #

Text. Preserve the original value; also normalize it for grouping.

2

Email - YOUR EMAIL

Email entered by the respondent. Do not rely on automatic identity collection.

3

First Name

Text.

4

Last Name

Text.

5

Position

Ambo; EMPF; EMTF; REMS; Medical Support Trailer; MEDL/MEDLt; IMS.

6

Are you a trainee in this position?

Yes or No.

7

Is this your first assignment in this position?

Yes or No.

8

Are you currently Arduous qualified?

Yes or No.

9

Experience/Proficiency - check all that apply

Line Medic/EMT; medical support of an aircraft (on or off fireline); SAR; Camp medical experience; Spike Camp medical experience; Short Haul; Portable Radio experience; Avenza/Field maps/Maps.

10

Capabilities and Preparedness - check all that apply

ALS; BLS; Spike; Hiking in tough terrain; Extrication Equiptment; Reach and Treat; Technical Rescue; Narcotics. Selecting Narcotics requires the medical-director letter.

11

Phone #

Phone text in the approved display format.

12

Date assigned to incident

Date value.

13

Is this a reassignment?

Yes or No. This answer does not alter calculations by itself.

14

From?

Text. Show and require when reassignment is Yes.

15

First work day

Date value. Admin may enter an operational correction without changing the submitted value.

16

Length of Assignment

Positive whole number of assignment days.

17

Travel time home

Duration or text using the admin-approved format.

18

Flight required?

Yes or No.

19

Type of vehicle

Agency; Rental; POV; Nerv. Preserve the current choice unless the admin corrects the label before release.

20

4X4?

Yes or No.

21

Vehicle License #

Text. Restricted from quick views.

22

Company Name

Text or approved company list.

23

Home Agency Street Address

Text. Restricted.

24

City

Text. Restricted.

25

State

State/territory text or approved list. Restricted.

26

Zip

Text so leading zeros are preserved. Restricted.

#

Form field

Required behavior / allowed values

27

Supervisor phone number

Phone text. Restricted.

28

Emergency contact name

Text. Highly restricted.

29

Emergency contact #

Phone text. Highly restricted.

30

EERA #, Contract #

Text. Restricted contractual identifier; not a document attachment.

31

Other ICS Qualifications

Text.

32

Medical Certification

EMT-B; EMT-I; EMT-P; RN; Other.

33

Medical Director NAME

Text. Restricted.

34

Medical Director phone number

Phone text. Restricted.


## 6. Admin editing and audit behavior

The working tracker must make the difference between submitted, admin-entered, and calculated information obvious. Editable cells are visually distinct. Raw and calculated cells are protected. Clearing an admin override returns the displayed value to the original submitted value.

Admin-editable fields: Call Sign, Division, Camp/Location, operational status, Extension Days, effective First Work Day, effective Assignment Length, resource grouping, document status, verifier, and internal operational notes.

Submitted values: retained exactly as received and always traceable to the Forms response identifier.

Calculated values: Last Work Day, Demobilization/Travel Start, workdays remaining, Glide Path state, and dashboard counts.

Audit behavior: automated intake events, failures, duplicate blocks, resource-review decisions, and document-status changes remain traceable to the person and resource involved.

Internal notes: may contain operational context only; no clinical or patient information is allowed.


## 7. Dashboard and Glide Path end state

One row per person, grouped and filterable by Resource Instance and Call Sign.

Frozen identifying columns for status, Division, Camp, Call Sign, Resource Order Number, person, qualification, phone, company, First Work Day, Extension, and Last Work Day.

Summary totals for Active Resources, Active Personnel, Enroute, LWD, DMB/TVL, Red, Yellow, and Needs Review.

Filters for status, Division, Camp, Call Sign, resource type, company, qualification, First Work Day, Last Work Day, and Glide Path state.

Landscape output that fits one page wide, keeps key fields legible, and displays the legend.

Glide Path state

Meaning

Green

8 or more inclusive workdays remain

Yellow

4-7 inclusive workdays remain

Red

2-3 inclusive workdays remain

LWD

1 inclusive workday remains - Last Work Day

DMB/TVL

0 inclusive workdays remain - demobilization/travel starts

Gray/blank

Assignment is complete, released, or outside the active range

REVIEW

Date information is missing or invalid


## 8. Document handling and privacy

The form is public only for creating a response. Respondents cannot see, search, edit, or export any response. The workbook is restricted to approved Microsoft 365 users. The QR contains only the Forms link.

The form introduction and submission confirmation display the configured Fire email.

The instructions list Contract or Agreement, Driver's License, NREMT, State license, and Letter from Medical Director for narcotics.

Selecting Narcotics makes the medical-director letter required.

Allowed document statuses are Not Required, Requested, Received, Verified, Rejected, and Expired.

The tracker stores document status, verifier, verification timestamp, and restricted notes only. It stores no attachments, document images, copied email contents, or public file links.

Emergency contacts, home address, vehicle plate, EERA/contract identifier, medical certification, qualification/capability responses, and credential status are excluded from quick views.

Phone, email, supervisor, medical-director, and other personal contact fields are restricted by role.


## 9. Developer completion contract

The developer may choose the code structure in Cursor. The implementation is complete only when the following results are demonstrated with synthetic data in the approved Microsoft 365 environment.

The QR opens the correct incident form on a current mobile browser and shows the incident name before entry.

A person without a Microsoft or FireNet account can submit, while public users cannot view any response.

All 34 questions, choices, conditional behavior, and document instructions are present and mapped.

One valid response is stored once and creates exactly one working personnel record.

Two separate ambulance-member responses with one clear match create one resource and two personnel records.

Four separate REMS-member responses with one clear match create one resource and four personnel records.

An ambiguous resource match is marked Needs Resource Review and is not silently merged.

A later rotation using the same Resource Order Number receives a new Resource Instance without changing the prior rotation.

Admin changes update the working views without changing the original form response.

Last Work Day and Demobilization/Travel Start pass tests for different assignment lengths, extensions, staggered starts, and reassignment metadata.

The Glide Path displays Green at 8+, Yellow at 4-7, Red at 2-3, LWD at 1, DMB/TVL at 0, and REVIEW for invalid dates.

Resource counts and personnel counts reconcile separately to the underlying records.

Selecting Narcotics creates a required medical-director-letter status item.

No credential file, license image, copied attachment, or public document link exists in the form, workbook, views, or logs.

Core workbook areas contain no broken formulas, external links, hard-coded source-row dependencies, or negative extension values.

A submission load test produces no lost responses, duplicate personnel rows, incorrect resource merges, or incomplete document checklists.

The incident can be closed and a clean new incident package can be created without old responses, identifiers, links, or test data.

A basic spreadsheet user can operate the tracker, filter the views, update approved fields, and use the operator guide without editing formulas or mappings.


### Required handoff package

Configured mobile form and incident QR package.

Restricted master tracker with original responses, resource roster, personnel roster, document-status tracking, quick view, and Glide Path.

Working automation or code bindings with duplicate prevention, exception handling, reconciliation, and audit records.

Clean reusable incident template with no production or test responses.

Synthetic test evidence showing every completion test passed.

One-page operator guide covering incident setup, admin updates, document statuses, incident close, and reuse.


## 10. Approval record

Approval meaning: Approval authorizes the developer to build against this end state. It does not authorize clinical data collection, automatic document validation, broader incident medical-plan automation, or any unlisted public access.

Approver name

Approver role

Decision

Approved as written / Approved with corrections / Not approved

Required corrections


### Source basis

This approval contract reconciles the following source material:

TEAM 12 Medical Check In Form and its instruction that every individual checks in separately.

sample workbook.xlsx.

Glidepath blank.xlsx.

The approved QR check-in, spreadsheet automation, dashboard, calculation, editing, reuse, and testing requirements.

Microsoft Forms reference: File-upload questions require signed-in organizational respondents
