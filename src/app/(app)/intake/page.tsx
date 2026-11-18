import Link from "next/link";
import { currentUser } from "@/lib/session";
import { intakesFor, intakeFormsFor } from "@/lib/data";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Badge, Card, Empty, PageHeader, btn } from "@/components/ui";
import { canCreateCases } from "@/lib/policy";
import { Plus } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

export default async function IntakeQueue({ searchParams }: PageProps<"/intake">) {
  const sp = await searchParams;
  const user = await currentUser();
  const [fresh, processed, dismissed] = await Promise.all([intakesFor(user, "New"), intakesFor(user, "Case created"), intakesFor(user, "Dismissed")]);
  // Demo aid: counts only (no content) of new submissions routed to other teams' queues.
  const mine = intakeFormsFor(user);
  const others = (await (await getDb()).select({ form: s.intakes.form }).from(s.intakes).where(eq(s.intakes.status, "New"))).filter((r) => !mine.includes(r.form));
  const otherCounts = Object.entries(others.reduce<Record<string, number>>((m, r) => ({ ...m, [r.form]: (m[r.form] ?? 0) + 1 }), {}));
  const QUEUE: Record<string, string> = { EEO: "EEO (Maria Delgado, Angela Brooks)", ER: "ER (Dana Whitfield, James Okafor)", Accommodation: "Return to Work (Priya Nair)" };
  return (
    <div>
      <PageHeader
        eyebrow="Intake"
        title="Intake queue"
        sub="Submissions from the public portal, email, phone and the third-party hotline, routed to your team."
        right={
          canCreateCases(user) ? (
            <Link href="/cases/new" className={btn("secondary")}>
              <Plus size={14} /> New case (phone, email, walk-in)
            </Link>
          ) : undefined
        }
      />
      {typeof sp.routed === "string" && (
        <div role="status" className="card px-5 py-3 mb-5 bg-ok-soft border-[#bfdcc8] text-[13.5px]">
          ✓ Case <b>{sp.routed}</b> created and routed to <b>{String(sp.team ?? "another team")}</b>. Your role can&apos;t open it, so you&apos;re back in your queue. The routing is recorded in the audit trail.
        </div>
      )}
      {sp.dismissed === "1" && (
        <div role="status" className="card px-5 py-3 mb-5 bg-sunken text-[13.5px]">
          Intake dismissed. It&apos;s listed under Dismissed below and can be restored.
        </div>
      )}
      <Card title={`New (${fresh.length})`} pad={false}>
        {fresh.length === 0 ? <Empty>No new submissions.</Empty> : <IntakeTable rows={fresh} />}
      </Card>
      {otherCounts.length > 0 && (
        <p className="mt-3 text-[12.5px] text-muted">
          Demo note: other teams&apos; queues also have new submissions, which you can&apos;t open from this role:{" "}
          {otherCounts.map(([f, n]) => `${n} in ${QUEUE[f] ?? f}`).join(" · ")}. Use the persona switcher to see them.
        </p>
      )}
      {dismissed.length > 0 && (
        <Card title={`Dismissed (${dismissed.length})`} pad={false} className="mt-6">
          <IntakeTable rows={dismissed.slice(0, 8)} />
        </Card>
      )}
      {processed.length > 0 && (
        <Card title="Recently converted to cases" pad={false} className="mt-6">
          <IntakeTable rows={processed.slice(0, 8)} />
        </Card>
      )}
    </div>
  );
}

function IntakeTable({ rows }: { rows: Awaited<ReturnType<typeof intakesFor>> }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Reference</th>
          <th>Form</th>
          <th>Received</th>
          <th>Submitted by</th>
          <th>Language</th>
          <th>Summary</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((i) => {
          const p = i.payload as Record<string, string>;
          return (
            <tr key={i.id}>
              <td className="whitespace-nowrap">
                <Link href={i.caseId ? `/cases/${i.caseId}` : `/intake/${i.id}`} className="font-medium hover:underline">
                  {i.reference}
                </Link>
              </td>
              <td>
                <Badge tone={i.form === "EEO" ? "dark" : "slate"}>{i.form}</Badge>
              </td>
              <td className="whitespace-nowrap">{fmtDateTime(i.createdAt)}</td>
              <td>{i.anonymous ? <Badge tone="slate">Anonymous</Badge> : p.name ?? "—"}</td>
              <td>{i.language.toUpperCase()}</td>
              <td className="text-[13px] text-ink-2 max-w-[420px]">{String(p.what ?? "").slice(0, 120)}…</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
