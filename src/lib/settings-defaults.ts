export const AI_FEATURES = {
  triage: "Intake triage & routing suggestions",
  summarize: "Case summaries",
  interview_summary: "Interview & document summaries",
  next_steps: "Suggested next steps",
  similar_cases: "Related & similar case matching",
  ask: "Natural-language Q&A and search",
  draft_report: "Investigative report drafting",
  letters: "Letter & memo drafting (LOP, IAP, notices)",
} as const;

export type AiFeature = keyof typeof AI_FEATURES;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  ai_enabled: true,
  ai_features: Object.fromEntries(Object.keys(AI_FEATURES).map((k) => [k, true])),
  retention: [
    { type: "EEO", years: 7, basis: "EEOC 29 CFR 1602.14 / CA Gov. Code 12946 — longer of 4 years after closure or the end of litigation; County schedule 7 yrs" },
    { type: "ER", years: 5, basis: "County records schedule — personnel investigations" },
    { type: "CI", years: 5, basis: "County records schedule — investigations" },
    { type: "RTW", years: 5, basis: "ADA/FEHA medical confidentiality; stored separately from personnel file" },
  ],
};

/** Configurable workflow definitions (shown read-only in Admin for stage 1). */
export const WORKFLOWS: Record<string, { stages: string[]; rules: string[] }> = {
  EEO: {
    stages: ["Intake", "Jurisdictional review", "Assignment", "Investigation", "Findings", "Resolution", "Closed"],
    rules: [
      "Route EEO-category intakes to the EEO queue; notify the EEO Manager",
      "On create: tasks for timeliness review (2 days) and complainant acknowledgment (1 day)",
      "Track EEOC 300-day and CRD 3-year filing windows from the incident date",
      "Internal target: investigation complete within 90 days of intake; escalate to EEO Manager at day 75",
      "Findings require EEO Manager approval before finalization",
      "Threat or violence language → flag for Central Investigations coordination (no EEO content shared)",
    ],
  },
  ER: {
    stages: ["Intake", "Assessment", "Investigation", "Findings", "Corrective action", "Skelly", "Appeal", "Closed"],
    rules: [
      "Route by department to the assigned HR Business Partner",
      "Paid administrative leave > 30 days → notify HR leadership",
      "Inactive 60 days → notify assignee; 90 days → auto-close with notice",
    ],
  },
  CI: {
    stages: ["Intake", "Assessment", "Investigation", "Findings", "Corrective action", "Skelly", "Appeal", "Closed"],
    rules: ["Workplace violence → same-day threat assessment task", "High-sensitivity cases visible to senior investigators only"],
  },
  RTW: {
    stages: ["Intake", "Off work", "Leave of absence", "Temporary modified duty", "IAP", "Permanent accommodation", "Resolved"],
    rules: [
      "Modified duty at 120 days → alert the RTW specialist to consider an IAP meeting",
      "Modified duty at 180 days → escalate to the RTW supervisor",
      "FMLA ≥ 90% used → start the Leave Options Process (LOP) letter",
    ],
  },
};
