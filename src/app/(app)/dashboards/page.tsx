import Link from "next/link";
import { inArray } from "drizzle-orm";
import { currentUser } from "@/lib/session";
import { userNames, visibleCases } from "@/lib/data";
import { dashboardScope } from "@/lib/policy";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { BarsH, BarsV } from "@/components/charts";
import { Badge, Card, PageHeader, Stat, btn } from "@/components/ui";
import { daysBetween, fmtDate } from "@/lib/format";
import { EyeOff, Download } from "lucide-react";

type C = typeof s.cases.$inferSelect;
const SUPPRESS = 3;

function countBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
/** Small-cell suppression for de-identified views: counts under 3 can't be shown. */
const suppress = (rows: { label: string; value: number }[], on: boolean) => (on ? rows.map((r) => (r.value < SUPPRESS ? { ...r, value: SUPPRESS - 1, suppressed: true } : r)) : rows);

export default async function Dashboards() {
  const user = await currentUser();
  const scope = dashboardScope(user);
  if (scope === "none") return <div className="card p-8">Dashboards aren&apos;t available for your role.</div>;
  const names = await userNames();
  const db = await getDb();

  // Identified users: only cases they can fully see.
  // Leadership (de-identified): the visible set plus count-only aggregates of restricted EEO/RTW matters.
  const visible = (await visibleCases(user)).filter((c) => c.access === "full");
  let base: C[] = visible;
  let restrictedCount = 0;
  if (scope === "deidentified") {
    const all = await db.select().from(s.cases);
    const restricted = all.filter((c) => (c.type === "EEO" || c.type === "RTW") && !visible.some((v) => v.id === c.id));
    restrictedCount = restricted.length;
    base = [...visible, ...restricted];
  }
  await audit(db, user.id, "report.generated", null, { report: "ER dashboard", scope, cases: base.length });

  const deid = scope === "deidentified";
  const open = base.filter((c) => c.status !== "Closed");
  const closed = base.filter((c) => c.status === "Closed" && c.closedAt);
  const avgRes = closed.length ? Math.round(closed.reduce((n, c) => n + daysBetween(c.createdAt, c.closedAt), 0) / closed.length) : 0;
  const overdue = open.filter((c) => c.dueDate && daysBetween(new Date(), c.dueDate) < 0);
  const paidLeave = open.filter((c) => c.paidLeaveStart);
  const ids = base.map((c) => c.id);
  const reps = ids.length ? await db.select().from(s.reports).where(inArray(s.reports.caseId, ids)) : [];
  const pending = reps.filter((r) => r.status === "Pending approval").length;

  const months: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleDateString("en-US", { month: "short" });
    months.push({ label, value: base.filter((c) => { const x = new Date(c.createdAt); return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear(); }).length });
  }
  const aging = [
    ["0–30 days", 0, 30],
    ["31–60", 31, 60],
    ["61–90", 61, 90],
    ["90+", 91, 99999],
  ].map(([label, lo, hi]) => ({ label: label as string, value: open.filter((c) => { const a = daysBetween(c.createdAt, new Date()); return a >= (lo as number) && a <= (hi as number); }).length }));
  const byType = countBy(open, (c) => c.type);
  const byDept = suppress(countBy(open, (c) => c.department), deid);
  const byCat = suppress(countBy(base.filter((c) => c.type !== "RTW"), (c) => c.category), deid);
  const byUser = countBy(open.filter((c) => c.assigneeId), (c) => names[c.assigneeId!] ?? "—");
  const eeo = base.filter((c) => c.type === "EEO");
  const eeoBasis = suppress(countBy(eeo, (c) => c.subtype ?? "Unspecified"), deid);
  const eeoOutcome = suppress(countBy(eeo, (c) => (c.status === "Closed" ? (c.outcome?.split(" —")[0] ?? "Closed") : c.status === "On hold" ? "On hold" : "Open")), deid);

  return (
    <div>
      <PageHeader
        eyebrow="Reporting"
        title="Employee Relations dashboard"
        sub={deid ? "Leadership view: EEO and medical matters appear only as de-identified counts. Counts under 3 are suppressed." : `Based on the ${base.length} cases you're authorized to see.`}
        right={
          <a href="/api/export?status=All" className={btn("secondary")}>
            <Download size={14} /> Export CSV
          </a>
        }
      />
      {deid && (
        <div className="card bg-sunken px-5 py-3 mb-5 text-[13.5px] flex items-center gap-2">
          <EyeOff size={15} /> {restrictedCount} restricted EEO/RTW matters are included in counts only. No names, narratives or case numbers.
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <Stat label="Open cases" value={open.length} href={deid ? undefined : "/cases"} />
        <Stat label="Closed" value={closed.length} />
        <Stat label="Avg. resolution" value={`${avgRes}d`} sub="closed cases" />
        <Stat label="Past target date" value={overdue.length} tone={overdue.length ? "danger" : undefined} />
        <Stat label="Pending approvals" value={pending} />
        <Stat label="Paid admin leave" value={paidLeave.length} sub="open cases" tone={paidLeave.length ? "warn" : undefined} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Cases opened by month">
          <BarsV data={months} />
        </Card>
        <Card title="Open case aging">
          <BarsV data={aging} />
        </Card>
        <Card title="Open cases by department">
          <BarsH data={byDept} />
        </Card>
        <Card title="Cases by category (all time)">
          <BarsH data={byCat} />
        </Card>
        <Card title="Open cases by type">
          <BarsV data={byType} height={180} />
        </Card>
        {!deid && (
          <Card title="Workload by investigator (open)">
            <BarsH data={byUser} />
          </Card>
        )}
        {eeo.length > 0 && (
          <>
            <Card title={<span className="flex items-center gap-2">EEO matters by protected basis {deid && <Badge tone="dark">De-identified</Badge>}</span>}>
              <BarsH data={eeoBasis} />
            </Card>
            <Card title={<span className="flex items-center gap-2">EEO matters by status / outcome {deid && <Badge tone="dark">De-identified</Badge>}</span>}>
              <BarsH data={eeoOutcome} />
            </Card>
          </>
        )}
      </div>
      {!deid && paidLeave.length > 0 && (
        <Card title="Cases with paid administrative leave" pad={false} className="mt-6">
          <table className="tbl">
            <thead>
              <tr>
                <th>Case</th>
                <th>Department</th>
                <th>Leave start</th>
                <th className="text-right">Days on leave</th>
              </tr>
            </thead>
            <tbody>
              {paidLeave.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                      {c.number}
                    </Link>
                  </td>
                  <td>{c.department}</td>
                  <td>{fmtDate(c.paidLeaveStart)}</td>
                  <td className="text-right tabular-nums">{daysBetween(c.paidLeaveStart, new Date())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
