import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { currentUser } from "@/lib/session";
import { approversFor, getCaseFor, getSetting, leadFor, userNames, visibleCases } from "@/lib/data";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { caseDeadlines, caseAgeDays } from "@/lib/deadlines";
import { WORKFLOWS, AI_FEATURES } from "@/lib/settings-defaults";
import { canApprove, canContribute, canManage } from "@/lib/policy";
import { OUTCOMES } from "@/lib/taxonomy";
import { verifyChain } from "@/lib/audit";
import { PERSONAS } from "@/lib/personas";
import { aiConfigured } from "@/lib/ai/claude";
import { Badge, SensitivityBadge, StatusBadge, TypeBadge, cx } from "@/components/ui";
import { AiPanel } from "@/components/case/ai-panel";
import { CaseActions } from "@/components/case/case-actions";
import { OverviewTab, PartiesTab, AllegationsTab, InterviewsTab, DocumentsTab, TasksTab, NotesTab, FindingsTab, AuditTab, StatusTab } from "@/components/case/tabs";
import { fmtDate } from "@/lib/format";
import { Lock, ShieldOff, Check } from "lucide-react";

export default async function CasePage({ params, searchParams }: PageProps<"/cases/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await currentUser();
  const b = await getCaseFor(user, id);

  if (!b) {
    return (
      <div className="max-w-xl mx-auto mt-16 card p-8 text-center">
        <ShieldOff className="mx-auto text-muted" size={28} />
        <h1 className="text-[20px] font-semibold mt-3">Case not available</h1>
        <p className="text-muted text-[14px] mt-1">This case doesn&apos;t exist, or you aren&apos;t authorized to view it. The attempt has been recorded.</p>
        <Link href="/cases" className="inline-block mt-4 text-[13.5px] underline">
          Back to cases
        </Link>
      </div>
    );
  }

  const c = b.case;
  const names = await userNames();

  if (c.access === "metadata") {
    return (
      <div className="max-w-3xl">
        <Link href="/cases" className="text-[13px] text-muted hover:underline">
          ← Case registry
        </Link>
        <div className="eyebrow mb-1.5 mt-3">Case registry · metadata view</div>
        <h1 className="text-[28px] font-semibold tracking-tight flex items-center gap-3">
          {c.number} <TypeBadge type={c.type} /> <SensitivityBadge s={c.sensitivity} />
        </h1>
        <div className="card mt-5 p-6">
          <div className="flex items-center gap-2 text-[14px] mb-4">
            <Lock size={15} /> <b>Content restricted.</b> <span className="text-muted">{c.decision.reason}.</span>
          </div>
          <dl className="grid grid-cols-2 gap-y-3 text-[14px]">
            {[
              ["Case number", c.number],
              ["Type", `${c.type} · ${c.category}`],
              ["Status", c.status],
              ["Stage", c.stage],
              ["Department", c.department],
              ["Opened", fmtDate(c.createdAt)],
              ["Legal hold", c.legalHold ? "Yes" : "No"],
              ["Record ID", c.id],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted text-[12.5px]">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[12.5px] text-muted mt-5">Narrative, parties, documents, notes and AI features aren&apos;t available to system administrators. This view has been recorded in the audit log.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    ["overview", "Overview"],
    ["parties", "Parties"],
    ...(c.type !== "RTW" ? [["allegations", `Allegations${b.allegations.length ? ` (${b.allegations.length})` : ""}`]] : [["status", "Work status"]]),
    ...(c.type !== "RTW" ? [["interviews", `Interviews${b.interviews.length ? ` (${b.interviews.length})` : ""}`]] : []),
    ["documents", `Documents (${b.documents.length})`],
    ["tasks", `Tasks (${b.tasks.filter((t) => !t.done).length})`],
    ["notes", `Notes (${b.notes.length})`],
    ...(c.type !== "RTW" ? [["findings", "Findings"]] : []),
    ["audit", "Audit"],
  ] as [string, string][];
  const tab = typeof sp.tab === "string" && tabs.some(([k]) => k === sp.tab) ? sp.tab : "overview";

  const deadlines = caseDeadlines(c);
  const stages = WORKFLOWS[c.type]?.stages ?? [];
  const stageIdx = stages.indexOf(c.stage);
  const aiOn = await getSetting<boolean>("ai_enabled", true);
  const aiFeatures = await getSetting<Record<string, boolean>>("ai_features", {});
  const enabled = Object.fromEntries(Object.keys(AI_FEATURES).map((k) => [k, aiOn && aiFeatures[k] !== false])) as Record<keyof typeof AI_FEATURES, boolean>;
  const db = await getDb();
  const auditRows = tab === "audit" ? await db.select().from(s.auditLog).where(eq(s.auditLog.caseId, c.id)).orderBy(asc(s.auditLog.seq)) : [];
  // Linked cases are shown only if this user is independently authorized to see them.
  const visible = c.linkedCaseIds.length ? await visibleCases(user) : [];
  const linked = visible.filter((v) => c.linkedCaseIds.includes(v.id) && v.access === "full").map((v) => ({ id: v.id, number: v.number, title: v.title }));
  const hiddenLinks = c.linkedCaseIds.length - linked.length;

  const perm = { manage: canManage(user), contribute: canContribute(user), me: user.id };
  const latest = b.reports[0] ?? null;
  // Approval gate: nothing moves past Findings until the report is approved.
  const findingsIdx = stages.indexOf("Findings");
  const nextStage = stageIdx >= 0 ? stages[stageIdx + 1] : undefined;
  const gate =
    findingsIdx >= 0 && nextStage && stages.indexOf(nextStage) > findingsIdx && nextStage !== stages[stages.length - 1] && latest?.status !== "Approved"
      ? `Locked until the investigative report is approved${latest ? ` (v${latest.version} is ${latest.status.toLowerCase()})` : ""}.`
      : null;
  const closeNeedsReport = findingsIdx >= 0 && latest?.status !== "Approved";
  const approvers = latest ? (await approversFor(c.id, latest.authorId)).map((p) => p.name) : [];
  const lead = perm.contribute ? await leadFor(user, c.id) : null;
  const reporterPortal = c.source === "Portal";
  const teamIds = c.type === "EEO" ? ["u-maria", "u-angela"] : c.type === "RTW" ? ["u-priya"] : ["u-james", "u-dana"];
  const team = PERSONAS.filter((p) => teamIds.includes(p.id) || p.id === user.id || p.id === c.assigneeId).map((p) => ({ id: p.id, name: p.name }));
  const allVisible = tab === "overview" && perm.manage ? (visible.length ? visible : await visibleCases(user)) : [];
  const linkOptions = allVisible.filter((v) => v.access === "full" && v.id !== c.id && !c.linkedCaseIds.includes(v.id)).map((v) => ({ id: v.id, number: v.number, title: v.title }));
  const chainOk = tab === "audit" ? (await verifyChain(db)).ok : true;

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="min-w-0">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 text-[13px] text-muted mb-2">
            <Link href="/cases" className="hover:underline">
              Cases
            </Link>
            <span>/</span>
            <span className="text-ink font-medium">{c.number}</span>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <TypeBadge type={c.type} />
                <Badge>
                  {c.category}
                  {c.subtype ? ` · ${c.subtype}` : ""}
                </Badge>
                <SensitivityBadge s={c.sensitivity} />
                <StatusBadge status={c.status} />
                {c.status === "Closed" && c.outcome && <Badge tone="slate">Outcome: {c.outcome}</Badge>}
                {c.legalHold && <Badge tone="danger">Legal hold</Badge>}
                {c.anonymous && <Badge tone="slate">Anonymous complainant</Badge>}
                {c.paidLeaveStart && <Badge tone="warn">Paid admin leave since {fmtDate(c.paidLeaveStart)}</Badge>}
              </div>
              <h1 className="text-[24px] leading-tight font-semibold tracking-tight">{c.title}</h1>
              <div className="text-[13px] text-muted mt-1">
                {c.department} · Opened {fmtDate(c.createdAt)} ({caseAgeDays(c.createdAt)} days) via {c.source} · Assigned to {c.assigneeId ? names[c.assigneeId] : "—"}
              </div>
            </div>
            <CaseActions
              caseId={c.id}
              stage={c.stage}
              stages={stages}
              status={c.status}
              legalHold={c.legalHold}
              assigneeId={c.assigneeId}
              assignees={Object.entries(names)
                .filter(([uid]) => teamIds.includes(uid))
                .map(([uid, n]) => ({ id: uid, name: n }))}
              canManage={perm.manage}
              gate={gate}
              closeNeedsReport={closeNeedsReport}
              outcomes={OUTCOMES[c.type]}
            />
          </div>

          {/* Stage stepper */}
          {stages.length > 0 && (
            <ol className="flex mt-5 card overflow-hidden" aria-label="Workflow stage">
              {stages.map((st, i) => (
                <li
                  key={st}
                  className={cx(
                    "flex-1 px-3 py-2 text-[12px] text-center border-r border-line last:border-0 whitespace-nowrap overflow-hidden text-ellipsis",
                    i < stageIdx && "bg-slate-4 text-slate",
                    i === stageIdx && "bg-night text-white font-medium",
                    i > stageIdx && "text-faint",
                  )}
                  aria-current={i === stageIdx ? "step" : undefined}
                >
                  {i < stageIdx && <Check size={11} className="inline mr-1 -mt-0.5" aria-hidden />}
                  {st}
                  <span className="sr-only">{i < stageIdx ? " (completed)" : i === stageIdx ? " (current stage)" : " (upcoming)"}</span>
                </li>
              ))}
            </ol>
          )}

          {/* Deadlines */}
          {(deadlines.length > 0 || c.holdReason) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {c.holdReason && (
                <span className="card px-3 py-1.5 text-[12.5px] bg-warn-soft border-[#ecd9ae]">
                  <b>On hold:</b> {c.holdReason}. Deadline history preserved.
                </span>
              )}
              {deadlines.map((d) => (
                <span key={d.label} className={cx("card px-3 py-1.5 text-[12.5px]", d.severity === "danger" && "bg-danger-soft border-[#ecc4ba]", d.severity === "warn" && "bg-warn-soft border-[#ecd9ae]")} title={d.basis}>
                  <b className="font-semibold">{d.label}:</b> {fmtDate(d.date)} · {d.daysLeft < 0 ? `${-d.daysLeft} days overdue` : `${d.daysLeft} days left`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 border-b border-line mb-5 overflow-x-auto" aria-label="Case sections">
          {tabs.map(([k, label]) => (
            <Link
              key={k}
              href={`/cases/${c.id}?tab=${k}`}
              scroll={false}
              aria-current={k === tab ? "page" : undefined}
              className={cx("px-3 py-2 text-[13.5px] whitespace-nowrap -mb-px border-b-2", k === tab ? "border-night text-ink font-medium" : "border-transparent text-muted hover:text-ink")}
            >
              {label}
            </Link>
          ))}
        </nav>

        {tab === "overview" && <OverviewTab b={b} names={names} linked={linked} hiddenLinks={hiddenLinks} perm={perm} linkOptions={linkOptions} />}
        {tab === "parties" && <PartiesTab b={b} perm={perm} />}
        {tab === "allegations" && <AllegationsTab b={b} perm={perm} />}
        {tab === "interviews" && <InterviewsTab b={b} aiEnabled={enabled.interview_summary} perm={perm} />}
        {tab === "documents" && <DocumentsTab b={b} names={names} perm={perm} />}
        {tab === "tasks" && <TasksTab b={b} names={names} perm={perm} team={team} />}
        {tab === "notes" && <NotesTab b={b} names={names} perm={perm} leadName={lead?.name ?? null} reporterPortal={reporterPortal} />}
        {tab === "findings" && <FindingsTab b={b} names={names} canApprove={!!latest && canApprove(user, c, latest.authorId)} perm={perm} approverNames={approvers} />}
        {tab === "status" && <StatusTab b={b} />}
        {tab === "audit" && <AuditTab rows={auditRows} names={names} caseId={c.id} chainOk={chainOk} />}
      </div>

      <AiPanel caseId={c.id} caseType={c.type} canManage={perm.manage} enabled={enabled} live={aiConfigured()} interviews={b.interviews.filter((i) => i.notes).map((i) => ({ id: i.id, label: `${i.partyName} (${i.partyRole})` }))} />
    </div>
  );
}
