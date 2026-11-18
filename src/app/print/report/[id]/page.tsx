import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { requireFullAccess, userNames } from "@/lib/data";
import { audit } from "@/lib/audit";
import { fmtDateTime } from "@/lib/format";
import { AutoPrint } from "../../auto-print";

export const metadata = { title: "Investigative report (print)" };

export default async function PrintReport({ params }: PageProps<"/print/report/[id]">) {
  const { id } = await params;
  const user = await currentUser();
  const db = await getDb();
  const [r] = await db.select().from(s.reports).where(eq(s.reports.id, Number(id)));
  if (!r) return <p className="p-10">Not found.</p>;
  let c;
  try {
    ({ c } = await requireFullAccess(user, r.caseId, "report print"));
  } catch {
    return <p className="p-10">Not available.</p>;
  }
  const names = await userNames();
  await audit(db, user.id, "report.printed", r.caseId, { version: r.version, status: r.status });
  return (
    <main className="max-w-[760px] mx-auto px-10 py-12">
      <AutoPrint />
      <div className="flex justify-between border-b border-line pb-3 mb-6 text-[11.5px] text-muted">
        <span>
          {c.number} · Investigative report v{r.version} · {r.status}
        </span>
        <span>CONFIDENTIAL · Attorney work product where applicable</span>
      </div>
      <h1 className="text-[22px] font-semibold">{c.title}</h1>
      <p className="text-[12.5px] text-muted mt-1 mb-6">
        Prepared by {names[r.authorId] ?? r.authorId} · {fmtDateTime(r.createdAt)}
        {r.aiAssisted ? " · AI-assisted draft, reviewed and edited by the investigator" : ""}
      </p>
      <div className="doc whitespace-pre-wrap text-[14.5px] leading-relaxed">{r.body}</div>
      <p className="text-[11px] text-muted mt-10 border-t border-line pt-2">
        Printed by {user.name} on {fmtDateTime(new Date())}. This print is recorded in the case audit trail.
      </p>
    </main>
  );
}
