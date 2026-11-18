import "server-only";
import { visibleCases, userNames } from "./data";
import { getDb } from "./db";
import * as s from "./db/schema";
import type { Persona } from "./personas";
import { daysBetween, isoDay, todayISO } from "./format";

export const DIMENSIONS = {
  type: "Case type",
  department: "Department",
  category: "Category",
  subtype: "Protected basis / subtype",
  stage: "Stage",
  status: "Status",
  assignee: "Investigator",
  supervisor: "Respondent's supervisor",
  outcome: "Outcome",
  source: "Intake channel",
  month: "Month opened",
  sensitivity: "Sensitivity",
} as const;
export type Dimension = keyof typeof DIMENSIONS;

export type ReportParams = { group: Dimension; type: string; status: string; from: string; to: string };

export function parseParams(sp: Record<string, string | string[] | undefined>): ReportParams {
  const v = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const group = (v("group") in DIMENSIONS ? v("group") : "department") as Dimension;
  return { group, type: v("type"), status: v("status") || "All", from: v("from"), to: v("to") };
}

export const COLUMNS = ["Cases", "Open", "Closed", "Avg days to close", "Avg age of open (days)", "Past target date"] as const;

/** Ad hoc report over exactly the cases this user is authorized to see in full (same policy as every screen). */
export async function runReport(user: Persona, p: ReportParams) {
  const [cases, names] = await Promise.all([visibleCases(user), userNames()]);
  const db = await getDb();
  const emps = await db.select({ id: s.employees.id, name: s.employees.name, supervisorId: s.employees.supervisorId }).from(s.employees);
  const emp = new Map(emps.map((e) => [e.id, e]));
  const today = todayISO();
  let rows = cases.filter((c) => c.access === "full");
  if (p.type) rows = rows.filter((c) => c.type === p.type);
  if (p.status === "Open") rows = rows.filter((c) => c.status !== "Closed");
  if (p.status === "Closed") rows = rows.filter((c) => c.status === "Closed");
  if (p.from) rows = rows.filter((c) => isoDay(c.createdAt) >= p.from);
  if (p.to) rows = rows.filter((c) => isoDay(c.createdAt) <= p.to);

  const keysFor = (c: (typeof rows)[number]): string[] => {
    switch (p.group) {
      case "assignee":
        return [c.assigneeId ? (names[c.assigneeId] ?? c.assigneeId) : "Unassigned"];
      case "supervisor": {
        const sups = c.parties
          .filter((x) => x.role === "Respondent" && x.employeeId)
          .map((x) => emp.get(emp.get(x.employeeId!)?.supervisorId ?? "")?.name)
          .filter(Boolean) as string[];
        return sups.length ? [...new Set(sups)] : ["No employee respondent"];
      }
      case "month":
        return [isoDay(c.createdAt).slice(0, 7)];
      case "outcome":
        return [c.outcome ?? (c.status === "Closed" ? "Not recorded" : "Open — no outcome yet")];
      case "subtype":
        return [c.subtype ?? "None"];
      default:
        return [String(c[p.group as "type"] ?? "—")];
    }
  };

  const groups = new Map<string, typeof rows>();
  for (const c of rows) for (const k of keysFor(c)) groups.set(k, [...(groups.get(k) ?? []), c]);
  const out = [...groups.entries()].map(([label, cs]) => {
    const open = cs.filter((c) => c.status !== "Closed");
    const closed = cs.filter((c) => c.status === "Closed" && c.closedAt);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    return {
      label,
      values: [
        cs.length,
        open.length,
        cs.length - open.length,
        avg(closed.map((c) => daysBetween(c.createdAt, c.closedAt))),
        avg(open.map((c) => daysBetween(c.createdAt, new Date()))),
        open.filter((c) => c.dueDate && c.dueDate < today).length,
      ] as (number | null)[],
    };
  });
  out.sort((a, b) => (p.group === "month" ? a.label.localeCompare(b.label) : (b.values[0] ?? 0) - (a.values[0] ?? 0)));
  return { rows: out, total: rows.length, types: [...new Set(cases.filter((c) => c.access === "full").map((c) => c.type))] };
}

export function describe(p: ReportParams) {
  return [`Grouped by ${DIMENSIONS[p.group].toLowerCase()}`, p.type ? `${p.type} cases` : "all case types", p.status !== "All" ? `${p.status.toLowerCase()} only` : "open and closed", p.from || p.to ? `opened ${p.from || "…"} to ${p.to || "today"}` : ""].filter(Boolean).join(" · ");
}
