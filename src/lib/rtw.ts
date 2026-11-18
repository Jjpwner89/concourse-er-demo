import type { RtwData } from "./db/schema";
import { daysBetween } from "./format";

export function rtwMetrics(rtw: RtwData) {
  const today = new Date();
  const days = (p: RtwData["periods"][number]) => Math.max(0, daysBetween(p.start, p.end ?? today) + 1);
  const tmd = rtw.periods.filter((p) => p.status === "Temporary modified duty");
  const modifiedDutyDays = tmd.reduce((n, p) => n + days(p), 0);
  const offWorkDays = rtw.periods.filter((p) => p.status === "Off work" || p.status === "Leave of absence").reduce((n, p) => n + days(p), 0);
  const current = rtw.periods[rtw.periods.length - 1];
  const currentDays = days(current);
  const fmlaPct = rtw.fmlaHoursEntitled ? Math.round((rtw.fmlaHoursUsed / rtw.fmlaHoursEntitled) * 100) : 0;
  return { modifiedDutyDays, offWorkDays, current, currentDays, fmlaPct, periods: rtw.periods.map((p) => ({ ...p, days: days(p) })) };
}

export type RtwAlert = { caseId: string; employee: string; kind: string; message: string; severity: "warn" | "danger" };

export function rtwAlerts(cases: { id: string; status: string; rtw: RtwData | null; parties: { name: string }[] }[]): RtwAlert[] {
  const out: RtwAlert[] = [];
  for (const c of cases) {
    if (!c.rtw || c.status === "Closed") continue;
    const m = rtwMetrics(c.rtw);
    const employee = c.parties[0]?.name ?? "Employee";
    if (m.current.status === "Temporary modified duty") {
      for (const t of [180, 120]) {
        if (m.modifiedDutyDays >= t - 10) {
          const left = t - m.modifiedDutyDays;
          out.push({
            caseId: c.id,
            employee,
            kind: `${t}-day modified duty`,
            message: left > 0 ? `${m.modifiedDutyDays} days of modified duty, reaching ${t} in ${left} days. ${t === 120 ? "Consider an IAP meeting." : "Escalate to the RTW supervisor."}` : `${m.modifiedDutyDays} days, past the ${t}-day threshold.`,
            severity: t === 180 || left <= 0 ? "danger" : "warn",
          });
          break;
        }
      }
    }
    if (m.fmlaPct >= 90) {
      out.push({ caseId: c.id, employee, kind: "FMLA exhaustion", message: `${c.rtw.fmlaHoursUsed}/${c.rtw.fmlaHoursEntitled} hrs used (${m.fmlaPct}%). Start the Leave Options Process.`, severity: "danger" });
    }
  }
  return out;
}
