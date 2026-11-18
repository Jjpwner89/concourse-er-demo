import Link from "next/link";
import { currentUser } from "@/lib/session";
import { dashboardScope } from "@/lib/policy";
import { COLUMNS, DIMENSIONS, describe, parseParams, runReport } from "@/lib/reports";
import { Card, Empty, PageHeader, btn } from "@/components/ui";
import { BarsH } from "@/components/charts";
import { Download, FileSpreadsheet, Printer } from "lucide-react";

export const metadata = { title: "Report builder" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await currentUser();
  if (dashboardScope(user) === "none")
    return (
      <div className="card p-8 max-w-xl">
        Reporting isn&apos;t available to your role.{" "}
        <Link className="underline" href="/">
          Home
        </Link>
      </div>
    );
  const p = parseParams(await searchParams);
  const r = await runReport(user, p);
  const qs = new URLSearchParams({ group: p.group, type: p.type, status: p.status, from: p.from, to: p.to }).toString();
  return (
    <div>
      <PageHeader
        eyebrow="Reporting"
        title="Report builder"
        sub="Ad hoc reports over the cases you're authorized to see. Same access rules as every other screen. Exports are recorded in the audit trail."
        right={
          <div className="flex gap-2">
            <a href={`/api/reports?${qs}&format=xlsx`} className={btn("secondary")}>
              <FileSpreadsheet size={14} /> Excel
            </a>
            <a href={`/api/reports?${qs}&format=csv`} className={btn("secondary")}>
              <Download size={14} /> CSV
            </a>
            <a href={`/print/reports?${qs}`} target="_blank" rel="noopener" className={btn("secondary")}>
              <Printer size={14} /> PDF
            </a>
          </div>
        }
      />
      <form className="card p-4 mb-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end" action="/reports">
        <L label="Group by">
          <select name="group" defaultValue={p.group} className="field">
            {Object.entries(DIMENSIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </L>
        <L label="Case type">
          <select name="type" defaultValue={p.type} className="field">
            <option value="">All types</option>
            {r.types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </L>
        <L label="Status">
          <select name="status" defaultValue={p.status} className="field">
            {["All", "Open", "Closed"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </L>
        <L label="Opened from">
          <input type="date" name="from" defaultValue={p.from} className="field" />
        </L>
        <div className="flex gap-2 items-end">
          <L label="Opened to">
            <input type="date" name="to" defaultValue={p.to} className="field" />
          </L>
          <button className={btn("primary")}>Run</button>
        </div>
      </form>
      <div className="text-[13px] text-muted mb-3">
        {describe(p)} · {r.total} cases
      </div>
      {r.rows.length === 0 ? (
        <Card>
          <Empty>No cases match.</Empty>
        </Card>
      ) : (
        <div className="grid xl:grid-cols-[1fr_380px] gap-5 items-start">
          <Card pad={false}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <caption className="sr-only">
                  {DIMENSIONS[p.group]} report: {describe(p)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{DIMENSIONS[p.group]}</th>
                    {COLUMNS.map((c) => (
                      <th key={c} scope="col" className="text-right">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="font-medium text-left">
                        {row.label}
                      </th>
                      {row.values.map((v, i) => (
                        <td key={i} className="text-right tabular-nums">
                          {v ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Cases by group">
            <BarsH data={r.rows.slice(0, 12).map((x) => ({ label: x.label, value: x.values[0] ?? 0 }))} />
            <p className="text-[12px] text-muted mt-2">The table to the left has the same figures.</p>
          </Card>
        </div>
      )}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block flex-1">
      <span className="block text-[12.5px] font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}
