import { sql } from "drizzle-orm";
import type { DB } from "./index";
import * as s from "./schema";
import { PERSONAS } from "../personas";
import { audit } from "../audit";
import { DEFAULT_SETTINGS } from "../settings-defaults";
import { isoDay } from "../format";

// All people, cases and events below are fictional demo data.

const DAY = 86_400_000;
const now = () => Date.now();
const ago = (days: number) => new Date(now() - days * DAY);
const dAgo = (days: number) => isoDay(ago(days));
const dAhead = (days: number) => isoDay(new Date(now() + days * DAY));

type Emp = typeof s.employees.$inferInsert;
const E = (
  id: string,
  name: string,
  title: string,
  department: string,
  supervisorId: string | null,
  location: string,
  bargainingUnit: string,
  hireYearsAgo: number,
): Emp => ({ id, name, title, department, supervisorId, location, bargainingUnit, hireDate: dAgo(Math.round(hireYearsAgo * 365)) });

export const EMPLOYEES: Emp[] = [
  // Public Works
  E("E20001", "Helen Ortiz", "Director of Public Works", "Public Works", null, "825 E Third St, San Bernardino", "Management (MGT)", 19),
  E("E20011", "Marcus Bell", "Deputy Director, Operations", "Public Works", "E20001", "825 E Third St, San Bernardino", "Management (MGT)", 14),
  E("E20120", "Robert Kim", "Operations Superintendent", "Public Works", "E20011", "Yard 4 – Fontana", "Supervisory (SUP)", 11),
  E("E20345", "Gary Mills", "Road Maintenance Supervisor", "Public Works", "E20120", "Yard 4 – Fontana", "Supervisory (SUP)", 9),
  E("E20410", "Alex Rivera", "Maintenance & Construction Worker II", "Public Works", "E20345", "Yard 4 – Fontana", "Craft, Labor & Trades (CLT)", 4),
  E("E20411", "Tasha Greene", "Equipment Operator II", "Public Works", "E20345", "Yard 4 – Fontana", "Craft, Labor & Trades (CLT)", 7),
  E("E20412", "Luis Moreno", "Maintenance & Construction Worker I", "Public Works", "E20345", "Yard 4 – Fontana", "Craft, Labor & Trades (CLT)", 2),
  E("E20413", "Jordan Pike", "Maintenance & Construction Worker II", "Public Works", "E20345", "Yard 4 – Fontana", "Craft, Labor & Trades (CLT)", 3),
  E("E20414", "Daniel Ramos", "Maintenance & Construction Worker I", "Public Works", "E20345", "Yard 4 – Fontana", "Craft, Labor & Trades (CLT)", 1),
  E("E20500", "Karen Liu", "Senior Engineer", "Public Works", "E20011", "825 E Third St, San Bernardino", "Professional (PRO)", 8),
  // Transportation
  E("E21001", "Paul Nguyen", "Director of Transportation", "Transportation", null, "825 E Third St, San Bernardino", "Management (MGT)", 16),
  E("E21050", "Sara Patel", "Traffic Operations Supervisor", "Transportation", "E21001", "Victorville Yard", "Supervisory (SUP)", 10),
  E("E21102", "Derek Shaw", "Equipment Operator I", "Transportation", "E21050", "Victorville Yard", "Craft, Labor & Trades (CLT)", 6),
  E("E21103", "Nicole Ford", "Traffic Signal Technician", "Transportation", "E21050", "Victorville Yard", "Craft, Labor & Trades (CLT)", 5),
  // Behavioral Health
  E("E22001", "Ruth Alvarez", "Director of Behavioral Health", "Behavioral Health", null, "303 E Vanderbilt Way, San Bernardino", "Management (MGT)", 21),
  E("E22050", "Monica Hayes", "Clinic Supervisor", "Behavioral Health", "E22001", "Rialto Clinic", "Supervisory (SUP)", 12),
  E("E22101", "Kevin Ross", "Clinical Therapist II", "Behavioral Health", "E22050", "Rialto Clinic", "Professional (PRO)", 5),
  E("E22102", "Ana Lopez", "Office Assistant III", "Behavioral Health", "E22050", "Rialto Clinic", "Clerical (CLE)", 8),
  // Child Support Services
  E("E23001", "Frank Wells", "Director of Child Support Services", "Child Support Services", null, "10417 Mountain View Ave, Loma Linda", "Management (MGT)", 15),
  E("E23050", "Grace Kim", "Child Support Supervisor", "Child Support Services", "E23001", "Loma Linda", "Supervisory (SUP)", 9),
  E("E23101", "Tom Becker", "Child Support Specialist II", "Child Support Services", "E23050", "Loma Linda", "Administrative Services (ADM)", 6),
  E("E23102", "Yolanda Price", "Child Support Specialist II", "Child Support Services", "E23050", "Loma Linda", "Administrative Services (ADM)", 7),
  // Regional Parks
  E("E24001", "Linda Park", "Director of Regional Parks", "Regional Parks", null, "777 E Rialto Ave, San Bernardino", "Management (MGT)", 13),
  E("E24050", "Carlos Ruiz", "Park Ranger Supervisor", "Regional Parks", "E24001", "Glen Helen Regional Park", "Supervisory (SUP)", 10),
  E("E24101", "Emily Stone", "Park Ranger II", "Regional Parks", "E24050", "Glen Helen Regional Park", "Craft, Labor & Trades (CLT)", 4),
  // County Library
  E("E25001", "Nora James", "County Librarian", "County Library", null, "777 E Rialto Ave, San Bernardino", "Management (MGT)", 17),
  E("E25101", "Samir Haddad", "Librarian II", "County Library", "E25001", "Victorville Branch", "Professional (PRO)", 3),
  // Probation
  E("E26001", "Victor Hale", "Chief Probation Officer", "Probation", null, "175 W Fifth St, San Bernardino", "Management (MGT)", 22),
  E("E26050", "Diane Cole", "Supervising Probation Officer", "Probation", "E26001", "Juvenile Hall – San Bernardino", "Supervisory (SUP)", 12),
  E("E26101", "Ray Thompson", "Probation Officer II", "Probation", "E26050", "Juvenile Hall – San Bernardino", "Probation Officers (PRB)", 8),
  E("E26102", "Mia Chen", "Probation Officer I", "Probation", "E26050", "Juvenile Hall – San Bernardino", "Probation Officers (PRB)", 2),
  // Aging & Adult Services
  E("E27001", "Joyce Bennett", "Director of Aging & Adult Services", "Aging & Adult Services", null, "686 E Mill St, San Bernardino", "Management (MGT)", 18),
  E("E27101", "Peter Wu", "Social Worker II", "Aging & Adult Services", "E27001", "Rancho Cucamonga Office", "Professional (PRO)", 9),
  // Human Resources & IT (persona employee records)
  E("E30001", "Lisa Chen", "Director of Human Resources", "Human Resources", null, "175 W Fifth St, San Bernardino", "Management (MGT)", 12),
  E("E30100", "Angela Brooks", "EEO Manager", "Human Resources", "E30001", "175 W Fifth St, San Bernardino", "Management (MGT)", 10),
  E("E30101", "Maria Delgado", "EEO Investigator", "Human Resources", "E30100", "175 W Fifth St, San Bernardino", "Professional (PRO)", 6),
  E("E30201", "James Okafor", "Senior Investigator", "Human Resources", "E30001", "175 W Fifth St, San Bernardino", "Professional (PRO)", 9),
  E("E30301", "Priya Nair", "Return-to-Work Specialist", "Human Resources", "E30001", "175 W Fifth St, San Bernardino", "Professional (PRO)", 5),
  E("E30401", "Dana Whitfield", "HR Business Partner", "Human Resources", "E30001", "175 W Fifth St, San Bernardino", "Professional (PRO)", 7),
  E("E40001", "Kevin Tran", "Systems Administrator", "Innovation & Technology", null, "670 E Gilbert St, San Bernardino", "Professional (PRO)", 6),
];

const empName = (id: string) => EMPLOYEES.find((e) => e.id === id)!.name;

type CaseIn = typeof s.cases.$inferInsert;
type PartyIn = Omit<typeof s.parties.$inferInsert, "caseId">;

type SeedCase = {
  c: CaseIn;
  parties?: PartyIn[];
  allegations?: Omit<typeof s.allegations.$inferInsert, "caseId">[];
  interviews?: Omit<typeof s.interviews.$inferInsert, "caseId">[];
  documents?: Omit<typeof s.documents.$inferInsert, "caseId">[];
  tasks?: Omit<typeof s.tasks.$inferInsert, "caseId">[];
  notes?: Omit<typeof s.notes.$inferInsert, "caseId">[];
  reports?: Omit<typeof s.reports.$inferInsert, "caseId">[];
};

const emp = (role: string, id: string, extra: Partial<PartyIn> = {}): PartyIn => ({ role, employeeId: id, name: empName(id), ...extra });

const base = {
  anonymous: false,
  legalHold: false,
  externalFilings: [],
  linkedCaseIds: [],
  overlapFlags: [],
  rtw: null,
};

export function seedCases(): SeedCase[] {
  return [
    // ───────────── EEO ─────────────
    {
      c: {
        ...base,
        id: "c-0118",
        number: "EEO-2026-0118",
        type: "EEO",
        category: "Harassment",
        subtype: "Sexual orientation",
        title: "Derogatory comments and exclusion from overtime — Yard 4",
        narrative:
          "Complainant reports that since approximately July, his supervisor Gary Mills has repeatedly made derogatory remarks about his sexual orientation in front of the crew during morning briefings, including calling him a slur and joking that he 'wouldn't be able to handle real work.' Complainant also reports that after he objected in August, he was left off the overtime rotation for four consecutive weeks while less-senior crew members were offered overtime. Complainant provided screenshots of text messages from a coworker referencing the comments.",
        status: "Open",
        stage: "Investigation",
        sensitivity: "eeo",
        department: "Public Works",
        assigneeId: "u-maria",
        source: "Email",
        incidentDate: dAgo(52),
        createdAt: ago(41),
        dueDate: dAhead(49),
        linkedCaseIds: ["c-0412", "c-0102"],
      },
      parties: [emp("Complainant", "E20410"), emp("Respondent", "E20345"), emp("Witness", "E20411"), emp("Witness", "E20412")],
      allegations: [
        { category: "Harassment — sexual orientation", description: "Repeated derogatory remarks and a slur during crew briefings (Jul–Sep).", status: "Under investigation" },
        { category: "Retaliation", description: "Removed from overtime rotation for four weeks after objecting to the remarks.", status: "Under investigation" },
      ],
      interviews: [
        {
          partyName: "Alex Rivera",
          partyRole: "Complainant",
          scheduledAt: ago(34),
          status: "Completed",
          notes:
            "Interview conducted in person at HR, 175 W Fifth St. Union rep (CLT) present.\n\nAR states comments began early July after he mentioned his partner during a lunch break. GM made remarks at the 6:30am briefings 'at least once a week'. Specific incident 7/22: GM said, in front of approx. 8 crew members, that AR 'should be on the flower-planting crew' and used a slur. TG and LM were present.\n\nAR raised it with GM directly on 8/14 and said the comments needed to stop. GM said 'it's just yard talk.' From 8/18 to 9/12 AR was not offered overtime. AR says the OT sign-up sheet was removed from the break room in that period and GM assigned OT verbally.\n\nAR provided 6 screenshots of texts from TG ('can't believe what Gary said today', 8/2). AR states he did not report sooner because he was afraid of losing OT and being moved off his crew. He reports stress and difficulty sleeping, and has not sought medical care.\n\nRequested outcome: comments stop, fair OT distribution, no retaliation.",
        },
        {
          partyName: "Tasha Greene",
          partyRole: "Witness",
          scheduledAt: ago(27),
          status: "Completed",
          notes:
            "Phone interview. TG has worked under GM 4 years.\n\nTG confirms she heard GM make 'jokes' about AR at briefings 'more than a few times'. Recalls the 7/22 'flower crew' comment specifically, and says GM used 'a word I won't repeat.' TG confirms she sent the 8/2 texts to AR.\n\nOn overtime: TG says OT has 'always been a little loose' but in August GM assigned it by asking people individually. She received OT twice in that period. She does not know if AR asked for it.\n\nTG asked whether her name would be shared with GM. Advised of the County's anti-retaliation policy.",
        },
        {
          partyName: "Luis Moreno",
          partyRole: "Witness",
          scheduledAt: new Date(now() + 2 * DAY),
          status: "Scheduled",
          notes: null,
        },
        {
          partyName: "Gary Mills",
          partyRole: "Respondent",
          scheduledAt: new Date(now() + 6 * DAY),
          status: "Scheduled",
          notes: null,
        },
      ],
      documents: [
        { name: "Initial complaint email.pdf", kind: "Correspondence", uploadedBy: "u-maria", createdAt: ago(41), content: "Email from A. Rivera to EEO inbox describing the remarks and the overtime change." },
        { name: "Text message screenshots (6).zip", kind: "Evidence", uploadedBy: "u-maria", createdAt: ago(34), content: "Six screenshots of texts from T. Greene, 8/2–8/20." },
        { name: "Overtime roster Aug–Sep (Yard 4).xlsx", kind: "Evidence", uploadedBy: "u-maria", createdAt: ago(30), content: "Overtime roster from Public Works timekeeping. AR: 0 OT shifts 8/18–9/12; crew avg 3.5." },
        { name: "Notice of investigation — respondent.docx", kind: "Correspondence", version: 2, uploadedBy: "u-maria", createdAt: ago(25), content: "Notice to G. Mills of the investigation and the anti-retaliation directive." },
      ],
      tasks: [
        { title: "Jurisdictional & timeliness review", assigneeId: "u-maria", dueDate: dAgo(38), done: true, auto: true },
        { title: "Send acknowledgment to complainant", assigneeId: "u-maria", dueDate: dAgo(39), done: true, auto: true },
        { title: "Interview witness: Luis Moreno", assigneeId: "u-maria", dueDate: dAhead(2) },
        { title: "Interview respondent: Gary Mills", assigneeId: "u-maria", dueDate: dAhead(6) },
        { title: "Request OT sign-up sheets from Public Works", assigneeId: "u-maria", dueDate: dAgo(3) },
        { title: "Bi-weekly status update to complainant", assigneeId: "u-maria", dueDate: dAhead(4), recurring: "Every 2 weeks" },
      ],
      notes: [
        { authorId: "u-maria", body: "Spoke with CI (James Okafor) re: possible overlap with CI-2026-0102 (threat at Yard 4). Coordinating, and keeping EEO content separate.", visibility: "Internal", createdAt: ago(20) },
        { authorId: "u-angela", body: "Prioritize the respondent interview. There's a prior EEO matter with the same respondent (EEO-2025-0412).", visibility: "Internal", createdAt: ago(18) },
      ],
    },
    {
      c: {
        ...base,
        id: "c-0412",
        number: "EEO-2025-0412",
        type: "EEO",
        category: "Harassment",
        subtype: "Sex / gender",
        title: "Inappropriate comments at crew briefings — Yard 4",
        narrative:
          "Former crew member reported that supervisor Gary Mills made demeaning comments about women in the trades during briefings. Investigation found that the comments were made but could not corroborate that they were directed at the complainant. Respondent received coaching and mandatory harassment-prevention training.",
        status: "Closed",
        stage: "Closed",
        sensitivity: "eeo",
        department: "Public Works",
        assigneeId: "u-angela",
        source: "Hotline",
        incidentDate: dAgo(470),
        createdAt: ago(455),
        closedAt: ago(380),
        outcome: "Not sustained — coaching & training issued",
      },
      parties: [{ role: "Complainant", name: "Former employee (D.R.)", anonymous: false, employeeId: "E20414" }, emp("Respondent", "E20345")],
      allegations: [{ category: "Harassment — sex/gender", description: "Demeaning comments about women in the trades during briefings.", status: "Not sustained" }],
    },
    {
      c: {
        ...base,
        id: "c-0124",
        number: "EEO-2026-0124",
        type: "EEO",
        category: "Discrimination",
        subtype: "Disability",
        title: "Denied telework accommodation; alleges disparate treatment",
        narrative:
          "Complainant, a clinical therapist, alleges that his request for a modified schedule and partial telework related to a disability was denied while non-disabled peers were approved for telework. Complainant has also filed with the California Civil Rights Department.",
        status: "Open",
        stage: "Jurisdictional review",
        sensitivity: "eeo",
        department: "Behavioral Health",
        assigneeId: "u-maria",
        source: "Portal",
        incidentDate: dAgo(70),
        createdAt: ago(9),
        dueDate: dAhead(81),
        externalFilings: [{ agency: "CA Civil Rights Department", number: "CRD-202610-24411", filed: dAgo(12), status: "Open — dual-filed with EEOC" }],
      },
      parties: [emp("Complainant", "E22101"), emp("Respondent", "E22050")],
      allegations: [{ category: "Discrimination — disability", description: "Telework/modified-schedule accommodation denied; peers approved.", status: "Under investigation" }],
      tasks: [
        { title: "Jurisdictional & timeliness review", assigneeId: "u-maria", dueDate: dAhead(1), auto: true },
        { title: "Coordinate with RTW on the accommodation record (no medical detail in EEO file)", assigneeId: "u-maria", dueDate: dAhead(5) },
      ],
    },
    {
      c: {
        ...base,
        id: "c-0131",
        number: "EEO-2026-0131",
        type: "EEO",
        category: "Pay equity",
        subtype: "Sex",
        title: "Pay disparity between Child Support Specialists II",
        narrative:
          "Complainant alleges she is paid two steps below a male Child Support Specialist II with less seniority and equivalent duties. Investigation reviewed step placement history, the hiring memos and the duty statements.",
        status: "Open",
        stage: "Findings",
        sensitivity: "eeo",
        department: "Child Support Services",
        assigneeId: "u-maria",
        source: "Email",
        incidentDate: dAgo(120),
        createdAt: ago(88),
        dueDate: dAhead(2),
      },
      parties: [emp("Complainant", "E23102"), emp("Respondent", "E23050"), emp("Witness", "E23101")],
      allegations: [{ category: "Pay equity — sex", description: "Two-step pay gap vs. less-senior male peer with equivalent duties.", status: "Sustained" }],
      reports: [
        {
          version: 1,
          authorId: "u-maria",
          aiAssisted: true,
          status: "Pending approval",
          createdAt: ago(1),
          body:
            "INVESTIGATIVE REPORT — EEO-2026-0131\n\nBACKGROUND\nComplainant (Child Support Specialist II) alleged a two-step pay disparity relative to a male peer in the same classification.\n\nFINDINGS\nThe step placement records show the peer was hired at Step 5 under a 2023 hiring memo citing 'prior experience', which the duty statements and application materials do not support. Complainant was hired at Step 3 with more directly relevant experience.\n\nCONCLUSION\nThe allegation is SUSTAINED. Recommend a step adjustment review by HR Compensation.",
        },
      ],
    },
    {
      c: {
        ...base,
        id: "c-0089",
        number: "EEO-2026-0089",
        type: "EEO",
        category: "Discrimination",
        subtype: "Race",
        title: "Promotional decision — Probation Officer II",
        narrative: "Complainant alleges a promotional decision was based on race. An EEOC charge has been filed and litigation is anticipated.",
        status: "On hold",
        stage: "Investigation",
        holdReason: "Pending litigation — County Counsel directed hold",
        legalHold: true,
        sensitivity: "eeo",
        department: "Probation",
        assigneeId: "u-angela",
        source: "Phone",
        incidentDate: dAgo(160),
        createdAt: ago(140),
        externalFilings: [{ agency: "EEOC", number: "480-2026-01877", filed: dAgo(60), status: "Charge filed — position statement due" }],
      },
      parties: [emp("Complainant", "E26102"), emp("Respondent", "E26050")],
      allegations: [{ category: "Discrimination — race", description: "Non-selection for Probation Officer II promotion.", status: "Under investigation" }],
    },
    {
      c: {
        ...base,
        id: "c-0140",
        number: "EEO-2026-0140",
        type: "EEO",
        category: "Discrimination",
        subtype: "Religion",
        title: "Schedule conflict with religious observance",
        narrative: "Employee reports being told to 'pick a different day' after requesting a schedule change for religious observance.",
        status: "Open",
        stage: "Intake",
        sensitivity: "eeo",
        department: "County Library",
        assigneeId: null,
        source: "Portal",
        incidentDate: dAgo(15),
        createdAt: ago(2),
      },
      parties: [emp("Complainant", "E25101"), emp("Respondent", "E25001")],
    },
    // ───────────── Central Investigations / ER ─────────────
    {
      c: {
        ...base,
        id: "c-0102",
        number: "CI-2026-0102",
        type: "CI",
        category: "Workplace violence",
        title: "Reported verbal threat at Yard 4 — Fontana",
        narrative:
          "Equipment operator reported that a supervisor said a crew member would 'regret it' if he 'kept running his mouth to HR.' Threat assessment completed; no weapon involved. Coordinating with EEO on the related matter.",
        status: "Open",
        stage: "Investigation",
        sensitivity: "high",
        department: "Public Works",
        assigneeId: "u-james",
        source: "Hotline",
        incidentDate: dAgo(24),
        createdAt: ago(22),
        dueDate: dAhead(20),
        linkedCaseIds: ["c-0118"],
      },
      parties: [emp("Complainant", "E20411"), emp("Respondent", "E20345")],
      allegations: [{ category: "Workplace violence — verbal threat", description: "Statement that the crew member would 'regret it'.", status: "Under investigation" }],
      tasks: [{ title: "Threat assessment follow-up with Risk Management", assigneeId: "u-james", dueDate: dAhead(3) }],
    },
    {
      c: {
        ...base,
        id: "c-0110",
        number: "ER-2026-0110",
        type: "ER",
        category: "Misconduct",
        title: "Unauthorized use of County vehicle",
        narrative: "GPS data shows a County vehicle used for personal errands on six occasions. Employee placed on paid administrative leave pending a Skelly meeting.",
        status: "Open",
        stage: "Skelly",
        sensitivity: "standard",
        department: "Transportation",
        assigneeId: "u-dana",
        source: "Manual",
        incidentDate: dAgo(45),
        createdAt: ago(40),
        dueDate: dAhead(8),
        paidLeaveStart: dAgo(14),
      },
      parties: [emp("Respondent", "E21103")],
      allegations: [{ category: "Misuse of County property", description: "Six documented personal trips in a County vehicle.", status: "Sustained" }],
      tasks: [{ title: "Skelly meeting", assigneeId: "u-dana", dueDate: dAhead(5) }],
    },
    {
      c: {
        ...base,
        id: "c-0115",
        number: "ER-2026-0115",
        type: "ER",
        category: "Performance counseling",
        title: "Missed safety checklist entries",
        narrative: "Supervisor-requested performance counseling for repeated missing pre-trip safety checklists.",
        status: "Open",
        stage: "Corrective action",
        sensitivity: "standard",
        department: "Public Works",
        assigneeId: "u-dana",
        source: "Manual",
        createdAt: ago(12),
        dueDate: dAhead(10),
      },
      parties: [emp("Employee", "E20412")],
    },
    {
      c: {
        ...base,
        id: "c-0113",
        number: "ER-2026-0113",
        type: "ER",
        category: "Attendance",
        title: "Pattern of unscheduled absences",
        narrative: "Eleven unscheduled absences in 90 days, eight adjacent to weekends.",
        status: "Open",
        stage: "Assessment",
        sensitivity: "standard",
        department: "Transportation",
        assigneeId: "u-dana",
        source: "Manual",
        createdAt: ago(18),
        dueDate: dAgo(1),
      },
      parties: [emp("Employee", "E21102")],
    },
    {
      c: {
        ...base,
        id: "c-0107",
        number: "CI-2026-0107",
        type: "CI",
        category: "Misconduct",
        title: "Falsified contact logs — juvenile supervision",
        narrative: "Audit found contact logs entered for visits that did not occur. Employee on paid administrative leave.",
        status: "Open",
        stage: "Investigation",
        sensitivity: "high",
        department: "Probation",
        assigneeId: "u-james",
        source: "Manual",
        createdAt: ago(31),
        dueDate: dAhead(14),
        paidLeaveStart: dAgo(29),
      },
      parties: [emp("Respondent", "E26101")],
      allegations: [{ category: "Dishonesty — falsified records", description: "Contact logs for visits that did not occur.", status: "Under investigation" }],
    },
    {
      c: {
        ...base,
        id: "c-0120",
        number: "CI-2026-0120",
        type: "CI",
        category: "Policy violations",
        title: "Records access — privileged review with County Counsel",
        narrative: "Review conducted at the direction of County Counsel in anticipation of litigation.",
        status: "Open",
        stage: "Investigation",
        sensitivity: "privileged",
        department: "Behavioral Health",
        assigneeId: "u-james",
        source: "Manual",
        createdAt: ago(16),
        dueDate: dAhead(30),
        legalHold: true,
      },
      parties: [emp("Respondent", "E22102")],
    },
    {
      c: {
        ...base,
        id: "c-0093",
        number: "ER-2026-0093",
        type: "ER",
        category: "Grievances",
        subtype: "Union matter",
        title: "Grievance — shift bid process",
        narrative: "Union grievance alleging the shift bid did not follow MOU seniority provisions. Resolved at Step 2.",
        status: "Closed",
        stage: "Closed",
        sensitivity: "standard",
        department: "Regional Parks",
        assigneeId: "u-james",
        source: "Email",
        createdAt: ago(75),
        closedAt: ago(30),
        outcome: "Resolved at Step 2 — bid re-run",
      },
      parties: [emp("Complainant", "E24101"), emp("Respondent", "E24050")],
    },
    {
      c: {
        ...base,
        id: "c-0126",
        number: "ER-2026-0126",
        type: "ER",
        category: "Harassment",
        subtype: "Non-protected / bullying",
        title: "Hostile conduct between coworkers",
        narrative: "Two technicians report ongoing conflict, including yelling and exclusion from work assignments.",
        status: "Open",
        stage: "Assessment",
        sensitivity: "standard",
        department: "Transportation",
        assigneeId: "u-dana",
        source: "Phone",
        createdAt: ago(6),
        dueDate: dAhead(24),
      },
      parties: [emp("Complainant", "E21103"), emp("Respondent", "E21102")],
    },
    {
      c: {
        ...base,
        id: "c-0080",
        number: "ER-2026-0080",
        type: "ER",
        category: "Misconduct",
        title: "Discourteous conduct toward clients",
        narrative: "Multiple client complaints were substantiated. A written reprimand was issued and appealed; the appeal was denied.",
        status: "Closed",
        stage: "Closed",
        sensitivity: "standard",
        department: "Aging & Adult Services",
        assigneeId: "u-james",
        source: "Email",
        createdAt: ago(130),
        closedAt: ago(70),
        outcome: "Sustained — written reprimand (appeal denied)",
      },
      parties: [emp("Respondent", "E27101")],
    },
    // ───────────── Return to Work ─────────────
    rtwCase("c-r051", "RTW-2026-0051", "E21102", "Transportation", "Lower back strain — modified duty", true, "WC-26-08812", [
      { status: "Off work", start: dAgo(132), end: dAgo(117), restrictions: "TTD per treating physician" },
      { status: "Temporary modified duty", start: dAgo(116), restrictions: "No lifting >20 lbs; no operating heavy equipment; 6-hr days" },
    ], 96, 480),
    rtwCase("c-r044", "RTW-2026-0044", "E22102", "Behavioral Health", "Wrist tendinitis — modified duty", false, undefined, [
      { status: "Temporary modified duty", start: dAgo(174), restrictions: "Limit keyboarding to 4 hrs/day; ergonomic workstation" },
    ], 40, 480),
    rtwCase("c-r038", "RTW-2026-0038", "E24101", "Regional Parks", "Knee injury — Interactive Accommodation Process", true, "WC-26-04410", [
      { status: "Off work", start: dAgo(240), end: dAgo(210) },
      { status: "Temporary modified duty", start: dAgo(209), end: dAgo(30), restrictions: "No patrol on uneven terrain; desk and visitor-center duty" },
      { status: "IAP", start: dAgo(29), restrictions: "Permanent restrictions per P&S report: no prolonged walking on uneven ground" },
    ], 120, 480),
    rtwCase("c-r060", "RTW-2026-0060", "E26101", "Probation", "Non-occupational leave — FMLA nearing exhaustion", false, undefined, [
      { status: "Leave of absence", start: dAgo(68) },
    ], 448, 480, dAhead(6)),
    {
      ...rtwCase("c-r029", "RTW-2026-0029", "E27101", "Aging & Adult Services", "Hearing accommodation — resolved", false, undefined, [
        { status: "IAP", start: dAgo(150), end: dAgo(120) },
        { status: "Permanent accommodation", start: dAgo(119), end: dAgo(118), restrictions: "Captioned phone; written follow-up for meetings" },
        { status: "Resolved", start: dAgo(118) },
      ], 0, 480),
    },
  ].map((x) => x as SeedCase);
}

function rtwCase(
  id: string,
  number: string,
  employeeId: string,
  department: string,
  title: string,
  occupational: boolean,
  claimNumber: string | undefined,
  periods: s.RtwData["periods"],
  fmlaUsed: number,
  fmlaEntitled: number,
  leaveExpires?: string,
): SeedCase {
  const last = periods[periods.length - 1];
  const resolved = last.status === "Resolved";
  return {
    c: {
      ...base,
      id,
      number,
      type: "RTW",
      category: occupational ? "Occupational injury" : "Non-occupational",
      title,
      narrative: `${empName(employeeId)} — ${title}. ${occupational ? "Workers' compensation claim " + claimNumber + "." : "Non-occupational injury/illness."}`,
      status: resolved ? "Closed" : "Open",
      stage: last.status,
      sensitivity: "medical",
      department,
      assigneeId: "u-priya",
      source: "Supervisor notification",
      createdAt: new Date(periods[0].start),
      closedAt: resolved ? new Date(last.start) : null,
      outcome: resolved ? "Returned to full duty" : null,
      rtw: { periods, occupational, claimNumber, fmlaHoursUsed: fmlaUsed, fmlaHoursEntitled: fmlaEntitled, leaveExpires },
    },
    parties: [emp("Employee", employeeId)],
    documents: [
      { name: "Work status report (physician).pdf", kind: "Medical", medical: true, uploadedBy: "u-priya", createdAt: new Date(periods[0].start), content: "Work restrictions per treating physician." },
      { name: "Modified duty offer letter.docx", kind: "Correspondence", uploadedBy: "u-priya", createdAt: new Date(periods[0].start), content: "Temporary modified duty assignment letter." },
    ],
  };
}

const SEED_INTAKES: (typeof s.intakes.$inferInsert)[] = [
  {
    id: "in-2001",
    reference: "SBC-ER-48213",
    form: "ER",
    language: "en",
    anonymous: false,
    payload: {
      name: "Nicole Ford",
      department: "Transportation",
      what: "My coworker keeps taking credit for my signal timing work in front of our supervisor and has started leaving me off the team email thread.",
      when: dAgo(10),
      people: "Derek Shaw",
      channel: "Third-party hotline",
    },
    status: "New",
    createdAt: ago(1),
  },
  {
    id: "in-2002",
    reference: "SBC-RA-48219",
    form: "Accommodation",
    language: "es",
    anonymous: false,
    payload: {
      name: "Yolanda Price",
      department: "Child Support Services",
      what: "Solicito una silla ergonómica y un horario flexible por una condición médica de la espalda. (Requesting an ergonomic chair and a flexible schedule for a back condition.)",
      when: dAgo(3),
      channel: "Portal",
    },
    status: "New",
    createdAt: ago(0.4),
  },
];

export async function seedIfEmpty(db: DB) {
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from users`)).rows as { n: number }[];
  if (n > 0) return;
  await seed(db);
}

export async function resetAndSeed(db: DB) {
  await db.execute(
    sql`truncate employees, users, cases, parties, allegations, interviews, documents, tasks, notes, ai_drafts, reports, intakes, audit_log, settings, notifications restart identity`,
  );
  await seed(db);
}

async function seed(db: DB) {
  await db.insert(s.employees).values(EMPLOYEES);
  await db.insert(s.users).values(
    PERSONAS.map((p) => ({ id: p.id, name: p.name, title: p.title, role: p.role, employeeId: p.employeeId, departments: p.departments, initials: p.initials })),
  );
  for (const sc of seedCases()) {
    await db.insert(s.cases).values(sc.c);
    const caseId = sc.c.id;
    if (sc.parties?.length) await db.insert(s.parties).values(sc.parties.map((p) => ({ ...p, caseId })));
    if (sc.allegations?.length) await db.insert(s.allegations).values(sc.allegations.map((p) => ({ ...p, caseId })));
    if (sc.interviews?.length) await db.insert(s.interviews).values(sc.interviews.map((p) => ({ ...p, caseId })));
    if (sc.documents?.length) await db.insert(s.documents).values(sc.documents.map((p) => ({ ...p, caseId })));
    if (sc.tasks?.length) await db.insert(s.tasks).values(sc.tasks.map((p) => ({ ...p, caseId })));
    if (sc.notes?.length) await db.insert(s.notes).values(sc.notes.map((p) => ({ ...p, caseId })));
    if (sc.reports?.length) await db.insert(s.reports).values(sc.reports.map((p) => ({ ...p, caseId })));
  }
  await db.insert(s.intakes).values(SEED_INTAKES);
  await db.insert(s.settings).values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })));
  await db.insert(s.notifications).values([
    { userId: "u-maria", text: "Reminder: interview with Luis Moreno in 2 days (EEO-2026-0118)", href: "/cases/c-0118?tab=interviews", createdAt: ago(0.2) },
    { userId: "u-maria", text: "Overdue: Request OT sign-up sheets from Public Works", href: "/cases/c-0118?tab=tasks", createdAt: ago(0.5) },
    { userId: "u-angela", text: "Approval requested: investigative report for EEO-2026-0131", href: "/cases/c-0131?tab=findings", createdAt: ago(1) },
    { userId: "u-priya", text: "RTW-2026-0051 reaches 120 days of modified duty in 4 days. Consider an IAP meeting.", href: "/rtw/c-r051", createdAt: ago(0.3) },
    { userId: "u-dana", text: "Overdue: ER-2026-0113 assessment due yesterday", href: "/cases/c-0113", createdAt: ago(0.1) },
  ]);
  await audit(db, null, "system.seed", null, { note: "Demo data loaded (synthetic)" });
}
