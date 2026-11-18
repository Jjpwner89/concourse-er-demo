import { currentUser } from "@/lib/session";
import { dashboardScope } from "@/lib/policy";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { COLUMNS, DIMENSIONS, describe, parseParams, runReport } from "@/lib/reports";
import { fmtDateTime } from "@/lib/format";
import { AutoPrint } from "../auto-print";

export const metadata = { title: "ER report (print)" };

export default async function PrintReports({ searchParams }: PageProps<"/print/reports">) {
  const user = await currentUser();
  if (dashboardScope(user) === "none") return <p className="p-10">Not available.</p>;
  const p = parseParams(await searchParams);
  const r = await runReport(user, p);
  await audit(await getDb(), user.id, "report.exported", null, { what: `Report builder: ${describe(p)}`, format: "pdf/print", rows: r.rows.length });
  return (
    <main className="max-w-[900px] mx-auto px-8 py-10 text-[13px]">
      <AutoPrint />
      <div className="flex justify-between border-b border-line pb-3 mb-5 text-[11.5px] text-muted">
        <span>San Bernardino County · Human Resources · Employee Relations</span>
        <span>CONFIDENTIAL</span>
      </div>
      <h1 className="text-[22px] font-semibold">Employee Relations report: {DIMENSIONS[p.group]}</h1>
      <p className="text-muted mt-1">
        {describe(p)} · {r.total} cases
      </p>
      <table className="w-full mt-6 border-collapse">
        <thead>
          <tr className="border-b-2 border-ink text-left">
            <th className="py-1.5 pr-3">{DIMENSIONS[p.group]}</th>
            {COLUMNS.map((c) => (
              <th key={c} className="py-1.5 px-2 text-right">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.label} className="border-b border-line">
              <td className="py-1.5 pr-3">{row.label}</td>
              {row.values.map((v, i) => (
                <td key={i} className="py-1.5 px-2 text-right tabular-nums">
                  {v ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-muted mt-8">
        Generated {fmtDateTime(new Date())} by {user.name}. Includes only cases the requester is authorized to see. This export is recorded in the audit trail.
      </p>
    </main>
  );
}
