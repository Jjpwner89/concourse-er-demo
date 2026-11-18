import Link from "next/link";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/session";
import { intakeFormsFor } from "@/lib/data";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { TriagePanel } from "./triage-panel";
import { RestoreIntake } from "./restore";
import { teamForRole } from "@/lib/taxonomy";
import { Paperclip } from "lucide-react";

export default async function IntakeDetail({ params }: PageProps<"/intake/[id]">) {
  const { id } = await params;
  const user = await currentUser();
  const db = await getDb();
  const [intake] = await db.select().from(s.intakes).where(eq(s.intakes.id, id));
  if (!intake || !intakeFormsFor(user).includes(intake.form)) {
    if (intake) await audit(db, user.id, "authz.denied", null, { surface: "intake", reference: intake.reference });
    return (
      <div className="card p-8 max-w-xl">
        This intake isn&apos;t available to your team.{" "}
        <Link href="/intake" className="underline">
          Back to the intake queue
        </Link>
      </div>
    );
  }
  await audit(db, user.id, "intake.viewed", null, { reference: intake.reference });
  const p = intake.payload as Record<string, unknown>;
  const users = await db.select({ id: s.users.id, name: s.users.name, role: s.users.role }).from(s.users);
  const staff = users.flatMap((u) => {
    const team = teamForRole(u.role);
    return team ? [{ id: u.id, name: u.name, team }] : [];
  });

  const rows: [string, React.ReactNode][] = [
    ["Submitted by", intake.anonymous ? <Badge tone="slate">Anonymous (follow-up code issued)</Badge> : String(p.name ?? "—")],
    ["Contact", intake.anonymous ? "Via anonymous follow-up portal" : String(p.contact ?? "—")],
    ["Relationship", String(p.relation ?? "—")],
    ["Protected basis", Array.isArray(p.basis) && p.basis.length ? (p.basis as string[]).join(", ") : "—"],
    ["Incident date", fmtDate(p.when as string)],
    ["Department / location", [p.department, p.location].filter(Boolean).join(" · ") || "—"],
    ["People involved", String(p.people ?? "—")],
    ["Witnesses", String(p.witnesses ?? "—")],
    ["Accommodation to participate", p.needsAccommodation ? "Requested" : "No"],
  ];

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/intake" className="hover:underline">
            Intake queue
          </Link>
        }
        title={intake.reference}
        sub={`${intake.form} form · received ${fmtDateTime(intake.createdAt)} via ${String(p.channel ?? "Portal")} · ${intake.language === "es" ? "Submitted in Spanish" : "English"}`}
      />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_440px] gap-6 items-start">
        <div className="space-y-5">
          <Card title="Submission (as received)">
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{String(p.what ?? "")}</p>
            {Array.isArray(p.files) && p.files.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {(p.files as string[]).map((f) => (
                  <span key={f} className="inline-flex items-center gap-1.5 text-[12.5px] border border-line rounded-md px-2 py-1 bg-sunken">
                    <Paperclip size={12} /> {f}
                  </span>
                ))}
              </div>
            )}
          </Card>
          {Array.isArray(p.followUps) && p.followUps.length > 0 && (
            <Card title="Messages from the reporter (follow-up portal)">
              <ul className="space-y-2">
                {(p.followUps as { body: string; at: string }[]).map((m, i) => (
                  <li key={i} className="text-[13.5px]">
                    <span className="text-[12px] text-muted">{fmtDateTime(m.at)}</span>
                    <p>{m.body}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Details" pad={false}>
            <dl className="divide-y divide-line">
              {rows.map(([k, v]) => (
                <div key={k} className="px-5 py-2.5 grid grid-cols-[200px_1fr] text-[13.5px]">
                  <dt className="text-muted">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
        {intake.status === "New" ? (
            <TriagePanel intakeId={intake.id} staff={staff} currentUserId={user.id} form={intake.form} />
          ) : (
            <div className="card p-5 text-[13.5px]">
              {intake.status === "Case created" && intake.caseId ? (
                <>
                  Converted to a case. <Link className="underline" href={`/cases/${intake.caseId}`}>Open case →</Link>
                </>
              ) : (
                <>
                  <b>Dismissed.</b> {String((p.dismissal as { reason?: string } | undefined)?.reason ?? "")}
                  <RestoreIntake id={intake.id} />
                </>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
