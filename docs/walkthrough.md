# Prototype Walkthrough — How to Use It + Demo Flow

Concourse ER Case Management prototype · SB County RFP HRD127-HR-6548 · synthetic data only

- **Live:** https://concourse-er-demo.vercel.app (public URL, so don't post it widely)
- **Local:** http://localhost:3100 (run `npx next dev -p 3100` from `app/`)

---

## Part 1 — Getting around

### Before you start
1. Open the site. You land on **Home** as whoever was picked last (Maria by default).
2. Click **Reset demo** in the top bar to put every case, intake and approval back to its starting state. Do this before every recording, and after you've been clicking around.
3. The public reporting form is at **/report**. It's outside the staff app: no nav and no login.

### Switching people
The **persona switcher** is in the top bar. Each persona is a real role with real limits, and switching is the main way to show security.

| Persona | Role | Use them to show |
|---|---|---|
| **Maria Delgado** | EEO Investigator | Day-to-day casework, triage, AI, drafting the report |
| **Angela Brooks** | EEO Manager | Approving findings, oversight |
| **James Okafor** | Central Investigations | Can't see any EEO content (documents return "not found") |
| **Priya Nair** | Return to Work | Medical tier, RTW timeline, letters |
| **Dana Whitfield** | HR Business Partner | Department-scoped ER cases only |
| **Marcus Bell** | Deputy Director (supervisor) | **Auto-recused**: the hero case doesn't exist for him |
| **Kevin Tran** | IT Admin | Admin console; case **metadata only** |
| **Lisa Chen** | HR Director | De-identified dashboards, report builder, read-only |

### The left nav
| Item | What's there |
|---|---|
| **Home** | Your tiles (open cases, due this week, overdue, new intakes or approvals) plus your caseload. Every tile is a link. **New case** button. |
| **Intake queue** | New submissions for *your* team. Open one to triage it. Dismissed items are listed at the bottom. |
| **Cases** | Every case you're allowed to see. Filter by type, status and department; **New case**; **Export CSV**. |
| **Tasks** | Overdue / due this week / later. Tick several and click **Mark N done**. |
| **Search** | Filters plus a plain-English box ("open harassment cases in Public Works"). |
| **Approvals** | (Angela, James, Lisa) Reports waiting on you, with a count badge. |
| **Dashboards** | Charts for caseload, aging, types and departments. Leadership sees de-identified counts. |
| **Report builder** | Group cases any of 12 ways, then export to **Excel / CSV / PDF**. |
| **RTW** | (Priya) Return-to-work caseload, 120/180-day alerts, FMLA warnings. |
| **Admin** | (Kevin) AI controls, access explainer, audit log, workflows, users, **access review**, integrations. |

### Inside a case
- **Header:** case number, type, sensitivity badge, stage stepper, assignee, and action buttons (Advance / Close case… / ⋯ menu for reassign, hold, legal hold).
  - If an action is blocked, the button is locked and says why.
  - People who can't change a case see "Read-only for your role".
- **Tabs:**
  - **Overview:** dates, linked cases, EEOC/CRD filings (add here)
  - **Parties:** add from the HR system or by name. Adding someone recuses their management chain automatically.
  - **Allegations:** each allegation has its own finding.
  - **Interviews:** schedule one, take notes, get an AI summary.
  - **Documents:** upload (pick "Medical" for medical files), preview, download, print, Mark sent.
  - **Tasks:** add with an owner and due date.
  - **Notes:** Internal or **External**. External notes appear on the reporter's status page.
  - **Findings:** report versions, comments, submit for approval, Print/PDF.
  - **Audit:** every action, "Hash chain verified", Export CSV.
- **AI rail (right side):**
  - Summarize, next steps, similar cases, ask a question
  - **Draft investigative report**
  - **Letters:** choose a template and English/Español
  - Every result is marked "AI draft" until you accept, edit or discard it.

### Handy test inputs
- **Status lookup:** submit an anonymous report at /report, then use the reference number and code at **/report/status**.
- **Hero case:** **EEO-2026-0118** (Alex Rivera vs. Gary Mills, Public Works Yard 4).
- **Approval case:** **EEO-2026-0131** (pay disparity, report v1 waiting on Angela).
- **Future dates** are rejected everywhere: try one on the report form to show validation.

---

## Part 2 — Demo flow (≈10–12 min)

> Reset the demo first. Have two tabs open: **/report** and the staff app as Maria.

### 1. The front door: public reporting (1.5 min)
1. **/report**, then toggle **Español** and back. *"Every label, error and message is bilingual."*
2. Pick **Discrimination, harassment or retaliation**.
3. Turn on **Submit anonymously**. Choose a basis (e.g. Sexual orientation) and write two sentences of what happened.
4. Set **When** to tomorrow to show the error, then fix it.
5. Submit. Point out the **reference number + private code** and the box showing where it routed.
6. Click **Check status or reply**. Enter the code and show the status tracker and the reply box. *"Anonymous reporters can still talk to the investigator, safely."*

### 2. Triage (Maria) (2 min)
1. Staff tab, **Home** as Maria: tiles and caseload.
2. **Intake queue**: open the report you just submitted.
3. **AI triage** fills in type, category, subtype, sensitivity, team, timeliness and party match. *"Every field is editable. AI suggests, people decide."*
4. Change **Case type** and route-to follows. Change route-to and type stays put. *"Case managers stay in control."*
5. **Create case**. You land in the new case, with workflow and tasks already generated.

### 3. Working a case (Maria, EEO-2026-0118) (3 min)
1. Open **EEO-2026-0118** and walk the header and stage stepper.
2. **Parties**: complainant, respondent with HR data, witnesses. Add a witness from the HR system.
3. **Allegations**: separate findings per allegation.
4. **Documents**: preview a file, then upload one as **Medical** and note it's locked to the medical tier.
5. **Notes**: add an **External** note. *"This one the reporter will see on their status page."*
6. **AI rail**:
   - **Summarize case**
   - **Similar cases** (only ones Maria is allowed to see)
   - **Letters**, then *Notice of investigation to respondent* in **Español**: accept it, it saves to Documents, then **Mark sent**
7. **Draft investigative report**, edit a line, accept, and it becomes report v1.

### 4. Approval (Maria → Angela, EEO-2026-0131) (1.5 min)
1. As Maria, open **EEO-2026-0131**. **Advance to Resolution is locked**: *"Locked until the investigative report is approved."*
2. Try **Close case…** with a finding outcome. It's blocked too.
3. Switch to **Angela**. The Home tile shows **Pending approvals 1**; open **Approvals → Review**.
4. Click **Request changes…** to show a comment is required, then cancel. **Approve findings**: the case moves forward automatically.
5. *"The person who wrote the report, or who is assigned the case, can never approve it."*

### 5. The walls: the security moment (2 min)
Open EEO-2026-0118 (or try to) as each person:
1. **Marcus**: not in lists, search, dashboards or AI. *"He's in the respondent's chain, so he's auto-recused."*
2. **James**: senior investigator, but EEO content is walled off.
3. **Kevin**: sees that the case exists (number, type, dates) but no story, documents or AI.
4. **Lisa**: dashboards show de-identified counts, and small numbers are suppressed.
5. **Priya**: open an RTW case and show the medical tier and the RTW timeline.

### 6. Proof and reporting (1.5 min)
1. Back as **Angela**, on EEO-2026-0118's **Audit** tab: everything you just did is there, including each AI use and each denied access. Point to **Hash chain verified** and **Export CSV**.
2. **Report builder**: group by **Respondent's supervisor**, then **Excel**. *"Ad-hoc reporting without IT."*
3. **Kevin, Admin**:
   - Turn one AI feature off and show triage still works without it.
   - **Access review**: attest it, then show the entry in the audit log.

### Close
*"Intake to closure, bilingual, AI-assisted but human-controlled, with access walls and an audit trail the County can export. Stage 2 adds real SSO, PeopleSoft, Outlook, and the workflow builder."*

---

## Known rough edges (stage 1)
- SSO, PeopleSoft, Outlook/Teams and email delivery are **simulated**. "Mark sent" records the send, but nothing is actually emailed.
- The workflow builder is read-only config. OCR, e-signature and redaction are not built.
- AI answers vary run to run, so rehearse the AI steps before recording.
- The new dialogs and preview/print pages have been tested on the server, not yet clicked through in a browser.
