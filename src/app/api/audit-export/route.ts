import { asc, eq } from "drizzle-orm";
import { requireFullAccess } from "@/lib/data";
import { currentUser } from "@/lib/session";
import { canUseAdmin } from "@/lib/policy";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { todayISO } from "@/lib/format";

/**
 * Audit log export. Whole log: admins only (also the shape the SIEM feed carries).
 * ?case=ID: one case's trail, for anyone with full access to that case.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  const db = await getDb();
  const caseId = new URL(req.url).searchParams.get("case");
  if (caseId) {
    try {
      await requireFullAccess(user, caseId, "case audit export");
    } catch {
      return new Response("Forbidden", { status: 403 });
    }
    const rows = await db.select().from(s.auditLog).where(eq(s.auditLog.caseId, caseId)).orderBy(asc(s.auditLog.seq));
    await audit(db, user.id, "report.exported", caseId, { what: "Case audit trail", rows: rows.length });
    return new Response(toCsv(rows), { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="audit-${caseId}-${todayISO()}.csv"` } });
  }
  if (!canUseAdmin(user)) {
    await audit(db, user.id, "authz.denied", null, { surface: "audit export" });
    return new Response("Forbidden", { status: 403 });
  }
  const rows = await db.select().from(s.auditLog).orderBy(asc(s.auditLog.seq));
  await audit(db, user.id, "admin.audit_exported", null, { rows: rows.length });
  return new Response(toCsv(rows), { headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="audit-log-${todayISO()}.csv"` } });
}

function toCsv(rows: (typeof s.auditLog.$inferSelect)[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [["seq", "timestamp_utc", "user_id", "action", "case_id", "detail_json", "prev_hash", "hash"].join(",")]
    .concat(rows.map((r) => [r.seq, new Date(r.at).toISOString(), r.userId, r.action, r.caseId, JSON.stringify(r.detail), r.prevHash, r.hash].map(esc).join(",")))
    .join("\n");
}
