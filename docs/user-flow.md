# Stage 1 Demo — User Flow (matches the deployed prototype)

Concourse ER Case Management prototype for San Bernardino County RFP HRD127-HR-6548.
All people and data are synthetic. Production: https://concourse-er-demo.vercel.app

## Decisions locked
- Hero story: EEO complaint end-to-end (EEO-2026-0118, Alex Rivera vs. Gary Mills, Public Works Yard 4)
- Case workspace: header + stage stepper + tabs + persistent AI assistant rail
- Intake: one public portal (EN/ES) with a guided chooser → type-specific forms, plus staff-entered manual cases
- Login: persona switcher (no real SSO in stage 1)
- All dates and times are County time (Pacific)

## Personas (switch from the top bar)
| Persona | Role | Can see | Can do |
|---|---|---|---|
| Maria Delgado | EEO Investigator | All EEO cases; ER cases assigned to her | Work cases, draft reports and letters. Can't approve her own report |
| Angela Brooks | EEO Manager | All EEO cases | Everything Maria can, plus approve EEO findings |
| James Okafor | Central Investigations, Sr. Investigator | CI + ER, incl. high-sensitivity; **no** EEO content | Work CI/ER cases; approve ER/CI findings he isn't assigned to |
| Priya Nair | Return-to-Work Specialist | RTW cases + restricted medical tier only | Work RTW cases (no approval step) |
| Dana Whitfield | HR Business Partner (Public Works, Transportation) | ER cases for her departments | Work ER cases |
| Marcus Bell | Deputy Director, Public Works (supervisor) | Corrective actions for his staff; **auto-recused** from the hero case | Add notes and tasks only — read-only otherwise |
| Kevin Tran | IT System Administrator | Admin console + case **metadata only** | Admin settings, AI toggles, access review, audit export |
| Lisa Chen | HR Director | De-identified dashboards; non-EEO case detail | Read-only on cases; approve ER/CI findings; report builder |

## Global layout
- Left nav: Home · Intake queue · Cases · Tasks · Search · Approvals (approvers, with count) · Dashboards · Report builder · RTW (RTW roles) · Admin (admins)
- Top bar: global search, notifications, persona switcher, "Reset demo"
- "Skip to main content" link; keyboard and screen-reader friendly throughout (WCAG 2.1 AA target)
- Every AI output carries an "AI draft" badge until a human accepts it
- Roles that can't change a case see a "Read-only for your role" badge instead of action buttons

## Hero story — scene by scene

### Scene 1 — Public intake portal (no login) · `/report`
1. "What would you like to report?" — three cards → **EEO**, **workplace conduct (ER)**, or **accommodation** form. "Already reported? Check status with your code" link.
2. EN / ES toggle covers every label, error and the banner. Stored values stay in English so staff see one vocabulary.
3. EEO form: anonymous toggle, protected bases, what happened, when (future dates rejected), department/location, people involved, witnesses, files, "I need an accommodation to take part".
4. Submit → reference # + private follow-up code (anonymous), and a demo box showing which queue and reviewers it routed to.

### Scene 1b — Anonymous status and follow-up · `/report/status`
Reporter enters reference # + code → plain-language status stepper (Received → Under review → In progress → Closed), messages the investigator marked **External**, and a box to send more information. Never shows names, findings or other parties. Messages land on the case as "Reporter (follow-up portal)".

### Scene 2 — Triage (Maria) · `/intake`
1. Home: my open cases, due this week, overdue, new intakes, New case button. Every tile links to its list.
2. Intake queue → open a submission → **AI triage** (all editable): case type, category and subtype dropdowns from the County taxonomy, sensitivity, route-to team and assignee, timeliness, HRIS party match.
   - Changing the case type updates route-to and sensitivity; changing route-to never changes the type, so the case manager stays in control.
   - If AI is off or fails, the same form appears blank ("Triage") — never a dead end.
3. **Create case** → workflow starts, tasks auto-generated. If routed to a team the user can't see (e.g. CI), they return to their queue with a "Case CI-… created and routed to …" banner.
4. **Dismiss** requires a reason and can be restored.
5. Phone, walk-in, hotline, email or agency-charge complaints: **Cases → New case** (manual entry, HRIS picker for parties).

### Scene 3 — Investigating (Maria) · EEO-2026-0118
Header: number, type, sensitivity badge, outcome (when closed), stage stepper (check marks + screen-reader status), assignee, case actions.

Tabs:
- **Overview** — key dates, linked cases (link/unlink), external filings (EEOC/CRD/PERB charge #, date, status)
- **Parties** — add from HRIS or by name, remove; adding someone in a party's reporting chain auto-recuses them, and the result is shown
- **Allegations** — add allegations; each has its own finding (shown as "Proposed until the report is approved")
- **Interviews** — schedule (Outlook invite simulated), notes, AI summary
- **Documents** — upload (4 MB/file, versioned), **preview** inline (PDF/images; text shown safely), download, print, **Mark sent** for letters. Uploading as "Medical" puts the file in the medical tier automatically.
- **Tasks** — add with assignee and due date; bulk complete from the Tasks page
- **Notes** — Internal / External (External is visible to the reporter on the status page); authors can edit, history kept
- **Findings** — investigative report versions, comments, submit for approval, Print / PDF
- **Audit** — friendly action names, "Hash chain verified" badge, Export CSV for this case

AI rail (scoped to the case, respects permissions): summarize, interview summary, next steps, similar cases (only ones Maria may see), ask, **draft investigative report**, and **letters** — 8 EEO, 6 ER/CI, 5 RTW templates, in English or Spanish. Accepted letters are saved to Documents and can be marked sent.

### Scene 4 — Approval (Angela) · `/approvals` · demo case EEO-2026-0131
- On Maria's view of EEO-2026-0131, "Advance to Resolution" is **locked**: "Locked until the investigative report is approved (v1 is pending approval)." Closing with a finding is blocked the same way.
- Angela: Home "Pending approvals" tile or Approvals page → Review → **Approve findings** or **Request changes…** (comment required). Approval advances the case past Findings.
- Approvers can never be the report's author or the assigned investigator.
- **Close case…** always asks for an outcome; **Re-open** and **Place on hold** ask for a reason; legal hold asks for confirmation.

### Scene 5 — The walls (persona switching, the proof moment)
- **Kevin (IT Admin)**: case list shows metadata only; no narrative, documents or AI on case content.
- **Marcus (respondent's chain)**: the hero case doesn't exist for him — not in lists, search, dashboards or AI answers. On his own staff's cases he's read-only apart from notes and tasks.
- **Dana (HRBP)**: her ER cases only, no EEO.
- **James (CI)**: documents on EEO cases return "not found".
- **Lisa (HR Director)**: de-identified dashboards; counts under 3 are suppressed and announced as "fewer than 3" to screen readers.

### Scene 6 — Audit and oversight (Angela, then Kevin)
- Case Audit tab: every view, change, AI use, document access and denial; chain-verified badge; CSV export.
- Admin → Audit log (whole system, admin only), Admin → **Access review**: quarterly attestation of privileged access; removals are logged as "Permission change requested" pending HR Director sign-off. Reassignments and party changes log "Access changed" with who gained/lost access.

## Supporting screens (built, shorter in the Loom)
- **Dashboards**: open/closed, aging, by type/department/user, deadlines, overdue, paid administrative leave; every chart has a screen-reader data table
- **Report builder** (`/reports`): group by any of 12 dimensions (type, department, respondent's supervisor, outcome, channel, month, sensitivity, …), filter by type/status/dates → table + chart → **Excel, CSV or PDF**, all audited
- **Search**: filters + natural-language box
- **RTW (Priya)**: 120/180-day modified-duty alerts, FMLA-exhaustion warnings, status timeline (off work → leave of absence → modified duty → IAP → resolution), AI-drafted LOP/IAP letters

## Stage 1: simulated or deferred
Real SSO/MFA · real Outlook/Teams/PeopleSoft (simulated) · visual workflow builder (config read-only) · OCR · e-signature · redaction · retention/purge engine (legal-hold toggle only) · real email delivery of letters ("Mark sent" records it) · multi-tenancy
