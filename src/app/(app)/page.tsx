import Link from "next/link";
import { currentUser } from "@/lib/session";
import { intakesFor, pendingApprovalsFor, tasksFor, userNames, visibleCases } from "@/lib/data";
import { canCreateCases } from "@/lib/policy";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { verifyChain } from "@/lib/audit";
import { aiConfigured } from "@/lib/ai/claude";
import { CaseTable } from "@/components/case-table";
import { Badge, Card, Empty, PageHeader, Stat, btn } from "@/components/ui";
import { fmtDate, relDays, daysBetween } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/personas";
import { rtwAlerts } from "@/lib/rtw";
import { ShieldCheck, Info } from "lucide-react";

export default async function Home() {
  const user = await currentUser();
  const [cases, names] = await Promise.all([visibleCases(user), userNames()]);
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (user.role === "it_admin") return <AdminHome name={user.name} />;
  if (user.role === "hr_director") return <DirectorHome name={user.name} greeting={greeting} today={today} approvals={(await pendingApprovalsFor(user)).length} />;

  const tasks = await tasksFor(user);
  const intakes = await intakesFor(user);
  const mine = cases.filter((c) => c.access === "full" && c.status !== "Closed" && (user.role === "supervisor" || c.assigneeId === user.id));
  const myTasks = tasks.filter((t) => !t.done && (t.assigneeId === user.id || user.role === "supervisor"));
  const overdue = myTasks.filter((t) => t.dueDate && daysBetween(new Date(), t.dueDate) < 0);
  const thisWeek = myTasks.filter((t) => t.dueDate && daysBetween(new Date(), t.dueDate) >= 0 && daysBetween(new Date(), t.dueDate) <= 7);

  const approvals = (await pendingApprovalsFor(user)).map((a) => ({ caseId: a.case.id, number: a.case.number, version: a.report.version }));
  const alerts = user.role === "rtw_specialist" ? rtwAlerts(cases) : [];

  return (
    <div>
      <PageHeader
        eyebrow={today}
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        sub={ROLE_LABEL[user.role] === user.title ? user.title : `${ROLE_LABEL[user.role]} · ${user.title}`}
        right={
          canCreateCases(user) ? (
            <Link href="/cases/new" className={btn("secondary")}>
              New case
            </Link>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label={user.role === "supervisor" ? "Open team matters" : "My open cases"} value={mine.length} href={user.role === "supervisor" ? "/cases" : "/cases?scope=mine"} />
        <Stat label="Due this week" value={thisWeek.length} sub="tasks" href="/tasks#due-this-week" />
        <Stat label="Overdue" value={overdue.length} sub="tasks" tone={overdue.length ? "danger" : undefined} href="/tasks#overdue" />
        {user.role === "eeo_manager" || approvals.length > 0 ? (
          <Stat label="Pending approvals" value={approvals.length} tone={approvals.length ? "warn" : undefined} href="/approvals" />
        ) : user.role === "rtw_specialist" ? (
          <Stat label="Threshold alerts" value={alerts.length} tone={alerts.length ? "warn" : undefined} href="/rtw" />
        ) : (
          <Stat label="New intakes" value={intakes.length} tone={intakes.length ? "warn" : undefined} href="/intake" />
        )}
      </div>

      {user.role === "supervisor" && (
        <div className="card px-5 py-3.5 mb-6 flex gap-3 items-start text-[13.5px] bg-sunken">
          <Info size={16} className="mt-0.5 text-muted shrink-0" />
          <div>
            You see attendance and performance matters for <b>{user.departments.join(", ")}</b>. Investigations involving anyone in your reporting chain are handled by HR, and you are automatically recused from them.
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          {approvals.length > 0 && (
            <Card title="Waiting for your approval">
              <ul className="divide-y divide-line -my-2">
                {approvals.map((a) => (
                  <li key={a.caseId + a.version} className="py-2.5 flex items-center justify-between">
                    <span>
                      <b>{a.number}</b> · Investigative report v{a.version}
                    </span>
                    <Link href={`/cases/${a.caseId}?tab=findings`} className={btn("primary", "sm")}>
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {alerts.length > 0 && (
            <Card title="Return-to-Work threshold alerts" right={<Link className="text-[13px] hover:underline" href="/rtw">Open RTW dashboard →</Link>}>
              <ul className="divide-y divide-line -my-2">
                {alerts.map((a) => (
                  <li key={a.caseId + a.kind} className="py-2.5 flex items-center justify-between gap-3">
                    <span className="text-[13.5px]">
                      <Badge tone={a.severity === "danger" ? "danger" : "warn"}>{a.kind}</Badge> <b className="ml-1">{a.employee}</b> · {a.message}
                    </span>
                    <Link href={`/cases/${a.caseId}?tab=status`} className={btn("secondary", "sm")}>
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title={user.role === "supervisor" ? "Team matters" : "My caseload"} pad={false} right={<Link href="/cases" className="text-[13px] hover:underline">All cases →</Link>}>
            <CaseTable cases={mine} names={names} cols={["number", "title", "type", "stage", "deadline", "age"]} empty="No open cases assigned to you." />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Upcoming & overdue tasks" pad={false}>
            {myTasks.length === 0 ? (
              <Empty>No open tasks.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {myTasks.slice(0, 8).map((t) => {
                  const d = t.dueDate ? daysBetween(new Date(), t.dueDate) : null;
                  return (
                    <li key={t.id} className="px-5 py-2.5">
                      <Link href={`/cases/${t.caseId}?tab=tasks`} className="text-[13.5px] hover:underline">
                        {t.title}
                      </Link>
                      <div className="text-[12px] text-muted mt-0.5 flex gap-2">
                        <span>{t.case.number}</span>
                        <span className={d !== null && d < 0 ? "text-danger font-medium" : d !== null && d <= 3 ? "text-warn" : ""}>{t.dueDate ? (d! < 0 ? `Overdue · ${fmtDate(t.dueDate)}` : `Due ${relDays(t.dueDate)}`) : ""}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          {intakes.length > 0 && (
            <Card title="New intakes" right={<Link href="/intake" className="text-[13px] hover:underline">Queue →</Link>} pad={false}>
              <ul className="divide-y divide-line">
                {intakes.slice(0, 4).map((i) => (
                  <li key={i.id} className="px-5 py-2.5">
                    <Link href={`/intake/${i.id}`} className="text-[13.5px] font-medium hover:underline">
                      {i.reference}
                    </Link>
                    <span className="text-[12px] text-muted ml-2">
                      {i.form} · {i.anonymous ? "Anonymous" : "Named"} · {i.language.toUpperCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

async function AdminHome({ name }: { name: string }) {
  const db = await getDb();
  const chain = await verifyChain(db);
  const users = await db.select().from(s.users);
  return (
    <div>
      <PageHeader eyebrow="System administration" title={`Welcome, ${name.split(" ")[0]}`} sub="You administer the platform. You can't see case narratives, parties or documents." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Active users" value={users.length} href="/admin?tab=users" />
        <Stat label="Audit events" value={chain.count} sub={chain.ok ? "Hash chain verified" : "Chain broken!"} href="/admin?tab=audit" />
        <Stat label="AI service" value={aiConfigured() ? "Live" : "Offline"} sub="Claude via Anthropic API" href="/admin?tab=ai" />
        <Stat label="Integrations" value="4" sub="PeopleSoft · Entra ID · M365 · SIEM" href="/admin?tab=integrations" />
      </div>
      <Card title="Separation of duties">
        <div className="flex gap-3 text-[14px]">
          <ShieldCheck className="text-ok shrink-0" size={20} />
          <p>
            Admin rights here (users, roles, workflows, AI controls, audit export) don&apos;t include access to case content. In the case registry you&apos;ll see numbers, types and dates only. Every privileged action you take is written to the immutable audit log.
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <Link href="/admin" className={btn("primary")}>
            Open administration
          </Link>
          <Link href="/cases" className={btn("secondary")}>
            Case registry (metadata)
          </Link>
        </div>
      </Card>
    </div>
  );
}

function DirectorHome({ name, greeting, today, approvals }: { name: string; greeting: string; today: string; approvals: number }) {
  return (
    <div>
      <PageHeader eyebrow={today} title={`${greeting}, ${name.split(" ")[0]}`} sub="Organization-wide view. EEO and medical matters are shown de-identified." />
      <div className="card p-6 flex items-center justify-between">
        <div>
          <div className="text-[16px] font-semibold">Employee Relations dashboard</div>
          <div className="text-muted text-[13.5px]">Case volume, aging, trends and workload across all 40+ departments.</div>
        </div>
        <div className="flex gap-2">
          <Link href="/reports" className={btn("secondary")}>
            Report builder
          </Link>
          <Link href="/dashboards" className={btn("primary")}>
            Open dashboards
          </Link>
        </div>
      </div>
      {approvals > 0 && (
        <div className="card p-5 mt-4 flex items-center justify-between">
          <div className="text-[14px]">
            <b>{approvals}</b> investigative report{approvals > 1 ? "s" : ""} waiting for your approval
          </div>
          <Link href="/approvals" className={btn("primary", "sm")}>
            Review
          </Link>
        </div>
      )}
    </div>
  );
}
