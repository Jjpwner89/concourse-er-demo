import Link from "next/link";
import { currentUser } from "@/lib/session";
import { visibleCases } from "@/lib/data";
import { rtwAlerts, rtwMetrics } from "@/lib/rtw";
import { Badge, Card, PageHeader, Stat, btn, cx } from "@/components/ui";
import { fmtDate } from "@/lib/format";

export default async function RtwPage() {
  const user = await currentUser();
  const cases = (await visibleCases(user)).filter((c) => c.type === "RTW" && c.access === "full");
  if (!cases.length) return <div className="card p-8">The Return-to-Work dashboard is only available to the RTW team.</div>;
  const open = cases.filter((c) => c.status !== "Closed");
  const alerts = rtwAlerts(cases);
  const m = open.map((c) => ({ c, m: rtwMetrics(c.rtw!) }));
  return (
    <div>
      <PageHeader eyebrow="Return to Work" title="Caseload dashboard" sub="Modified duty, Interactive Accommodation Process (IAP) and leave cases. Medical detail stays in the restricted tier." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Open RTW cases" value={open.length} />
        <Stat label="On modified duty" value={m.filter((x) => x.m.current.status === "Temporary modified duty").length} />
        <Stat label="In IAP" value={m.filter((x) => x.m.current.status === "IAP").length} />
        <Stat label="Threshold alerts" value={alerts.length} tone={alerts.length ? "warn" : undefined} />
      </div>
      <Card title="Approaching thresholds" pad={false} className="mb-6">
        <ul className="divide-y divide-line">
          {alerts.map((a) => (
            <li key={a.caseId + a.kind} className="px-5 py-3 flex items-center gap-3">
              <Badge tone={a.severity === "danger" ? "danger" : "warn"}>{a.kind}</Badge>
              <span className="text-[13.5px] flex-1">
                <b>{a.employee}</b> · {a.message}
              </span>
              <Link href={`/cases/${a.caseId}?tab=status`} className={btn("secondary", "sm")}>
                Open
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Caseload" pad={false}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Case</th>
              <th>Employee</th>
              <th>Department</th>
              <th>Current status</th>
              <th className="text-right">Modified duty days</th>
              <th style={{ width: 200 }}>120 / 180-day progress</th>
              <th className="text-right">FMLA used</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {m.map(({ c, m }) => (
              <tr key={c.id}>
                <td>
                  <Link className="font-medium hover:underline" href={`/cases/${c.id}?tab=status`}>
                    {c.number}
                  </Link>
                </td>
                <td>{c.parties[0]?.name}</td>
                <td>{c.department}</td>
                <td>{m.current.status}</td>
                <td className={cx("text-right tabular-nums", m.modifiedDutyDays >= 170 ? "text-danger font-semibold" : m.modifiedDutyDays >= 110 ? "text-warn font-semibold" : "")}>{m.modifiedDutyDays}</td>
                <td>
                  <div className="relative h-2 rounded-full bg-slate-4 overflow-hidden">
                    <div className={cx("absolute inset-y-0 left-0", m.modifiedDutyDays >= 170 ? "bg-danger" : m.modifiedDutyDays >= 110 ? "bg-warn" : "bg-slate-2")} style={{ width: `${Math.min(100, (m.modifiedDutyDays / 180) * 100)}%` }} />
                    <div className="absolute inset-y-0 w-px bg-ink/50" style={{ left: `${(120 / 180) * 100}%` }} />
                  </div>
                </td>
                <td className={cx("text-right tabular-nums", m.fmlaPct >= 90 && "text-danger font-semibold")}>{m.fmlaPct}%</td>
                <td className="whitespace-nowrap">{fmtDate(m.current.start)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
