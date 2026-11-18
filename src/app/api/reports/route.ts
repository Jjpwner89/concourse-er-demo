import ExcelJS from "exceljs";
import { currentUser } from "@/lib/session";
import { dashboardScope } from "@/lib/policy";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { COLUMNS, DIMENSIONS, describe, parseParams, runReport } from "@/lib/reports";
import { fmtDateTime, todayISO } from "@/lib/format";

/** Report export: Excel (.xlsx) or CSV. Policy-filtered and audited like every other export. */
export async function GET(req: Request) {
  const user = await currentUser();
  const db = await getDb();
  if (dashboardScope(user) === "none") {
    await audit(db, user.id, "authz.denied", null, { surface: "report export" });
    return new Response("Forbidden", { status: 403 });
  }
  const url = new URL(req.url);
  const p = parseParams(Object.fromEntries(url.searchParams));
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const r = await runReport(user, p);
  const header = [DIMENSIONS[p.group], ...COLUMNS];
  const name = `er-report-${p.group}-${todayISO()}`;
  await audit(db, user.id, "report.exported", null, { what: `Report builder: ${describe(p)}`, format, rows: r.rows.length });

  if (format === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...r.rows.map((x) => [x.label, ...x.values])].map((row) => row.map(esc).join(",")).join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` } });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Concourse ER Workspace (prototype)";
  const ws = wb.addWorksheet("Report");
  ws.addRow(["San Bernardino County — Employee Relations report"]).font = { bold: true, size: 13 };
  ws.addRow([describe(p)]);
  ws.addRow([`Generated ${fmtDateTime(new Date())} by ${user.name}. Includes only cases the requester is authorized to see. CONFIDENTIAL.`]);
  ws.addRow([]);
  const h = ws.addRow(header);
  h.font = { bold: true };
  h.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E6DF" } }));
  for (const x of r.rows) ws.addRow([x.label, ...x.values]);
  ws.columns.forEach((c, i) => (c.width = i === 0 ? 34 : 18));
  ws.views = [{ state: "frozen", ySplit: 5 }];
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}.xlsx"` },
  });
}
