import { addDays, daysBetween, type DateLike } from "./format";

export type Deadline = { label: string; date: Date; daysLeft: number; basis: string; severity: "ok" | "warn" | "danger" };

const sev = (left: number): Deadline["severity"] => (left < 0 ? "danger" : left <= 14 ? "warn" : "ok");

/** Statutory and policy clocks. Rules are configuration; values here are the defaults. */
export function caseDeadlines(c: { type: string; incidentDate: DateLike; createdAt: DateLike; dueDate: DateLike; status: string }): Deadline[] {
  if (c.status === "Closed") return [];
  const out: Deadline[] = [];
  const today = new Date();
  if (c.type === "EEO" && c.incidentDate) {
    const eeoc = addDays(c.incidentDate, 300);
    out.push({ label: "EEOC charge window", date: eeoc, daysLeft: daysBetween(today, eeoc), basis: "300 days from incident (CA work-sharing state)", severity: "ok" });
    const crd = addDays(c.incidentDate, 365 * 3);
    out.push({ label: "CRD complaint window", date: crd, daysLeft: daysBetween(today, crd), basis: "3 years from incident (Gov. Code §12960)", severity: "ok" });
  }
  if (c.dueDate) {
    const left = daysBetween(today, c.dueDate);
    out.push({ label: c.type === "EEO" ? "Investigation target (90-day policy)" : "Target completion", date: new Date(c.dueDate as string), daysLeft: left, basis: "County policy", severity: sev(left) });
  }
  return out;
}

export function caseAgeDays(createdAt: DateLike) {
  return daysBetween(createdAt, new Date());
}
