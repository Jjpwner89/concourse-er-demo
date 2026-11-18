import "server-only";
import { TEAMS, normalizeTeam, taxonomyPrompt } from "@/lib/taxonomy";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import * as s from "../db/schema";
import { audit } from "../audit";
import { getCaseFor, getSetting, visibleCases, type CaseBundle, type VisibleCase } from "../data";
import type { Persona } from "../personas";
import type { AiFeature } from "../settings-defaults";
import { generateJSON, generateText } from "./claude";
import { fmtDate, daysBetween } from "../format";

export class AiUnavailable extends Error {}

export async function aiFeatureEnabled(feature: AiFeature) {
  const on = await getSetting<boolean>("ai_enabled", true);
  if (!on) return false;
  const features = await getSetting<Record<string, boolean>>("ai_features", {});
  return features[feature] !== false;
}

async function guard(user: Persona, feature: AiFeature, caseId: string | null) {
  if (!(await aiFeatureEnabled(feature))) {
    const db = await getDb();
    await audit(db, user.id, "ai.blocked.disabled", caseId, { feature });
    throw new AiUnavailable("This AI capability has been disabled by your administrator.");
  }
}

/** Builds model context ONLY from what the policy layer returned for this user. */
function caseContext(b: CaseBundle, names: Record<string, string>) {
  const c = b.case;
  const lines = [
    `CASE ${c.number} — ${c.type} — ${c.category}${c.subtype ? " / " + c.subtype : ""}`,
    `Title: ${c.title}`,
    `Department: ${c.department} | Stage: ${c.stage} | Status: ${c.status}`,
    `Opened: ${fmtDate(c.createdAt)} | Incident date: ${fmtDate(c.incidentDate)} | Target date: ${fmtDate(c.dueDate)}`,
    c.paidLeaveStart ? `Paid administrative leave since ${fmtDate(c.paidLeaveStart)}` : "",
    `\nNARRATIVE\n${c.narrative}`,
    `\nPARTIES\n${c.parties.map((p) => `- ${p.role}: ${p.anonymous ? "Anonymous" : p.name}${p.employeeId ? ` (${p.employeeId})` : ""}`).join("\n")}`,
    b.allegations.length ? `\nALLEGATIONS\n${b.allegations.map((a, i) => `${i + 1}. [${a.category}] ${a.description} — status: ${a.status}`).join("\n")}` : "",
    b.interviews.length
      ? `\nINTERVIEWS\n${b.interviews.map((i) => `- ${i.partyName} (${i.partyRole}) — ${i.status}${i.scheduledAt ? " " + fmtDate(i.scheduledAt) : ""}${i.notes ? `\n  Notes:\n  ${i.notes.replace(/\n/g, "\n  ")}` : ""}`).join("\n")}`
      : "",
    b.documents.length ? `\nDOCUMENTS\n${b.documents.map((d) => `- ${d.name} (${d.kind}, v${d.version})${d.content ? ": " + d.content : ""}`).join("\n")}` : "",
    b.tasks.length ? `\nTASKS\n${b.tasks.map((t) => `- [${t.done ? "x" : " "}] ${t.title} (due ${fmtDate(t.dueDate)})`).join("\n")}` : "",
    b.notes.length ? `\nCASE NOTES\n${b.notes.map((n) => `- ${fmtDate(n.createdAt)} ${names[n.authorId] ?? n.authorId}: ${n.body}`).join("\n")}` : "",
    c.externalFilings.length ? `\nEXTERNAL FILINGS\n${c.externalFilings.map((f) => `- ${f.agency} ${f.number} filed ${f.filed}: ${f.status}`).join("\n")}` : "",
    c.rtw
      ? `\nRETURN-TO-WORK\n${c.rtw.periods.map((p) => `- ${p.status}: ${p.start} → ${p.end ?? "present"}${p.restrictions ? " | " + p.restrictions : ""}`).join("\n")}\nFMLA: ${c.rtw.fmlaHoursUsed}/${c.rtw.fmlaHoursEntitled} hours used`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

async function namesMap() {
  const db = await getDb();
  const rows = await db.select({ id: s.users.id, name: s.users.name }).from(s.users);
  return Object.fromEntries(rows.map((r) => [r.id, r.name])) as Record<string, string>;
}

async function saveDraft(user: Persona, caseId: string | null, feature: AiFeature | string, content: string, live: boolean, detail: Record<string, unknown> = {}) {
  const db = await getDb();
  const [d] = await db.insert(s.aiDrafts).values({ caseId, feature, userId: user.id, content, live, createdAt: new Date() }).returning();
  await audit(db, user.id, "ai.invoke", caseId, { feature, draftId: d.id, model: live ? "claude-opus-5-5" : "offline-demo", ...detail });
  return d;
}

async function loadFullCase(user: Persona, caseId: string, feature: AiFeature) {
  await guard(user, feature, caseId);
  const b = await getCaseFor(user, caseId);
  if (!b || b.case.access !== "full") {
    const db = await getDb();
    await audit(db, user.id, "ai.denied", caseId, { feature, reason: "No content access to this case" });
    throw new AiUnavailable("You don't have access to this case's content, so AI features are unavailable.");
  }
  return b;
}

// ───────────────────────── Case-level features ─────────────────────────

export async function aiSummarize(user: Persona, caseId: string) {
  const b = await loadFullCase(user, caseId, "summarize");
  const ctx = caseContext(b, await namesMap());
  const live = await generateText({
    prompt: `Write a case summary for the assigned investigator and their manager.\n\nFormat:\n**Overview** (2-3 sentences)\n**Allegations & status** (bullets)\n**Evidence so far** (bullets, cite the source: interview, document)\n**Open items & deadlines** (bullets)\n\nCase material:\n${ctx}`,
  });
  const fallback = offlineSummary(b);
  return saveDraft(user, caseId, "summarize", live ?? fallback, !!live);
}

export async function aiNextSteps(user: Persona, caseId: string) {
  const b = await loadFullCase(user, caseId, "next_steps");
  const ctx = caseContext(b, await namesMap());
  const live = await generateText({
    prompt: `Based on the workflow stage and the record, suggest the 3-6 most important next steps for the investigator, in priority order. For each: one line of action, then a short "why" grounded in the record. Note any deadline risk. These are suggestions for the investigator to accept or ignore.\n\nCase material:\n${ctx}`,
  });
  return saveDraft(user, caseId, "next_steps", live ?? offlineNextSteps(b), !!live);
}

export async function aiDraftReport(user: Persona, caseId: string) {
  const b = await loadFullCase(user, caseId, "draft_report");
  const ctx = caseContext(b, await namesMap());
  const live = await generateText({
    effort: "medium",
    maxTokens: 12000,
    prompt: `Draft an investigative report narrative for this case for the investigator to edit. Use these headings:\nBACKGROUND\nALLEGATIONS\nINVESTIGATION METHODOLOGY\nSUMMARY OF EVIDENCE (organized by allegation; cite the interview or document for each point)\nANALYSIS (apply a preponderance-of-the-evidence standard; where the record is incomplete, e.g. interviews still pending, say so explicitly and mark the analysis as preliminary)\nPRELIMINARY CONCLUSION — FOR INVESTIGATOR DETERMINATION (for each allegation: what the current evidence appears to support; do not make a final finding)\n\nPlain text, no markdown tables.\n\nCase material:\n${ctx}`,
  });
  return saveDraft(user, caseId, "draft_report", live ?? offlineReport(b), !!live);
}

export async function aiAsk(user: Persona, caseId: string, question: string) {
  const b = await loadFullCase(user, caseId, "ask");
  const ctx = caseContext(b, await namesMap());
  const live = await generateText({
    prompt: `Answer the investigator's question using only the case material below. Cite where each point comes from (e.g. "Greene interview", "OT roster"). If the record doesn't answer it, say so and suggest how to find out.\n\nQuestion: ${question}\n\nCase material:\n${ctx}`,
  });
  return saveDraft(user, caseId, "ask", live ?? `*(Offline demo mode: connect an Anthropic API key for live answers.)*\n\nBased on the record for ${b.case.number}: ${b.case.narrative.slice(0, 280)}…`, !!live, { question });
}

export async function aiInterviewSummary(user: Persona, caseId: string, interviewId: number) {
  const b = await loadFullCase(user, caseId, "interview_summary");
  const iv = b.interviews.find((i) => i.id === interviewId);
  if (!iv?.notes) throw new AiUnavailable("This interview has no notes to summarize yet.");
  const live = await generateText({
    prompt: `Summarize these interview notes for case ${b.case.number}. Format:\n**Key statements** (bullets, close to the interviewee's words)\n**Corroborates / contradicts** (link to the allegations: ${b.allegations.map((a) => a.category).join("; ")})\n**Follow-up questions or evidence to obtain** (bullets)\n\nInterviewee: ${iv.partyName} (${iv.partyRole})\nNotes:\n${iv.notes}`,
  });
  const fallback = `**Key statements** (${iv.partyName}, ${iv.partyRole})\n${iv.notes
    .split("\n")
    .filter((l) => l.trim().length > 40)
    .slice(0, 4)
    .map((l) => "- " + l.trim())
    .join("\n")}\n\n**Follow-up**\n- Confirm dates and witnesses named in this interview.`;
  return saveDraft(user, caseId, "interview_summary", live ?? fallback, !!live, { interviewId });
}

const UNIT: Record<string, string> = { EEO: "Equal Employment Opportunity Office", ER: "Employee Relations", CI: "Central Investigations", RTW: "Return to Work" };

/** Picks the most likely recipient for a letter type from the case parties. */
function recipientFor(b: CaseBundle, letterType: string) {
  const ps = b.case.parties;
  const by = (role: string) => ps.find((p) => p.role === role && !p.anonymous);
  const l = letterType.toLowerCase();
  if (/respondent|skelly|discipline|paid administrative|weingarten/.test(l)) return by("Respondent") ?? by("Employee");
  if (/witness/.test(l)) return by("Witness");
  return by("Complainant") ?? by("Employee") ?? ps[0];
}

export async function aiLetter(user: Persona, caseId: string, letterType: string, language: "en" | "es" = "en") {
  const b = await loadFullCase(user, caseId, "letters");
  const ctx = caseContext(b, await namesMap());
  const to = recipientFor(b, letterType);
  const unit = UNIT[b.case.type] ?? "Human Resources";
  const lang = language === "es" ? "Write the entire letter in Spanish (formal register, usted). Keep the case number and proper names unchanged." : "Write in English.";
  const live = await generateText({
    prompt: `Draft a "${letterType}" letter from San Bernardino County Human Resources, ${unit}, to ${to?.anonymous ? "the complainant (anonymous: address it generically for posting to the follow-up portal)" : (to?.name ?? "the recipient")} for case ${b.case.number}. Start with the County letterhead line, the date, the recipient, then a line "Re: ${letterType}". Use the facts in the record only. Use [brackets] for anything not in the record (dates, times, locations). Neutral, professional tone; do not state conclusions that aren't in the record; never include medical diagnoses; never reveal other parties' confidential information. Include the standard confidentiality and anti-retaliation reminder where appropriate. Sign off as ${user.name}, ${user.title}. ${lang}\n\nCase material:\n${ctx}`,
  });
  const es = language === "es";
  const fallback = `San Bernardino County — Human Resources, ${unit}\n\n${fmtDate(new Date())}\n\n${es ? "Estimado/a" : "Dear"} ${to?.anonymous ? (es ? "denunciante" : "Complainant") : (to?.name ?? "[Recipient]")},\n\nRe: ${letterType}\n\n${es ? `Le escribimos en relación con el caso ${b.case.number}. [Los detalles personalizados se generan cuando el servicio de IA está conectado.]` : `We are writing regarding case ${b.case.number} (current stage: ${b.case.stage}). [Personalized details are generated when the AI service is connected.]`}\n\n${es ? "La represalia por participar en este proceso está prohibida. Comuníquese conmigo si tiene preguntas." : "Retaliation for participating in this process is prohibited. Please contact me with any questions."}\n\n${es ? "Atentamente" : "Sincerely"},\n${user.name}\n${user.title}`;
  return saveDraft(user, caseId, "letters", live ?? fallback, !!live, { letterType, language });
}

// ───────────────────────── Related cases ─────────────────────────

export async function aiSimilarCases(user: Persona, caseId: string) {
  const b = await loadFullCase(user, caseId, "similar_cases");
  // Candidate pool = only cases this user can see in full. Never the whole table.
  const pool = (await visibleCases(user)).filter((c) => c.access === "full" && c.id !== caseId);
  const me = b.case;
  const myRespondents = new Set(me.parties.filter((p) => p.role === "Respondent" && p.employeeId).map((p) => p.employeeId));
  const myPeople = new Set(me.parties.filter((p) => p.employeeId).map((p) => p.employeeId));
  const scored = pool
    .map((c) => {
      const reasons: string[] = [];
      let score = 0;
      const resp = c.parties.filter((p) => p.role === "Respondent" && myRespondents.has(p.employeeId));
      if (resp.length) {
        score += 5;
        reasons.push(`Same respondent (${resp[0].name})`);
      }
      const shared = c.parties.filter((p) => myPeople.has(p.employeeId) && !resp.includes(p));
      if (shared.length) {
        score += 2;
        reasons.push(`Shared party: ${shared.map((p) => p.name).join(", ")}`);
      }
      if (c.department === me.department) {
        score += 1;
        reasons.push(`Same department`);
      }
      if (c.category === me.category) {
        score += 1;
        reasons.push(`Same category (${c.category})`);
      }
      return { c, score, reasons };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const list = scored.map((x) => `- ${x.c.number} (${x.c.status}${x.c.outcome ? ", " + x.c.outcome : ""}): ${x.c.title} — ${x.reasons.join("; ")}`).join("\n");
  const live = scored.length
    ? await generateText({
        prompt: `An investigator is working ${me.number} ("${me.title}"). The system matched these related cases from the records this investigator is authorized to see:\n${list}\n\nIn 2-4 sentences, explain what pattern (if any) these matches suggest and what the investigator should consider, e.g. reviewing the prior file or checking for repeat conduct. Do not draw conclusions about guilt.`,
      })
    : null;
  const content =
    (scored.length ? `**Related matters you're authorized to see (${scored.length})**\n${list}` : "No related matters found among the cases you're authorized to see.") +
    (live ? `\n\n**What this may indicate**\n${live}` : scored.some((x) => x.reasons[0]?.startsWith("Same respondent")) ? `\n\n**What this may indicate**\nThe respondent appears in other matters. Consider reviewing the prior file(s) for repeat conduct before the respondent interview.` : "");
  const d = await saveDraft(user, caseId, "similar_cases", content, !!live, { matched: scored.map((x) => x.c.number), poolSize: pool.length });
  return { draft: d, matches: scored.map((x) => ({ id: x.c.id, number: x.c.number, title: x.c.title, reasons: x.reasons })) };
}

// ───────────────────────── Intake triage ─────────────────────────

export const TriageSchema = z.object({
  suggestedTitle: z.string(),
  caseType: z.enum(["EEO", "ER", "CI", "RTW"]),
  category: z.string(),
  subtype: z.string(),
  team: z.string(),
  sensitivity: z.enum(["standard", "high", "eeo", "medical"]),
  summary: z.string(),
  overlapFlags: z.array(z.string()),
  respondentMatches: z.array(z.object({ employeeId: z.string(), name: z.string(), confidence: z.enum(["high", "medium", "low"]), reason: z.string() })),
  accommodationNeeded: z.boolean(),
  urgency: z.enum(["routine", "priority", "urgent"]),
});
export type Triage = z.infer<typeof TriageSchema>;

export async function aiTriage(user: Persona, intakeId: string): Promise<{ triage: Triage; live: boolean }> {
  await guard(user, "triage", null);
  const db = await getDb();
  const [intake] = await db.select().from(s.intakes).where(eq(s.intakes.id, intakeId));
  if (!intake) throw new AiUnavailable("Intake not found");
  const emps = await db.select().from(s.employees);
  const p = intake.payload as Record<string, string | string[] | boolean>;
  const directory = emps
    .filter((e) => !p.department || e.department === p.department || e.department === "Human Resources")
    .map((e) => `${e.id} | ${e.name} | ${e.title} | ${e.department} | ${e.location}`)
    .join("\n");
  const live = await generateJSON({
    schema: TriageSchema,
    prompt: `Triage this ${intake.form} intake submission for the County Employee Relations teams. Suggest the case type (EEO = discrimination/harassment/retaliation tied to a protected class; ER = general workplace conduct/performance; CI = serious misconduct or workplace violence needing Central Investigations; RTW = accommodation/medical). Choose category and subtype from this taxonomy (use the exact labels; subtype may be empty):\n${taxonomyPrompt()}\nSet team to exactly one of: ${TEAMS.join(", ")}. Set sensitivity "eeo" for EEO matters and "medical" for RTW. Add overlap flags if another team should coordinate (e.g. threats or violence → Central Investigations; criminal conduct → law enforcement referral review; accommodation needed to participate). Match any named or described people to the employee directory, and only match when the description supports it. Summary: 2 neutral sentences. If the submission is not in English, still answer in English.\n\nSUBMISSION (language: ${intake.language}, anonymous: ${intake.anonymous}):\n${JSON.stringify(p, null, 2)}\n\nEMPLOYEE DIRECTORY (from HRIS):\n${directory}`,
  });
  const triage = live ?? offlineTriage(intake.form, p, emps);
  triage.team = normalizeTeam(triage.team, triage.caseType);
  await audit(db, user.id, "ai.invoke", null, { feature: "triage", intake: intake.reference, model: live ? "claude-opus-5-5" : "offline-demo" });
  return { triage, live: !!live };
}

// ───────────────────────── Natural-language search ─────────────────────────

const SearchSchema = z.object({
  keywords: z.array(z.string()),
  types: z.array(z.enum(["EEO", "ER", "CI", "RTW"])),
  departments: z.array(z.string()),
  categories: z.array(z.string()),
  statuses: z.array(z.enum(["Open", "On hold", "Closed"])),
  personNames: z.array(z.string()),
  openedWithinDays: z.number().nullable(),
  paidLeaveOnly: z.boolean(),
  explanation: z.string(),
});

export async function aiSearch(user: Persona, query: string) {
  await guard(user, "ask", null);
  const pool = (await visibleCases(user)).filter((c) => c.access === "full");
  const depts = [...new Set(pool.map((c) => c.department))];
  const cats = [...new Set(pool.map((c) => c.category))];
  const live = await generateJSON({
    schema: SearchSchema,
    prompt: `Convert this case-search request into structured filters. Use only these departments: ${depts.join(", ")}. Categories in use: ${cats.join(", ")}. Leave arrays empty when not specified. "explanation" = one short sentence describing the filters applied.\n\nRequest: ${query}`,
  });
  const f =
    live ??
    ({ keywords: query.split(/\s+/).filter((w) => w.length > 3), types: [], departments: [], categories: [], statuses: [], personNames: [], openedWithinDays: null, paidLeaveOnly: false, explanation: "Keyword match (offline demo mode)" } as z.infer<typeof SearchSchema>);
  const results = pool.filter((c) => matches(c, f));
  const db = await getDb();
  await audit(db, user.id, "ai.invoke", null, { feature: "search", query, results: results.length, model: live ? "claude-opus-5-5" : "offline-demo" });
  return { filters: f, results, live: !!live };
}

function matches(c: VisibleCase, f: z.infer<typeof SearchSchema>) {
  const lc = (x: string) => x.toLowerCase();
  if (f.types.length && !f.types.includes(c.type)) return false;
  if (f.departments.length && !f.departments.some((d) => lc(d) === lc(c.department))) return false;
  if (f.categories.length && !f.categories.some((k) => lc(c.category).includes(lc(k)) || lc(c.subtype ?? "").includes(lc(k)))) return false;
  if (f.statuses.length && !f.statuses.includes(c.status as "Open")) return false;
  if (f.openedWithinDays && daysBetween(c.createdAt, new Date()) > f.openedWithinDays) return false;
  if (f.paidLeaveOnly && !c.paidLeaveStart) return false;
  if (f.personNames.length && !f.personNames.some((n) => c.parties.some((p) => lc(p.name).includes(lc(n))))) return false;
  if (f.keywords.length) {
    const hay = lc([c.title, c.narrative, c.category, c.subtype ?? "", c.number, ...c.parties.map((p) => p.name)].join(" "));
    if (!f.keywords.some((k) => hay.includes(lc(k)))) return false;
  }
  return true;
}

// ───────────────────────── Offline demo fallbacks ─────────────────────────

function offlineSummary(b: CaseBundle) {
  const c = b.case;
  const done = b.interviews.filter((i) => i.status === "Completed");
  const pending = b.interviews.filter((i) => i.status !== "Completed");
  return `**Overview**\n${c.narrative.split(". ").slice(0, 2).join(". ")}.\n\n**Allegations & status**\n${b.allegations.map((a) => `- ${a.category}: ${a.status}`).join("\n") || "- Not yet recorded"}\n\n**Evidence so far**\n${done.map((i) => `- Interview: ${i.partyName} (${i.partyRole})`).join("\n")}\n${b.documents.map((d) => `- Document: ${d.name}`).join("\n")}\n\n**Open items & deadlines**\n${pending.map((i) => `- Interview ${i.partyName}, ${fmtDate(i.scheduledAt)}`).join("\n")}\n${b.tasks.filter((t) => !t.done).map((t) => `- ${t.title} (due ${fmtDate(t.dueDate)})`).join("\n")}`;
}

function offlineNextSteps(b: CaseBundle) {
  const open = b.tasks.filter((t) => !t.done);
  return `1. ${open[0]?.title ?? "Complete outstanding interviews"}. It's the next dated item on the plan.\n2. Interview the respondent after all witnesses so you can put each allegation to them.\n3. Get the documentary evidence that corroborates or rebuts the allegations.\n4. Check the target date (${fmtDate(b.case.dueDate)}) and send the complainant a status update.`;
}

function offlineReport(b: CaseBundle) {
  const c = b.case;
  return `BACKGROUND\n${c.narrative}\n\nALLEGATIONS\n${b.allegations.map((a, i) => `${i + 1}. ${a.category}: ${a.description}`).join("\n")}\n\nINVESTIGATION METHODOLOGY\nInterviews: ${b.interviews.map((i) => `${i.partyName} (${i.partyRole}, ${i.status.toLowerCase()})`).join("; ")}.\nDocuments reviewed: ${b.documents.map((d) => d.name).join("; ")}.\n\nSUMMARY OF EVIDENCE\n[Generated from the interview notes when the AI service is connected.]\n\nANALYSIS\nPreliminary. Interviews are still pending, including the respondent's.\n\nPRELIMINARY CONCLUSION — FOR INVESTIGATOR DETERMINATION\n[To be completed by the investigator.]`;
}

function offlineTriage(form: string, p: Record<string, unknown>, emps: (typeof s.employees.$inferSelect)[]): Triage {
  const text = JSON.stringify(p).toLowerCase();
  const isEEO = form === "EEO" || /harass|discriminat|retaliat|gay|race|religio|disab|gender|sexual/.test(text);
  const threat = /threat|regret|hurt|kill|violence|weapon/.test(text);
  const matchesFound = emps
    .filter((e) => text.includes(e.name.toLowerCase()) || text.includes(e.name.split(" ")[0].toLowerCase() + " "))
    .slice(0, 2)
    .map((e) => ({ employeeId: e.id, name: e.name, confidence: "high" as const, reason: `Named in the submission; ${e.title}, ${e.location}` }));
  return {
    suggestedTitle: isEEO ? "Harassment complaint — reported via portal" : "Workplace conduct concern",
    caseType: form === "Accommodation" ? "RTW" : isEEO ? "EEO" : "ER",
    category: form === "Accommodation" ? "Accommodation request" : isEEO ? "Harassment" : "Misconduct",
    subtype: /gay|sexual orientation|partner/.test(text) ? "Sexual orientation" : "",
    team: form === "Accommodation" ? "Return to Work" : isEEO ? "EEO" : "HR Business Partner",
    sensitivity: form === "Accommodation" ? "medical" : isEEO ? "eeo" : "standard",
    summary: String(p.what ?? "").slice(0, 220),
    overlapFlags: threat ? ["Possible threat language: coordinate with Central Investigations (workplace violence)"] : [],
    respondentMatches: matchesFound,
    accommodationNeeded: Boolean(p.needsAccommodation),
    urgency: threat ? "priority" : "routine",
  };
}
