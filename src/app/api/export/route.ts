import { todayISO } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { redact, userNames, visibleCases } from "@/lib/data";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fmtDate } from "@/lib/format";

/** CSV export. Goes through the same policy filter as the UI; every export is audited. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = await currentUser();
  const names = await userNames();
  let rows = (await visibleCases(user)).map(redact);
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status") ?? "Open";
  const dept = url.searchParams.get("dept");
  if (type) rows = rows.filter((c) => c.type === type);
  if (status !== "All") rows = rows.filter((c) => (status === "Open" ? c.status !== "Closed" : c.status === status));
  if (dept) rows = rows.filter((c) => c.department === dept);
  if (url.searchParams.get("scope") === "mine") rows = rows.filter((c) => c.assigneeId === user.id);

  const header = ["Case number", "Type", "Category", "Title", "Department", "Status", "Stage", "Assigned to", "Opened", "Target date", "Paid admin leave start", "Legal hold"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(",")].concat(
    rows.map((c) =>
      [c.number, c.type, c.category, c.title, c.department, c.status, c.stage, c.assigneeId ? names[c.assigneeId] : "", fmtDate(c.createdAt), fmtDate(c.dueDate), c.access === "full" ? fmtDate(c.paidLeaveStart) : "", c.legalHold ? "Yes" : "No"]
        .map(esc)
        .join(","),
    ),
  );
  const db = await getDb();
  await audit(db, user.id, "report.exported", null, { what: "Case list CSV", rows: rows.length, filters: Object.fromEntries(url.searchParams) });
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="cases-${todayISO()}.csv"` },
  });
}
