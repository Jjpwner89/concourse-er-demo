import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  serial,
} from "drizzle-orm/pg-core";

/** Mock HRIS (PeopleSoft/Oracle) employee records, incl. reporting chain. */
export const employees = pgTable("employees", {
  id: text("id").primaryKey(), // employee number e.g. E10432
  name: text("name").notNull(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  supervisorId: text("supervisor_id"),
  location: text("location").notNull(),
  status: text("status").notNull().default("Active"),
  hireDate: date("hire_date").notNull(),
  bargainingUnit: text("bargaining_unit").notNull(),
});

/** App users (demo personas). */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  role: text("role").notNull(), // see lib/personas.ts Role
  employeeId: text("employee_id"), // link into HRIS for reporting-chain recusal
  departments: jsonb("departments").$type<string[]>().notNull().default([]),
  initials: text("initials").notNull(),
});

export type CaseType = "EEO" | "ER" | "CI" | "RTW";
export type Sensitivity = "standard" | "high" | "eeo" | "medical" | "privileged";

export const cases = pgTable("cases", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  type: text("type").$type<CaseType>().notNull(),
  category: text("category").notNull(), // Harassment, Misconduct, Modified duty...
  subtype: text("subtype"),
  title: text("title").notNull(),
  narrative: text("narrative").notNull(),
  status: text("status").notNull(), // Open | On hold | Closed
  stage: text("stage").notNull(),
  sensitivity: text("sensitivity").$type<Sensitivity>().notNull(),
  department: text("department").notNull(),
  assigneeId: text("assignee_id"),
  source: text("source").notNull(), // Portal, Email, Phone, Hotline, Manual
  anonymous: boolean("anonymous").notNull().default(false),
  incidentDate: date("incident_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  dueDate: date("due_date"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  outcome: text("outcome"),
  holdReason: text("hold_reason"),
  legalHold: boolean("legal_hold").notNull().default(false),
  paidLeaveStart: date("paid_leave_start"),
  paidLeaveEnd: date("paid_leave_end"),
  externalFilings: jsonb("external_filings")
    .$type<{ agency: string; number: string; filed: string; status: string }[]>()
    .notNull()
    .default([]),
  linkedCaseIds: jsonb("linked_case_ids").$type<string[]>().notNull().default([]),
  overlapFlags: jsonb("overlap_flags").$type<string[]>().notNull().default([]),
  // RTW-specific
  rtw: jsonb("rtw").$type<RtwData | null>(),
});

export type RtwData = {
  periods: {
    status: "Off work" | "Temporary modified duty" | "IAP" | "Permanent accommodation" | "Resolved" | "Leave of absence";
    start: string;
    end?: string;
    restrictions?: string;
  }[];
  occupational: boolean;
  claimNumber?: string;
  fmlaHoursUsed: number;
  fmlaHoursEntitled: number;
  leaveExpires?: string;
};

export const parties = pgTable("parties", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  role: text("role").notNull(), // Complainant | Respondent | Witness | Employee
  employeeId: text("employee_id"),
  name: text("name").notNull(),
  anonymous: boolean("anonymous").notNull().default(false),
  notes: text("notes"),
});

export const allegations = pgTable("allegations", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull(), // Under investigation | Sustained | Not sustained | Inconclusive
});

export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  partyName: text("party_name").notNull(),
  partyRole: text("party_role").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  status: text("status").notNull(), // Scheduled | Completed
  notes: text("notes"),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // Evidence | Statement | Correspondence | Report | Medical
  version: integer("version").notNull().default(1),
  medical: boolean("medical").notNull().default(false),
  content: text("content"),
  /** Uploaded file bytes (base64) for in-browser preview/download. Prototype storage; production uses encrypted blob storage. */
  mime: text("mime"),
  size: integer("size"),
  data: text("data"),
  /** Correspondence tracking: when and to whom a letter was sent. */
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentTo: text("sent_to"),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  title: text("title").notNull(),
  assigneeId: text("assignee_id"),
  dueDate: date("due_date"),
  done: boolean("done").notNull().default(false),
  recurring: text("recurring"),
  auto: boolean("auto").notNull().default(false),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  authorId: text("author_id").notNull(),
  body: text("body").notNull(),
  visibility: text("visibility").notNull().default("Internal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  history: jsonb("history").$type<{ body: string; at: string }[]>().notNull().default([]),
});

/** Every AI output is stored as a draft until a human accepts/edits/discards it. */
export const aiDrafts = pgTable("ai_drafts", {
  id: serial("id").primaryKey(),
  caseId: text("case_id"),
  feature: text("feature").notNull(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("Draft"), // Draft | Accepted | Edited & accepted | Discarded
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  live: boolean("live").notNull().default(false), // true = produced by Claude, false = offline demo text
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  caseId: text("case_id").notNull(),
  version: integer("version").notNull(),
  body: text("body").notNull(),
  authorId: text("author_id").notNull(),
  aiAssisted: boolean("ai_assisted").notNull().default(false),
  status: text("status").notNull(), // Draft | Pending approval | Approved | Changes requested
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  comments: jsonb("comments")
    .$type<{ authorId: string; body: string; at: string }[]>()
    .notNull()
    .default([]),
});

export const intakes = pgTable("intakes", {
  id: text("id").primaryKey(),
  reference: text("reference").notNull(),
  form: text("form").notNull(), // EEO | ER | Accommodation
  language: text("language").notNull().default("en"),
  anonymous: boolean("anonymous").notNull().default(false),
  followUpCode: text("follow_up_code"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("New"), // New | Case created | Dismissed
  caseId: text("case_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

/** Append-only, hash-chained audit log. */
export const auditLog = pgTable("audit_log", {
  seq: serial("seq").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull(),
  userId: text("user_id"),
  action: text("action").notNull(),
  caseId: text("case_id"),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
  href: text("href"),
  read: boolean("read").notNull().default(false),
  channel: text("channel").notNull().default("In-app"), // In-app | Teams | Outlook
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
