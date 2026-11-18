// Case taxonomy and routing defaults used by triage. In production these are admin-configurable
// (Administration → Workflows); for the prototype they live here as a single source of truth.
import type { CaseType } from "@/lib/db/schema";

type TriageSensitivity = "standard" | "high" | "eeo" | "medical";

const BASES = ["Race", "Sex / gender", "Sexual orientation", "Gender identity", "Religion", "Disability", "Age", "National origin", "Pregnancy", "Other protected basis"];

export const TAXONOMY: Record<CaseType, Record<string, string[]>> = {
  EEO: {
    Harassment: BASES,
    Discrimination: BASES,
    "Sexual harassment": ["Hostile environment", "Quid pro quo"],
    Retaliation: ["Protected activity", "Participation in investigation", "Whistleblower"],
    "Pay equity": ["Sex", "Race", "Other protected basis"],
    "Failure to accommodate": ["Disability", "Religion", "Pregnancy"],
  },
  ER: {
    Misconduct: ["Misuse of County property", "Insubordination", "Unprofessional conduct", "Dishonesty", "Other"],
    "Performance counseling": ["Quality of work", "Productivity", "Conduct expectations"],
    Attendance: ["Unexcused absence", "Tardiness", "Leave abuse"],
    "Policy violations": ["Timekeeping", "Safety", "Social media", "Technology use", "Other"],
    Grievances: ["Union matter", "Non-represented"],
    Harassment: ["Non-protected / bullying"],
    "Interpersonal conflict": ["Coworker", "Supervisor"],
  },
  CI: {
    "Workplace violence": ["Verbal threat", "Physical altercation", "Weapons", "Stalking / intimidation"],
    Misconduct: ["Dishonesty — falsified records", "Theft", "Fraud", "Abuse of authority"],
    "Serious policy violation": ["Confidential data breach", "Conflict of interest", "Other"],
    "Criminal conduct referral": ["Law enforcement referral review"],
  },
  RTW: {
    "Accommodation request": ["Modified duty", "Schedule change", "Equipment", "Telework", "Leave as accommodation"],
    "Occupational injury": ["Temporary modified duty", "Permanent restrictions"],
    "Non-occupational": ["Temporary modified duty", "Permanent restrictions"],
    "Leave of absence": ["FMLA / CFRA", "Extended medical leave"],
  },
};

export const TEAMS = ["EEO", "HR Business Partner", "Central Investigations", "Return to Work"] as const;
export type Team = (typeof TEAMS)[number];

/** Defaults applied when a case manager picks a case type. Routing never changes the case type. */
export const TYPE_DEFAULTS: Record<CaseType, { team: Team; sensitivity: TriageSensitivity }> = {
  EEO: { team: "EEO", sensitivity: "eeo" },
  ER: { team: "HR Business Partner", sensitivity: "standard" },
  CI: { team: "Central Investigations", sensitivity: "high" },
  RTW: { team: "Return to Work", sensitivity: "medical" },
};

export function teamForRole(role: string): Team | null {
  if (role.startsWith("eeo")) return "EEO";
  if (role === "hrbp") return "HR Business Partner";
  if (role === "ci_investigator") return "Central Investigations";
  if (role === "rtw_specialist") return "Return to Work";
  return null;
}

/** Snap a free-text team (e.g. from the AI) onto a known team. */
export function normalizeTeam(t: string, type: CaseType): Team {
  const l = t.toLowerCase();
  return TEAMS.find((x) => x.toLowerCase() === l) ?? (l.includes("invest") ? "Central Investigations" : l.includes("return") || l.includes("rtw") ? "Return to Work" : l.includes("eeo") ? "EEO" : l.includes("partner") || l.includes("hrbp") ? "HR Business Partner" : TYPE_DEFAULTS[type].team);
}

export function taxonomyPrompt() {
  return (Object.keys(TAXONOMY) as CaseType[])
    .map((t) => `${t}: ${Object.entries(TAXONOMY[t]).map(([c, subs]) => `${c} [${subs.join(", ")}]`).join("; ")}`)
    .join("\n");
}

/** Closure outcomes. Outcomes that state a finding require an approved investigative report. */
export const OUTCOMES: Record<CaseType, { label: string; findings: boolean }[]> = {
  EEO: [
    { label: "Sustained — corrective action taken", findings: true },
    { label: "Not sustained", findings: true },
    { label: "Inconclusive", findings: true },
    { label: "Resolved through mediation / ADR", findings: false },
    { label: "Withdrawn by complainant", findings: false },
    { label: "Administrative closure — no jurisdiction", findings: false },
    { label: "Referred to external agency (EEOC / CRD)", findings: false },
  ],
  ER: [
    { label: "Sustained — discipline issued", findings: true },
    { label: "Sustained — counseling / coaching", findings: true },
    { label: "Not sustained", findings: true },
    { label: "Inconclusive", findings: true },
    { label: "Resolved informally", findings: false },
    { label: "Administrative closure", findings: false },
    { label: "Employee separated before conclusion", findings: false },
  ],
  CI: [
    { label: "Sustained — discipline issued", findings: true },
    { label: "Sustained — referred to law enforcement", findings: true },
    { label: "Not sustained", findings: true },
    { label: "Inconclusive", findings: true },
    { label: "Administrative closure", findings: false },
    { label: "Employee separated before conclusion", findings: false },
  ],
  RTW: [
    { label: "Returned to full duty", findings: false },
    { label: "Permanent accommodation in place", findings: false },
    { label: "Reassigned to a vacant position", findings: false },
    { label: "Medical separation (after Leave Options Process)", findings: false },
    { label: "Request withdrawn", findings: false },
  ],
};

export const INTAKE_CHANNELS = ["Phone", "Email", "Walk-in", "Third-party hotline", "Manager referral", "Agency charge (EEOC / CRD)"];

export const PARTY_ROLES = ["Complainant", "Respondent", "Witness", "Employee"] as const;

export const FINDINGS = ["Under investigation", "Sustained", "Not sustained", "Inconclusive", "Withdrawn"] as const;

export const FILING_AGENCIES = ["EEOC", "CRD (California Civil Rights Dept.)", "PERB", "Civil Service Commission", "Superior Court"];

/** Letter and notice templates by case type (AI drafts them from the case record). */
export const LETTERS: Record<CaseType, string[]> = {
  EEO: [
    "Acknowledgment of complaint",
    "Notice of investigation to respondent",
    "Witness interview request",
    "Mediation / ADR invitation",
    "Determination letter to complainant",
    "Determination letter to respondent",
    "Right-to-sue information notice",
    "Case closure notice",
  ],
  ER: [
    "Notice of investigation",
    "Interview notice (with Weingarten rights)",
    "Notice of paid administrative leave",
    "Skelly notice (proposed discipline)",
    "Final notice of discipline",
    "Case closure memo",
  ],
  CI: [
    "Notice of investigation",
    "Interview notice (with Weingarten rights)",
    "Notice of paid administrative leave",
    "Skelly notice (proposed discipline)",
    "Final notice of discipline",
    "Case closure memo",
  ],
  RTW: [
    "Leave Options Process (LOP) letter",
    "IAP meeting invitation",
    "Temporary modified duty memo",
    "Interactive process summary",
    "Accommodation approval letter",
  ],
};
