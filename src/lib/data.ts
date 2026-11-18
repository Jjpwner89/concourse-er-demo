import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, type DB } from "./db";
import * as s from "./db/schema";
import { caseAccess, canApprove, canContribute, canManage, canSeeMedicalDocs, type Access, type Decision } from "./policy";
import { PERSONAS, type Persona } from "./personas";
import { audit } from "./audit";

export type CaseRow = typeof s.cases.$inferSelect;
export type Employee = typeof s.employees.$inferSelect;
export type Party = typeof s.parties.$inferSelect;

export type VisibleCase = CaseRow & {
  access: Access;
  decision: Decision;
  parties: Party[];
};

async function loadUniverse(db: DB) {
  const [allCases, allParties, emps] = await Promise.all([
    db.select().from(s.cases).orderBy(desc(s.cases.createdAt)),
    db.select().from(s.parties),
    db.select().from(s.employees),
  ]);
  const supervisorOf = new Map(emps.map((e) => [e.id, e.supervisorId]));
  const partiesByCase = new Map<string, Party[]>();
  for (const p of allParties) {
    const arr = partiesByCase.get(p.caseId) ?? [];
    arr.push(p);
    partiesByCase.set(p.caseId, arr);
  }
  return { allCases, partiesByCase, supervisorOf, emps };
}

function decide(user: Persona, c: CaseRow, parties: Party[], supervisorOf: Map<string, string | null>) {
  const partyEmployeeIds = parties
    .filter((p) => p.employeeId && p.role !== "Witness")
    .map((p) => p.employeeId!) as string[];
  // Witnesses are also excluded from seeing the case itself.
  const witnessIds = parties.filter((p) => p.role === "Witness" && p.employeeId).map((p) => p.employeeId!);
  if (user.employeeId && witnessIds.includes(user.employeeId)) {
    return { access: "none", reason: "Recused: user is a witness" } as Decision;
  }
  return caseAccess(user, c, { partyEmployeeIds, supervisorOf });
}

/** All cases this user may know exist (full or metadata). Single choke point for lists/search/dashboards/AI. */
export async function visibleCases(user: Persona): Promise<VisibleCase[]> {
  const db = await getDb();
  const u = await loadUniverse(db);
  const out: VisibleCase[] = [];
  for (const c of u.allCases) {
    const parties = u.partiesByCase.get(c.id) ?? [];
    const decision = decide(user, c, parties, u.supervisorOf);
    if (decision.access === "none") continue;
    out.push({ ...c, access: decision.access, decision, parties: decision.access === "full" ? parties : [] });
  }
  return out;
}

/** Redacts content fields for metadata-only access. */
export function redact(c: VisibleCase): VisibleCase {
  if (c.access === "full") return c;
  return {
    ...c,
    title: "Restricted",
    narrative: "",
    category: c.type === "EEO" ? "EEO matter" : c.type === "RTW" ? "Accommodation matter" : c.category,
    subtype: null,
    outcome: null,
    holdReason: c.holdReason ? "On hold" : null,
    externalFilings: [],
    overlapFlags: [],
    linkedCaseIds: [],
    rtw: null,
    parties: [],
  };
}

export async function getCaseFor(user: Persona, caseId: string) {
  const db = await getDb();
  const [c] = await db.select().from(s.cases).where(eq(s.cases.id, caseId));
  if (!c) return null;
  const [parties, emps] = await Promise.all([
    db.select().from(s.parties).where(eq(s.parties.caseId, caseId)),
    db.select().from(s.employees),
  ]);
  const supervisorOf = new Map(emps.map((e) => [e.id, e.supervisorId]));
  const decision = decide(user, c, parties, supervisorOf);

  if (decision.access === "none") {
    await audit(db, user.id, "authz.denied", caseId, { reason: decision.reason, surface: "case view" });
    return null;
  }
  await audit(db, user.id, decision.access === "full" ? "case.view" : "case.view.metadata", caseId);

  const vc: VisibleCase = { ...c, access: decision.access, decision, parties };
  if (decision.access === "metadata") {
    return { case: redact(vc), employees: emps, allegations: [], interviews: [], documents: [], tasks: [], notes: [], reports: [], drafts: [], hiddenMedicalDocs: 0 };
  }

  const [allegations, interviews, docs, tasks, notes, reports, drafts] = await Promise.all([
    db.select().from(s.allegations).where(eq(s.allegations.caseId, caseId)).orderBy(asc(s.allegations.id)),
    db.select().from(s.interviews).where(eq(s.interviews.caseId, caseId)).orderBy(asc(s.interviews.scheduledAt)),
    db.select().from(s.documents).where(eq(s.documents.caseId, caseId)).orderBy(desc(s.documents.createdAt)),
    db.select().from(s.tasks).where(eq(s.tasks.caseId, caseId)).orderBy(asc(s.tasks.dueDate)),
    db.select().from(s.notes).where(eq(s.notes.caseId, caseId)).orderBy(desc(s.notes.createdAt)),
    db.select().from(s.reports).where(eq(s.reports.caseId, caseId)).orderBy(desc(s.reports.version)),
    db.select().from(s.aiDrafts).where(and(eq(s.aiDrafts.caseId, caseId), eq(s.aiDrafts.userId, user.id))).orderBy(desc(s.aiDrafts.createdAt)),
  ]);
  const medicalOk = canSeeMedicalDocs(user);
  const documents = docs.filter((d) => !d.medical || medicalOk);
  return {
    case: vc,
    employees: emps,
    allegations,
    interviews,
    documents,
    tasks,
    notes,
    reports,
    drafts,
    hiddenMedicalDocs: docs.length - documents.length,
  };
}

export type CaseBundle = NonNullable<Awaited<ReturnType<typeof getCaseFor>>>;

/** Write-path guard: confirms full access without logging a view. Denials are audited. */
export async function requireFullAccess(user: Persona, caseId: string, surface: string) {
  const db = await getDb();
  const [c] = await db.select().from(s.cases).where(eq(s.cases.id, caseId));
  if (!c) throw new Error("Case not found");
  const parties = await db.select().from(s.parties).where(eq(s.parties.caseId, caseId));
  const emps = await db.select({ id: s.employees.id, supervisorId: s.employees.supervisorId }).from(s.employees);
  const decision = decide(user, c, parties, new Map(emps.map((e) => [e.id, e.supervisorId])));
  if (decision.access !== "full") {
    await audit(db, user.id, "authz.denied", caseId, { reason: decision.reason, surface });
    throw new Error("Not authorized");
  }
  return { db, c };
}

/** Write-path guard for running a case (stage, close, holds, parties, findings, reports, letters). */
export async function requireManage(user: Persona, caseId: string, surface: string) {
  const r = await requireFullAccess(user, caseId, surface);
  if (!canManage(user)) {
    await audit(r.db, user.id, "authz.denied", caseId, { reason: "Read-only role for this action", surface });
    throw new Error("Not authorized");
  }
  return r;
}

/** Write-path guard for adding notes, tasks and documents. */
export async function requireContribute(user: Persona, caseId: string, surface: string) {
  const r = await requireFullAccess(user, caseId, surface);
  if (!canContribute(user)) {
    await audit(r.db, user.id, "authz.denied", caseId, { reason: "Read-only role for this action", surface });
    throw new Error("Not authorized");
  }
  return r;
}

/** Access decisions for every persona on a case, without writing view events (used for routing and notifications). */
async function decisionsFor(caseId: string) {
  const db = await getDb();
  const [c] = await db.select().from(s.cases).where(eq(s.cases.id, caseId));
  if (!c) return null;
  const parties = await db.select().from(s.parties).where(eq(s.parties.caseId, caseId));
  const emps = await db.select({ id: s.employees.id, supervisorId: s.employees.supervisorId }).from(s.employees);
  const supervisorOf = new Map(emps.map((e) => [e.id, e.supervisorId]));
  return { c, all: PERSONAS.map((p) => ({ persona: p, decision: decide(p, c, parties, supervisorOf) })) };
}

export async function hasFullAccess(userId: string, caseId: string) {
  const d = await decisionsFor(caseId);
  return d?.all.find((x) => x.persona.id === userId)?.decision.access === "full";
}

/** Snapshot of who has full access, for recording access changes in the audit log. */
export async function fullAccessSet(caseId: string) {
  const d = await decisionsFor(caseId);
  return new Set(d?.all.filter((x) => x.decision.access === "full").map((x) => x.persona.id) ?? []);
}

/** Eligible approvers: authorized to see the case, an approver role, not the author or assignee. */
export async function approversFor(caseId: string, authorId: string | null) {
  const d = await decisionsFor(caseId);
  if (!d) return [];
  return d.all.filter((x) => x.decision.access === "full" && canApprove(x.persona, d.c, authorId)).map((x) => x.persona);
}

/** Who "Notify my leadership" reaches. Only someone who can actually open the case; null if nobody can. */
export async function leadFor(user: Persona, caseId: string) {
  const d = await decisionsFor(caseId);
  if (!d) return null;
  const order = d.c.type === "EEO" ? ["u-angela"] : ["u-lisa", "u-james"];
  const hit = order.map((id) => d.all.find((x) => x.persona.id === id)).find((x) => x && x.persona.id !== user.id && x.decision.access === "full");
  return hit ? hit.persona : null;
}

/** For the admin "who can see this case" explainer. */
export async function accessMatrix(caseId: string) {
  const db = await getDb();
  const [c] = await db.select().from(s.cases).where(eq(s.cases.id, caseId));
  if (!c) return [];
  const parties = await db.select().from(s.parties).where(eq(s.parties.caseId, caseId));
  const emps = await db.select().from(s.employees);
  const supervisorOf = new Map(emps.map((e) => [e.id, e.supervisorId]));
  return PERSONAS.map((p) => ({ persona: p, decision: decide(p, c, parties, supervisorOf) }));
}

export async function userNames() {
  const db = await getDb();
  const rows = await db.select({ id: s.users.id, name: s.users.name }).from(s.users);
  return Object.fromEntries(rows.map((r) => [r.id, r.name])) as Record<string, string>;
}

export async function tasksFor(user: Persona) {
  const visible = await visibleCases(user);
  const full = visible.filter((c) => c.access === "full");
  if (!full.length) return [];
  const db = await getDb();
  const ids = full.map((c) => c.id);
  const rows = await db.select().from(s.tasks).where(inArray(s.tasks.caseId, ids)).orderBy(asc(s.tasks.dueDate));
  const byId = new Map(full.map((c) => [c.id, c]));
  return rows.map((t) => ({ ...t, case: byId.get(t.caseId)! }));
}

export async function notificationsFor(user: Persona) {
  const db = await getDb();
  return db.select().from(s.notifications).where(eq(s.notifications.userId, user.id)).orderBy(desc(s.notifications.createdAt)).limit(20);
}

/** Intake queues are scoped by form type to the team that owns them. */
export function intakeFormsFor(user: Persona): string[] {
  switch (user.role) {
    case "eeo_investigator":
    case "eeo_manager":
      return ["EEO"];
    case "ci_investigator":
    case "hrbp":
      return ["ER"];
    case "rtw_specialist":
      return ["Accommodation"];
    default:
      return [];
  }
}

export async function intakesFor(user: Persona, status = "New") {
  const forms = intakeFormsFor(user);
  if (!forms.length) return [];
  const db = await getDb();
  return db
    .select()
    .from(s.intakes)
    .where(and(inArray(s.intakes.form, forms), eq(s.intakes.status, status)))
    .orderBy(desc(s.intakes.createdAt));
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const [row] = await db.select().from(s.settings).where(eq(s.settings.key, key));
  return (row?.value as T) ?? fallback;
}

/** Reports waiting on this user's decision (they're an eligible approver and can see the case). */
export async function pendingApprovalsFor(user: Persona) {
  const visible = (await visibleCases(user)).filter((c) => c.access === "full");
  if (!visible.length) return [];
  const db = await getDb();
  const reps = await db.select().from(s.reports).where(and(inArray(s.reports.caseId, visible.map((c) => c.id)), eq(s.reports.status, "Pending approval"))).orderBy(asc(s.reports.createdAt));
  const byId = new Map(visible.map((c) => [c.id, c]));
  return reps.filter((r) => canApprove(user, byId.get(r.caseId)!, r.authorId)).map((r) => ({ report: r, case: byId.get(r.caseId)! }));
}
