"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, type DB } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { CaseType, Sensitivity } from "@/lib/db/schema";
import { resetAndSeed } from "@/lib/db/seed";
import { audit } from "@/lib/audit";
import { currentUser, PERSONA_COOKIE } from "@/lib/session";
import { PERSONAS, personaById, type Persona } from "@/lib/personas";
import { approversFor, fullAccessSet, hasFullAccess, intakeFormsFor, leadFor, requireContribute, requireFullAccess, requireManage } from "@/lib/data";
import { canApprove, canCreateCases, canManage, canUseAdmin } from "@/lib/policy";
import { AI_FEATURES, WORKFLOWS, type AiFeature } from "@/lib/settings-defaults";
import { FINDINGS, OUTCOMES, PARTY_ROLES } from "@/lib/taxonomy";
import {
  AiUnavailable,
  aiAsk,
  aiDraftReport,
  aiInterviewSummary,
  aiLetter,
  aiNextSteps,
  aiSearch,
  aiSimilarCases,
  aiSummarize,
  aiTriage,
  type Triage,
} from "@/lib/ai/features";
import { addDays, dayFromToday, isoDay, todayISO } from "@/lib/format";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AiUnavailable) return { ok: false, error: e.message };
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof Error && e.message === "Not authorized") return { ok: false, error: "You are not authorized to do that." };
    console.error(e);
    return { ok: false, error: "Something went wrong." };
  }
}

/** An expected, user-facing failure (validation, workflow rule). */
class UserError extends Error {}

type Done = Result<null>;
const done = async (fn: () => Promise<unknown>): Promise<Done> => wrap(async () => (await fn(), null));

// ───────────── Demo controls ─────────────

export async function switchPersona(id: string, redirectTo?: string) {
  if (!PERSONAS.some((p) => p.id === id)) return;
  const jar = await cookies();
  jar.set(PERSONA_COOKIE, id, { path: "/", sameSite: "lax", httpOnly: true });
  const db = await getDb();
  await audit(db, id, "auth.login", null, { method: "Demo persona switch (stands in for SSO + MFA)" });
  redirect(redirectTo ?? "/");
}

export async function resetDemo() {
  const db = await getDb();
  await resetAndSeed(db);
  revalidatePath("/", "layout");
  redirect("/");
}

// ───────────── Public intake & follow-up portal ─────────────

const TEAM_FOR_FORM: Record<string, string[]> = { EEO: ["u-maria", "u-angela"], Accommodation: ["u-priya"], ER: ["u-dana", "u-james"] };

export async function submitIntake(input: { form: "EEO" | "ER" | "Accommodation"; language: string; anonymous: boolean; payload: Record<string, unknown> }) {
  // Reject incident dates in the future. One day of slack covers reporter/server time-zone differences.
  const when = input.payload.when;
  if (typeof when === "string" && when) {
    const d = new Date(when + "T00:00:00Z");
    if (isNaN(d.getTime()) || d.getTime() > Date.now() + 864e5) return { error: "future_date" as const };
  }
  const db = await getDb();
  const id = "in-" + Math.random().toString(36).slice(2, 8);
  const prefix = input.form === "EEO" ? "SBC-EEO" : input.form === "Accommodation" ? "SBC-RA" : "SBC-ER";
  const reference = `${prefix}-${Math.floor(48300 + Math.random() * 600)}`;
  const followUpCode = input.anonymous ? Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase() : null;
  await db.insert(s.intakes).values({ id, reference, form: input.form, language: input.language, anonymous: input.anonymous, followUpCode, payload: input.payload, createdAt: new Date() });
  await audit(db, null, "intake.submitted", null, { reference, form: input.form, anonymous: input.anonymous, channel: "Public portal" });
  const team = TEAM_FOR_FORM[input.form];
  await db.insert(s.notifications).values(team.map((userId) => ({ userId, text: `New ${input.form} intake ${reference} received via portal`, href: `/intake/${id}`, channel: "Teams", createdAt: new Date() })));
  const routedTo = input.form === "EEO" ? "EEO" : input.form === "Accommodation" ? "Return to Work" : "HR Business Partner / Central Investigations";
  return { reference, followUpCode, routedTo, reviewers: team.map((u) => personaById(u)?.name ?? u) };
}

/** Public-safe status. Never exposes investigative content, names, or findings detail. */
function publicStatus(intakeStatus: string, c: { status: string; stage: string } | null) {
  if (intakeStatus === "Dismissed") return { step: 4, label: "Reviewed — no further action" };
  if (!c) return { step: 1, label: "Received — being reviewed" };
  if (c.status === "Closed") return { step: 4, label: "Closed" };
  if (c.status === "On hold") return { step: 2, label: "Open — temporarily on hold" };
  if (["Intake", "Jurisdictional review", "Assignment", "Assessment"].includes(c.stage)) return { step: 2, label: "Under review by an investigator" };
  if (c.stage === "Investigation") return { step: 3, label: "Investigation in progress" };
  return { step: 3, label: "Findings being finalized" };
}

async function findIntakeByCode(db: DB, reference: string, code: string) {
  const ref = reference.trim().toUpperCase();
  const cd = code.trim().toUpperCase();
  if (!ref || !cd) return null;
  const [i] = await db.select().from(s.intakes).where(and(eq(s.intakes.reference, ref), eq(s.intakes.followUpCode, cd)));
  return i ?? null;
}

export async function lookupReport(reference: string, code: string) {
  const db = await getDb();
  const i = await findIntakeByCode(db, reference, code);
  await audit(db, null, i ? "intake.status_checked" : "intake.status_check_failed", i?.caseId ?? null, { reference: reference.trim().toUpperCase(), channel: "Follow-up portal" });
  if (!i) return { ok: false as const };
  const [c] = i.caseId ? await db.select().from(s.cases).where(eq(s.cases.id, i.caseId)) : [];
  const messages = i.caseId
    ? (await db.select().from(s.notes).where(and(eq(s.notes.caseId, i.caseId), eq(s.notes.visibility, "External"))).orderBy(desc(s.notes.createdAt))).map((n) => ({
        from: n.authorId === "public" ? "You" : "County Human Resources",
        body: n.body.replace(/^\*\*Message from reporter\*\*\n\n/, ""),
        at: n.createdAt.toISOString(),
      }))
    : ((i.payload.followUps as { body: string; at: string }[] | undefined) ?? []).map((m) => ({ from: "You", body: m.body, at: m.at }));
  return { ok: true as const, reference: i.reference, submitted: i.createdAt.toISOString(), status: publicStatus(i.status, c ?? null), messages };
}

export async function sendReporterMessage(reference: string, code: string, body: string) {
  const db = await getDb();
  const i = await findIntakeByCode(db, reference, code);
  if (!i || !body.trim()) return { ok: false as const };
  const now = new Date();
  if (i.caseId) {
    await db.insert(s.notes).values({ caseId: i.caseId, authorId: "public", body: `**Message from reporter**\n\n${body.trim()}`, visibility: "External", createdAt: now });
    const [c] = await db.select().from(s.cases).where(eq(s.cases.id, i.caseId));
    if (c?.assigneeId) await db.insert(s.notifications).values({ userId: c.assigneeId, text: `New message from the reporter on ${c.number}`, href: `/cases/${c.id}?tab=notes`, channel: "Teams", createdAt: now });
  } else {
    const followUps = [...((i.payload.followUps as unknown[]) ?? []), { body: body.trim(), at: now.toISOString() }];
    await db.update(s.intakes).set({ payload: { ...i.payload, followUps } }).where(eq(s.intakes.id, i.id));
  }
  await audit(db, null, "intake.reporter_message", i.caseId, { reference: i.reference, channel: "Follow-up portal" });
  return { ok: true as const };
}

// ───────────── Case creation (from intake or manual) ─────────────

export async function runTriage(intakeId: string) {
  const user = await currentUser();
  return wrap(() => aiTriage(user, intakeId));
}

async function nextNumber(db: DB, type: string) {
  const year = Number(todayISO().slice(0, 4));
  const rows = (await db.execute(sql`select number from cases where number like ${"%-" + year + "-%"}`)).rows as { number: string }[];
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.number.split("-")[2] ?? "0", 10)), 0);
  return `${type}-${year}-${String(max + 1).padStart(4, "0")}`;
}

type NewCase = {
  caseType: CaseType;
  category: string;
  subtype: string;
  title: string;
  narrative: string;
  sensitivity: Sensitivity;
  department: string | null;
  assigneeId: string | null;
  source: string;
  anonymous: boolean;
  incidentDate: string | null;
  complainant: { employeeId?: string | null; name: string; anonymous?: boolean } | null;
  respondentIds: string[];
  overlapFlags: string[];
  accommodationNeeded: boolean;
  summary?: string;
};

async function createCaseCore(db: DB, user: Persona, n: NewCase, from: Record<string, unknown>) {
  if (n.incidentDate && n.incidentDate > todayISO()) throw new UserError("The incident date can't be in the future.");
  if (!n.title.trim()) throw new UserError("Add a case title.");
  const id = "c-" + Math.random().toString(36).slice(2, 8);
  const number = await nextNumber(db, n.caseType);
  const now = new Date();
  const emps = await db.select().from(s.employees);
  const dept = emps.find((e) => n.respondentIds.includes(e.id))?.department ?? n.department ?? emps.find((e) => e.id === n.complainant?.employeeId)?.department ?? "Unknown";
  await db.insert(s.cases).values({
    id,
    number,
    type: n.caseType,
    category: n.category,
    subtype: n.subtype || null,
    title: n.title.trim(),
    narrative: n.narrative,
    status: "Open",
    stage: n.caseType === "EEO" ? "Jurisdictional review" : n.caseType === "RTW" ? "Intake" : "Assessment",
    sensitivity: n.sensitivity,
    department: dept,
    assigneeId: n.assigneeId,
    source: n.source,
    anonymous: n.anonymous,
    incidentDate: n.incidentDate || null,
    createdAt: now,
    dueDate: isoDay(addDays(now, n.caseType === "EEO" ? 90 : 45)),
    overlapFlags: n.overlapFlags,
  });
  const parties: (typeof s.parties.$inferInsert)[] = [];
  if (n.complainant) {
    parties.push(
      n.complainant.anonymous
        ? { caseId: id, role: n.caseType === "RTW" ? "Employee" : "Complainant", name: "Anonymous complainant", anonymous: true }
        : { caseId: id, role: n.caseType === "RTW" ? "Employee" : "Complainant", employeeId: n.complainant.employeeId ?? null, name: n.complainant.name || "Complainant" },
    );
  }
  for (const rid of n.respondentIds) parties.push({ caseId: id, role: "Respondent", employeeId: rid, name: emps.find((e) => e.id === rid)?.name ?? rid });
  if (parties.length) await db.insert(s.parties).values(parties);
  if (n.caseType === "EEO") {
    await db.insert(s.allegations).values({ caseId: id, category: `${n.category}${n.subtype ? " — " + n.subtype.toLowerCase() : ""}`, description: n.summary || n.narrative.slice(0, 240), status: "Under investigation" });
  }
  const auto =
    n.caseType === "EEO"
      ? [
          { title: "Jurisdictional & timeliness review", days: 2 },
          { title: n.anonymous ? "Post acknowledgment to anonymous follow-up portal" : "Send acknowledgment to complainant", days: 1 },
          { title: "Identify and schedule witness interviews", days: 10 },
        ]
      : n.caseType === "CI" && n.category === "Workplace violence"
        ? [{ title: "Same-day threat assessment", days: 0 }, { title: "Initial assessment", days: 3 }]
        : [{ title: "Initial assessment", days: 3 }];
  if (n.overlapFlags.length) auto.push({ title: "Coordinate with Central Investigations on flagged overlap", days: 1 });
  if (n.accommodationNeeded) auto.push({ title: "Arrange accommodation for complainant's participation", days: 2 });
  await db.insert(s.tasks).values(auto.map((a) => ({ caseId: id, title: a.title, assigneeId: n.assigneeId, dueDate: dayFromToday(a.days), auto: true })));
  await audit(db, user.id, "case.created", id, { number, ...from, overlapFlags: n.overlapFlags });
  if (n.assigneeId) {
    await audit(db, user.id, "case.assigned", id, { to: n.assigneeId });
    if (n.assigneeId !== user.id) await db.insert(s.notifications).values({ userId: n.assigneeId, text: `${number} assigned to you`, href: `/cases/${id}`, channel: "Teams", createdAt: now });
  }
  if (n.overlapFlags.length) {
    await db.insert(s.notifications).values({ userId: "u-james", text: `Coordination request: possible workplace-violence overlap (${number}). Content restricted.`, href: null, channel: "Teams", createdAt: now });
  }
  return { id, number };
}

export async function createCaseFromIntake(intakeId: string, t: Triage & { respondentIds: string[]; assigneeId: string | null }) {
  const user = await currentUser();
  return wrap(async () => {
    const db = await getDb();
    const [intake] = await db.select().from(s.intakes).where(eq(s.intakes.id, intakeId));
    if (!intake || intake.status !== "New") throw new UserError("This intake has already been processed.");
    if (!intakeFormsFor(user).includes(intake.form) || !canCreateCases(user)) throw new Error("Not authorized");
    const p = intake.payload as Record<string, string>;
    const { id, number } = await createCaseCore(
      db,
      user,
      {
        caseType: t.caseType,
        category: t.category,
        subtype: t.subtype,
        title: t.suggestedTitle,
        narrative: p.what ?? "",
        sensitivity: t.sensitivity,
        department: p.department ?? null,
        assigneeId: t.assigneeId,
        source: "Portal",
        anonymous: intake.anonymous,
        incidentDate: p.when || null,
        complainant: intake.anonymous ? { name: "Anonymous complainant", anonymous: true } : { name: p.name ?? "Complainant" },
        respondentIds: t.respondentIds,
        overlapFlags: t.overlapFlags,
        accommodationNeeded: t.accommodationNeeded,
        summary: t.summary,
      },
      { from: intake.reference, triage: "accepted" },
    );
    await db.update(s.intakes).set({ status: "Case created", caseId: id }).where(eq(s.intakes.id, intakeId));
    revalidatePath("/", "layout");
    // If the case was routed to a team this user isn't on, don't send them into a wall.
    return { caseId: id, number, accessible: await hasFullAccess(user.id, id), team: t.team };
  });
}

export async function createManualCase(n: Omit<NewCase, "overlapFlags" | "accommodationNeeded" | "anonymous" | "summary"> & { anonymous: boolean; team: string }) {
  const user = await currentUser();
  return wrap(async () => {
    if (!canCreateCases(user)) throw new Error("Not authorized");
    const db = await getDb();
    const { id, number } = await createCaseCore(db, user, { ...n, overlapFlags: [], accommodationNeeded: false }, { channel: n.source, manual: true });
    revalidatePath("/", "layout");
    return { caseId: id, number, accessible: await hasFullAccess(user.id, id), team: n.team };
  });
}

export async function dismissIntake(intakeId: string, reason: string) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [i] = await db.select().from(s.intakes).where(eq(s.intakes.id, intakeId));
    if (!i) throw new UserError("Intake not found.");
    if (!intakeFormsFor(user).includes(i.form)) {
      await audit(db, user.id, "authz.denied", null, { surface: "intake dismiss", reference: i.reference });
      throw new Error("Not authorized");
    }
    if (!reason.trim()) throw new UserError("A reason is required to dismiss an intake.");
    await db.update(s.intakes).set({ status: "Dismissed", payload: { ...i.payload, dismissal: { reason: reason.trim(), by: user.id, at: new Date().toISOString() } } }).where(eq(s.intakes.id, intakeId));
    await audit(db, user.id, "intake.dismissed", null, { reference: i.reference, reason: reason.trim() });
    revalidatePath("/", "layout");
  });
}

export async function restoreIntake(intakeId: string) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [i] = await db.select().from(s.intakes).where(eq(s.intakes.id, intakeId));
    if (!i || i.status !== "Dismissed" || !intakeFormsFor(user).includes(i.form)) throw new Error("Not authorized");
    await db.update(s.intakes).set({ status: "New" }).where(eq(s.intakes.id, intakeId));
    await audit(db, user.id, "intake.restored", null, { reference: i.reference });
    revalidatePath("/", "layout");
  });
}

// ───────────── AI on cases ─────────────

export async function runCaseAI(
  caseId: string,
  feature: "summarize" | "next_steps" | "draft_report" | "ask" | "interview_summary" | "letters",
  extra: { question?: string; interviewId?: number; letterType?: string; language?: string } = {},
) {
  const user = await currentUser();
  const r = await wrap(async () => {
    if ((feature === "draft_report" || feature === "letters") && !canManage(user)) throw new UserError("Your role can view this case but can't draft reports or correspondence.");
    switch (feature) {
      case "summarize":
        return aiSummarize(user, caseId);
      case "next_steps":
        return aiNextSteps(user, caseId);
      case "draft_report":
        return aiDraftReport(user, caseId);
      case "ask":
        return aiAsk(user, caseId, extra.question ?? "");
      case "interview_summary":
        return aiInterviewSummary(user, caseId, extra.interviewId!);
      case "letters":
        return aiLetter(user, caseId, extra.letterType ?? "Letter", extra.language === "es" ? "es" : "en");
    }
  });
  revalidatePath(`/cases/${caseId}`);
  return r;
}

export async function runSimilar(caseId: string) {
  const user = await currentUser();
  const r = await wrap(() => aiSimilarCases(user, caseId));
  revalidatePath(`/cases/${caseId}`);
  return r;
}

export async function runSearch(query: string) {
  const user = await currentUser();
  return wrap(() => aiSearch(user, query));
}

/** Human disposition of AI output: accept / edit & accept / discard. Accepted output becomes a record. */
export async function disposeDraft(draftId: number, disposition: "Accepted" | "Edited & accepted" | "Discarded", content?: string) {
  const user = await currentUser();
  const db = await getDb();
  const [d] = await db.select().from(s.aiDrafts).where(and(eq(s.aiDrafts.id, draftId), eq(s.aiDrafts.userId, user.id)));
  if (!d) return { ok: false as const, error: "Draft not found" };
  if (d.caseId) await requireFullAccess(user, d.caseId, "ai disposition");
  const body = content ?? d.content;
  await db.update(s.aiDrafts).set({ status: disposition, content: body }).where(eq(s.aiDrafts.id, draftId));
  await audit(db, user.id, "ai.disposition", d.caseId, { feature: d.feature, draftId, disposition });
  let created: string | null = null;
  if (disposition !== "Discarded" && d.caseId) {
    if (d.feature === "draft_report") {
      const [{ v }] = (await db.execute(sql`select coalesce(max(version),0)::int as v from reports where case_id = ${d.caseId}`)).rows as { v: number }[];
      await db.insert(s.reports).values({ caseId: d.caseId, version: v + 1, body, authorId: user.id, aiAssisted: true, status: "Draft", createdAt: new Date() });
      await audit(db, user.id, "report.saved", d.caseId, { version: v + 1, aiAssisted: true });
      created = "findings";
    } else if (d.feature === "letters") {
      const title = body.match(/^Re: (.+)$/m)?.[1]?.trim().slice(0, 70) || "Letter";
      await db.insert(s.documents).values({ caseId: d.caseId, name: `${title} — ${isoDay()}.docx`, kind: "Correspondence", uploadedBy: user.id, createdAt: new Date(), content: body, mime: "text/plain" });
      await audit(db, user.id, "document.created", d.caseId, { source: "AI-assisted letter", title });
      created = "documents";
    } else {
      const label = { summarize: "Case summary", next_steps: "Next steps", interview_summary: "Interview summary", similar_cases: "Related matters", ask: "Q&A" }[d.feature] ?? "AI note";
      await db.insert(s.notes).values({ caseId: d.caseId, authorId: user.id, body: `**${label}** (AI-assisted, reviewed by ${user.name})\n\n${body}`, visibility: "Internal", createdAt: new Date() });
      created = "notes";
    }
    revalidatePath(`/cases/${d.caseId}`);
  }
  return { ok: true as const, created };
}

// ───────────── Notes, tasks, interviews ─────────────

export async function addNote(caseId: string, body: string, visibility: "Internal" | "External", shareWithLeadership: boolean) {
  const user = await currentUser();
  return done(async () => {
    const { db, c } = await requireContribute(user, caseId, "add note");
    // External notes are visible to the reporter in the follow-up portal (when the case came from a portal report).
    await db.insert(s.notes).values({ caseId, authorId: user.id, body, visibility, createdAt: new Date() });
    await audit(db, user.id, "note.added", caseId, { visibility, shared: shareWithLeadership, reporterVisible: visibility === "External" && (await anyIntakeFor(db, caseId)) });
    if (shareWithLeadership) {
      const lead = await leadFor(user, caseId);
      if (lead) await db.insert(s.notifications).values({ userId: lead.id, text: `${user.name} shared a note on ${c.number}`, href: `/cases/${caseId}?tab=notes`, createdAt: new Date() });
    }
    revalidatePath(`/cases/${caseId}`);
  });
}

async function anyIntakeFor(db: DB, caseId: string) {
  const [i] = await db.select({ id: s.intakes.id }).from(s.intakes).where(eq(s.intakes.caseId, caseId));
  return !!i;
}

export async function editNote(noteId: number, body: string) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [n] = await db.select().from(s.notes).where(eq(s.notes.id, noteId));
    if (!n) throw new UserError("Note not found.");
    await requireContribute(user, n.caseId, "edit note");
    if (n.authorId !== user.id) throw new UserError("Only the author can edit a note. Add a new note instead.");
    await db.update(s.notes).set({ body, history: [...n.history, { body: n.body, at: new Date().toISOString() }] }).where(eq(s.notes.id, noteId));
    await audit(db, user.id, "note.edited", n.caseId, { noteId, priorVersions: n.history.length + 1 });
    revalidatePath(`/cases/${n.caseId}`);
  });
}

export async function toggleTask(taskId: number) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [t] = await db.select().from(s.tasks).where(eq(s.tasks.id, taskId));
    if (!t) throw new UserError("Task not found.");
    await requireContribute(user, t.caseId, "task");
    await db.update(s.tasks).set({ done: !t.done }).where(eq(s.tasks.id, taskId));
    await audit(db, user.id, t.done ? "task.reopened" : "task.completed", t.caseId, { task: t.title });
    revalidatePath("/", "layout");
  });
}

export async function completeTasks(taskIds: number[]) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    for (const id of taskIds) {
      const [t] = await db.select().from(s.tasks).where(eq(s.tasks.id, id));
      if (!t || t.done) continue;
      await requireContribute(user, t.caseId, "task");
      await db.update(s.tasks).set({ done: true }).where(eq(s.tasks.id, id));
      await audit(db, user.id, "task.completed", t.caseId, { task: t.title, bulk: true });
    }
    revalidatePath("/", "layout");
  });
}

export async function addTask(caseId: string, title: string, dueDate: string, recurring: string | null, assigneeId?: string | null) {
  const user = await currentUser();
  return done(async () => {
    const { db } = await requireContribute(user, caseId, "task");
    const who = assigneeId || user.id;
    await db.insert(s.tasks).values({ caseId, title, dueDate, assigneeId: who, recurring });
    await audit(db, user.id, "task.created", caseId, { title, dueDate, recurring, assignee: who });
    if (who !== user.id) await db.insert(s.notifications).values({ userId: who, text: `${user.name} assigned you a task: ${title}`, href: `/cases/${caseId}?tab=tasks`, channel: "Teams", createdAt: new Date() });
    revalidatePath(`/cases/${caseId}`);
  });
}

/** `when` is an ISO timestamp with offset, built in the user's browser, so 10:00 stays 10:00. */
export async function scheduleInterview(caseId: string, partyName: string, partyRole: string, when: string) {
  const user = await currentUser();
  return done(async () => {
    const { db } = await requireManage(user, caseId, "interview");
    const at = new Date(when);
    if (isNaN(at.getTime())) throw new UserError("Choose a date and time.");
    await db.insert(s.interviews).values({ caseId, partyName, partyRole, scheduledAt: at, status: "Scheduled" });
    await audit(db, user.id, "interview.scheduled", caseId, { partyRole, when: at.toISOString(), outlook: "Invite sent (simulated)" });
    await db.insert(s.notifications).values({ userId: user.id, text: `Outlook invite sent: interview with ${partyName}`, channel: "Outlook", createdAt: new Date() });
    revalidatePath(`/cases/${caseId}`);
  });
}

export async function saveInterviewNotes(interviewId: number, notes: string) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [iv] = await db.select().from(s.interviews).where(eq(s.interviews.id, interviewId));
    if (!iv) throw new UserError("Interview not found.");
    await requireManage(user, iv.caseId, "interview notes");
    await db.update(s.interviews).set({ notes, status: "Completed" }).where(eq(s.interviews.id, interviewId));
    await audit(db, user.id, "interview.notes_saved", iv.caseId, { interviewId });
    revalidatePath(`/cases/${iv.caseId}`);
  });
}

// ───────────── Documents ─────────────

export async function logDocumentAccess(caseId: string, docId: number, action: "download" | "preview" | "print") {
  const user = await currentUser();
  const { db } = await requireFullAccess(user, caseId, "document " + action);
  await audit(db, user.id, `document.${action}`, caseId, { docId });
}

export async function markLetterSent(docId: number, to: string, channel: string) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [d] = await db.select().from(s.documents).where(eq(s.documents.id, docId));
    if (!d) throw new UserError("Document not found.");
    await requireManage(user, d.caseId, "send letter");
    if (!to.trim()) throw new UserError("Add a recipient.");
    await db.update(s.documents).set({ sentAt: new Date(), sentTo: `${to.trim()} · ${channel}` }).where(eq(s.documents.id, docId));
    await audit(db, user.id, "correspondence.sent", d.caseId, { document: d.name, to: to.trim(), channel });
    revalidatePath(`/cases/${d.caseId}`);
  });
}

// ───────────── Case lifecycle ─────────────

async function latestReport(db: DB, caseId: string) {
  const [r] = await db.select().from(s.reports).where(eq(s.reports.caseId, caseId)).orderBy(desc(s.reports.version)).limit(1);
  return r ?? null;
}

/** Workflow rule: nothing moves past "Findings" until the investigative report is approved. */
async function findingsGate(db: DB, c: typeof s.cases.$inferSelect, target: string) {
  const stages = WORKFLOWS[c.type]?.stages ?? [];
  const fi = stages.indexOf("Findings");
  if (fi < 0 || stages.indexOf(target) <= fi) return;
  const r = await latestReport(db, c.id);
  if (r?.status !== "Approved") throw new UserError(`"${target}" needs an approved investigative report. ${r ? `Report v${r.version} is ${r.status.toLowerCase()}.` : "No report has been drafted yet."}`);
}

export async function setStage(caseId: string, stage: string) {
  const user = await currentUser();
  return done(async () => {
    const { db, c } = await requireManage(user, caseId, "stage");
    const stages = WORKFLOWS[c.type]?.stages ?? [];
    if (!stages.includes(stage)) throw new UserError("Unknown stage.");
    if (stage === stages[stages.length - 1]) throw new UserError("Use Close case to record an outcome.");
    await findingsGate(db, c, stage);
    await db.update(s.cases).set({ stage }).where(eq(s.cases.id, caseId));
    await audit(db, user.id, "case.stage_changed", caseId, { from: c.stage, to: stage });
    revalidatePath(`/cases/${caseId}`);
  });
}

export async function closeCase(caseId: string, outcome: string, note: string) {
  const user = await currentUser();
  return done(async () => {
    const { db, c } = await requireManage(user, caseId, "close");
    const o = OUTCOMES[c.type].find((x) => x.label === outcome);
    if (!o) throw new UserError("Choose an outcome.");
    const stages = WORKFLOWS[c.type]?.stages ?? [];
    const terminal = stages[stages.length - 1] ?? "Closed";
    if (o.findings) await findingsGate(db, c, terminal);
    await db.update(s.cases).set({ stage: terminal, status: "Closed", closedAt: new Date(), outcome, holdReason: null }).where(eq(s.cases.id, caseId));
    await audit(db, user.id, "case.closed", caseId, { from: c.stage, outcome, note: note.trim() || undefined });
    await db.update(s.tasks).set({ done: true }).where(and(eq(s.tasks.caseId, caseId), eq(s.tasks.auto, true)));
    revalidatePath("/", "layout");
  });
}

export async function reopenCase(caseId: string, reason: string) {
  const user = await currentUser();
  return done(async () => {
    const { db, c } = await requireManage(user, caseId, "reopen");
    if (!reason.trim()) throw new UserError("Add a reason for re-opening.");
    const stages = WORKFLOWS[c.type]?.stages ?? [];
    const stage = stages[Math.max(0, stages.length - 2)];
    await db.update(s.cases).set({ stage, status: "Open", closedAt: null, outcome: null }).where(eq(s.cases.id, caseId));
    await audit(db, user.id, "case.reopened", caseId, { reason: reason.trim(), priorOutcome: c.outcome, to: stage });
    revalidatePath("/", "layout");
  });
}

export async function setHold(caseId: string, reason: string | null) {
  const user = await currentUser();
  return done(async () => {
    const { db } = await requireManage(user, caseId, "hold");
    await db.update(s.cases).set({ status: reason ? "On hold" : "Open", holdReason: reason }).where(eq(s.cases.id, caseId));
    await audit(db, user.id, reason ? "case.hold_placed" : "case.hold_released", caseId, { reason, note: "Deadline clocks preserved" });
    revalidatePath(`/cases/${caseId}`);
  });
}

export async function toggleLegalHold(caseId: string) {
  const user = await currentUser();
  return done(async () => {
    const { db, c } = await requireManage(user, caseId, "legal hold");
    await db.update(s.cases).set({ legalHold: !c.legalHold }).where(eq(s.cases.id, caseId));
    await audit(db, user.id, c.legalHold ? "legal_hold.released" : "legal_hold.placed", caseId, { scope: "Case record, documents and audit trail" });
    revalidatePath(`/cases/${caseId}`);
  });
}

/** Records who gained or lost access when a change (assignment, parties) re-evaluates the policy. */
async function auditAccessChange(db: DB, user: Persona, caseId: string, before: Set<string>, cause: string) {
  const after = await fullAccessSet(caseId);
  const gained = [...after].filter((x) => !before.has(x)).map((x) => personaById(x)?.name ?? x);
  const lost = [...before].filter((x) => !after.has(x)).map((x) => personaById(x)?.name ?? x);
  if (gained.length || lost.length) await audit(db, user.id, "access.changed", caseId, { cause, gained, lost });
  return { gained, lost };
}

export async function reassignCase(caseId: string, assigneeId: string) {
  const user = await currentUser();
  return done(async () => {
    const { db, c } = await requireManage(user, caseId, "reassign");
    const before = await fullAccessSet(caseId);
    await db.update(s.cases).set({ assigneeId }).where(eq(s.cases.id, caseId));
    await audit(db, user.id, "case.reassigned", caseId, { from: c.assigneeId, to: assigneeId });
    await auditAccessChange(db, user, caseId, before, "Reassignment");
    await db.insert(s.notifications).values({ userId: assigneeId, text: `${c.number} assigned to you by ${user.name}`, href: `/cases/${caseId}`, channel: "Teams", createdAt: new Date() });
    revalidatePath(`/cases/${caseId}`);
  });
}

// ───────────── Parties, allegations, links, filings ─────────────

export async function addParty(caseId: string, input: { role: string; employeeId: string | null; name: string; notes?: string }) {
  const user = await currentUser();
  return wrap(async () => {
    const { db } = await requireManage(user, caseId, "add party");
    if (!(PARTY_ROLES as readonly string[]).includes(input.role)) throw new UserError("Choose a role.");
    let name = input.name.trim();
    if (input.employeeId) {
      const [e] = await db.select().from(s.employees).where(eq(s.employees.id, input.employeeId));
      if (!e) throw new UserError("Employee not found in HRIS.");
      name = e.name;
    }
    if (!name) throw new UserError("Pick an employee or enter a name.");
    const before = await fullAccessSet(caseId);
    await db.insert(s.parties).values({ caseId, role: input.role, employeeId: input.employeeId, name, notes: input.notes?.trim() || null });
    await audit(db, user.id, "party.added", caseId, { role: input.role, name, source: input.employeeId ? "HRIS" : "External" });
    const change = await auditAccessChange(db, user, caseId, before, `${input.role} added`);
    revalidatePath(`/cases/${caseId}`);
    return change;
  });
}

export async function removeParty(partyId: number) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [p] = await db.select().from(s.parties).where(eq(s.parties.id, partyId));
    if (!p) throw new UserError("Party not found.");
    await requireManage(user, p.caseId, "remove party");
    const before = await fullAccessSet(p.caseId);
    await db.delete(s.parties).where(eq(s.parties.id, partyId));
    await audit(db, user.id, "party.removed", p.caseId, { role: p.role, name: p.anonymous ? "Anonymous" : p.name });
    await auditAccessChange(db, user, p.caseId, before, `${p.role} removed`);
    revalidatePath(`/cases/${p.caseId}`);
  });
}

export async function addAllegation(caseId: string, category: string, description: string) {
  const user = await currentUser();
  return done(async () => {
    const { db } = await requireManage(user, caseId, "add allegation");
    if (!category.trim() || !description.trim()) throw new UserError("Add a category and a description.");
    await db.insert(s.allegations).values({ caseId, category: category.trim(), description: description.trim(), status: "Under investigation" });
    await audit(db, user.id, "allegation.added", caseId, { category: category.trim() });
    revalidatePath(`/cases/${caseId}`);
  });
}

export async function setAllegationFinding(allegationId: number, status: string) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [a] = await db.select().from(s.allegations).where(eq(s.allegations.id, allegationId));
    if (!a) throw new UserError("Allegation not found.");
    await requireManage(user, a.caseId, "allegation finding");
    if (!(FINDINGS as readonly string[]).includes(status)) throw new UserError("Unknown finding.");
    await db.update(s.allegations).set({ status }).where(eq(s.allegations.id, allegationId));
    await audit(db, user.id, "allegation.finding_set", a.caseId, { allegation: a.category, from: a.status, to: status });
    revalidatePath(`/cases/${a.caseId}`);
  });
}

export async function linkCase(caseId: string, otherId: string) {
  const user = await currentUser();
  return done(async () => {
    if (caseId === otherId) throw new UserError("A case can't be linked to itself.");
    const { db, c } = await requireManage(user, caseId, "link case");
    const { c: o } = await requireFullAccess(user, otherId, "link case");
    if (!c.linkedCaseIds.includes(otherId)) await db.update(s.cases).set({ linkedCaseIds: [...c.linkedCaseIds, otherId] }).where(eq(s.cases.id, caseId));
    if (!o.linkedCaseIds.includes(caseId)) await db.update(s.cases).set({ linkedCaseIds: [...o.linkedCaseIds, caseId] }).where(eq(s.cases.id, otherId));
    await audit(db, user.id, "case.linked", caseId, { to: o.number });
    revalidatePath(`/cases/${caseId}`);
  });
}

export async function unlinkCase(caseId: string, otherId: string) {
  const user = await currentUser();
  return done(async () => {
    const { db, c } = await requireManage(user, caseId, "unlink case");
    await db.update(s.cases).set({ linkedCaseIds: c.linkedCaseIds.filter((x) => x !== otherId) }).where(eq(s.cases.id, caseId));
    const [o] = await db.select().from(s.cases).where(eq(s.cases.id, otherId));
    if (o) await db.update(s.cases).set({ linkedCaseIds: o.linkedCaseIds.filter((x) => x !== caseId) }).where(eq(s.cases.id, otherId));
    await audit(db, user.id, "case.unlinked", caseId, { from: o?.number ?? otherId });
    revalidatePath(`/cases/${caseId}`);
  });
}

export async function addFiling(caseId: string, f: { agency: string; number: string; filed: string; status: string }) {
  const user = await currentUser();
  return done(async () => {
    const { db, c } = await requireManage(user, caseId, "external filing");
    if (!f.agency || !f.number.trim() || !f.filed) throw new UserError("Agency, charge number and filed date are required.");
    if (f.filed > todayISO()) throw new UserError("The filed date can't be in the future.");
    const filing = { agency: f.agency, number: f.number.trim(), filed: f.filed, status: f.status || "Open" };
    await db.update(s.cases).set({ externalFilings: [...c.externalFilings, filing] }).where(eq(s.cases.id, caseId));
    await audit(db, user.id, "filing.recorded", caseId, filing);
    revalidatePath(`/cases/${caseId}`);
  });
}

// ───────────── Reports & approvals ─────────────

export async function saveReportEdit(reportId: number, body: string) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [r] = await db.select().from(s.reports).where(eq(s.reports.id, reportId));
    if (!r) throw new UserError("Report not found.");
    await requireManage(user, r.caseId, "report edit");
    const [{ v }] = (await db.execute(sql`select max(version)::int as v from reports where case_id = ${r.caseId}`)).rows as { v: number }[];
    await db.insert(s.reports).values({ caseId: r.caseId, version: v + 1, body, authorId: user.id, aiAssisted: r.aiAssisted, status: "Draft", createdAt: new Date() });
    await audit(db, user.id, "report.saved", r.caseId, { version: v + 1 });
    revalidatePath(`/cases/${r.caseId}`);
  });
}

export async function submitReport(reportId: number) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [r] = await db.select().from(s.reports).where(eq(s.reports.id, reportId));
    if (!r) throw new UserError("Report not found.");
    const { c } = await requireManage(user, r.caseId, "submit report");
    if (r.status !== "Draft" && r.status !== "Changes requested") throw new UserError("This version has already been submitted.");
    const approvers = await approversFor(r.caseId, r.authorId);
    if (!approvers.length) throw new UserError("No eligible approver can review this report (approvers can't be the author or the assigned investigator).");
    await db.update(s.reports).set({ status: "Pending approval" }).where(eq(s.reports.id, reportId));
    await audit(db, user.id, "approval.requested", r.caseId, { item: `Report v${r.version}`, approvers: approvers.map((a) => a.name) });
    await db.insert(s.notifications).values(approvers.map((a) => ({ userId: a.id, text: `Approval requested: report v${r.version} for ${c.number}`, href: `/cases/${r.caseId}?tab=findings`, channel: "Teams", createdAt: new Date() })));
    revalidatePath("/", "layout");
  });
}

export async function commentOnReport(reportId: number, body: string) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [r] = await db.select().from(s.reports).where(eq(s.reports.id, reportId));
    if (!r) throw new UserError("Report not found.");
    await requireFullAccess(user, r.caseId, "report comment");
    await db.update(s.reports).set({ comments: [...r.comments, { authorId: user.id, body, at: new Date().toISOString() }] }).where(eq(s.reports.id, reportId));
    await audit(db, user.id, "report.commented", r.caseId, { version: r.version });
    revalidatePath(`/cases/${r.caseId}`);
  });
}

export async function decideReport(reportId: number, decision: "Approved" | "Changes requested", comment = "") {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    const [r] = await db.select().from(s.reports).where(eq(s.reports.id, reportId));
    if (!r) throw new UserError("Report not found.");
    const { c } = await requireFullAccess(user, r.caseId, "approve report");
    if (!canApprove(user, c, r.authorId)) {
      await audit(db, user.id, "authz.denied", r.caseId, { reason: r.authorId === user.id || c.assigneeId === user.id ? "Approver can't be the author or assigned investigator" : "Not an approver", surface: "approval" });
      throw new UserError("You can't approve this report. Approvers can't be its author or the assigned investigator.");
    }
    if (r.status !== "Pending approval") throw new UserError("This version isn't pending approval.");
    if (decision === "Changes requested" && !comment.trim()) throw new UserError("Say what needs to change.");
    const comments = comment.trim() ? [...r.comments, { authorId: user.id, body: comment.trim(), at: new Date().toISOString() }] : r.comments;
    await db.update(s.reports).set({ status: decision, comments }).where(eq(s.reports.id, reportId));
    await audit(db, user.id, decision === "Approved" ? "approval.granted" : "approval.changes_requested", r.caseId, { item: `Report v${r.version}` });
    if (decision === "Approved") {
      const stages = WORKFLOWS[c.type]?.stages ?? [];
      const fi = stages.indexOf("Findings");
      const next = fi >= 0 ? stages[fi + 1] : null;
      if (next && stages.indexOf(c.stage) <= fi) {
        await db.update(s.cases).set({ stage: next }).where(eq(s.cases.id, r.caseId));
        await audit(db, user.id, "case.stage_changed", r.caseId, { from: c.stage, to: next, by: "Approval workflow" });
      }
    }
    await db.insert(s.notifications).values({ userId: r.authorId, text: `${user.name}: report v${r.version} for ${c.number} ${decision.toLowerCase()}`, href: `/cases/${r.caseId}?tab=findings`, channel: "Teams", createdAt: new Date() });
    revalidatePath("/", "layout");
  });
}

// ───────────── Admin ─────────────

export async function setAiSettings(enabled: boolean, features: Record<string, boolean>) {
  const user = await currentUser();
  const db = await getDb();
  if (!canUseAdmin(user)) {
    await audit(db, user.id, "authz.denied", null, { surface: "admin.ai_settings" });
    return;
  }
  const clean = Object.fromEntries(Object.keys(AI_FEATURES).map((k) => [k, features[k as AiFeature] !== false]));
  await db.insert(s.settings).values({ key: "ai_enabled", value: enabled }).onConflictDoUpdate({ target: s.settings.key, set: { value: enabled } });
  await db.insert(s.settings).values({ key: "ai_features", value: clean }).onConflictDoUpdate({ target: s.settings.key, set: { value: clean } });
  await audit(db, user.id, "admin.security_config_changed", null, { setting: "AI capabilities", enabled, features: clean });
  revalidatePath("/", "layout");
}

/** Periodic privileged-access review: the admin attests that each privileged account is still appropriate. */
export async function attestAccessReview(decisions: { userId: string; keep: boolean }[]) {
  const user = await currentUser();
  return done(async () => {
    const db = await getDb();
    if (!canUseAdmin(user)) {
      await audit(db, user.id, "authz.denied", null, { surface: "admin.access_review" });
      throw new Error("Not authorized");
    }
    const flagged = decisions.filter((d) => !d.keep).map((d) => personaById(d.userId)?.name ?? d.userId);
    await audit(db, user.id, "admin.access_review_attested", null, { reviewed: decisions.length, flaggedForRemoval: flagged, period: todayISO().slice(0, 7) });
    for (const name of flagged) await audit(db, user.id, "admin.permission_change_requested", null, { user: name, change: "Remove privileged access", approval: "Pending HR Director sign-off" });
    await db.insert(s.settings).values({ key: "access_review", value: { at: new Date().toISOString(), by: user.id, flagged } }).onConflictDoUpdate({ target: s.settings.key, set: { value: { at: new Date().toISOString(), by: user.id, flagged } } });
    revalidatePath("/admin");
  });
}

export async function markNotificationsRead() {
  const user = await currentUser();
  const db = await getDb();
  await db.update(s.notifications).set({ read: true }).where(eq(s.notifications.userId, user.id));
  revalidatePath("/", "layout");
}

export async function logExport(what: string, rows: number, caseId: string | null = null) {
  const user = await currentUser();
  const db = await getDb();
  await audit(db, user.id, "report.exported", caseId, { what, rows });
}
