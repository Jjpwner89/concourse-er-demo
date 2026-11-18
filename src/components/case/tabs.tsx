import Link from "next/link";
import type { CaseBundle } from "@/lib/data";
import type { auditLog } from "@/lib/db/schema";
import { Badge, Card, Empty, Md, AiBadge, cx } from "@/components/ui";
import { fmtDate, fmtDateTime, daysBetween } from "@/lib/format";
import { rtwMetrics } from "@/lib/rtw";
import {
  AddAllegationForm,
  AddFilingForm,
  AddNoteForm,
  AddPartyForm,
  AddTaskForm,
  DocActions,
  EditableNote,
  FindingSelect,
  InterviewNotesEditor,
  LinkCaseForm,
  RemovePartyButton,
  ReportPanel,
  ScheduleInterviewForm,
  TaskCheck,
  UnlinkButton,
  UploadZone,
} from "./case-forms";
import { TAXONOMY } from "@/lib/taxonomy";
import { Lock, Link2, AlertTriangle, Building2, CalendarClock, RefreshCw, ShieldCheck, Download, Send } from "lucide-react";

type Names = Record<string, string>;
export type Perm = { manage: boolean; contribute: boolean; me: string };
const authorName = (names: Names, id: string) => (id === "public" ? "Reporter (follow-up portal)" : (names[id] ?? id));

export function OverviewTab({ b, names, linked, hiddenLinks, perm, linkOptions }: { b: CaseBundle; names: Names; linked: { id: string; number: string; title: string }[]; hiddenLinks: number; perm: Perm; linkOptions: { id: string; number: string; title: string }[] }) {
  const c = b.case;
  const openTasks = b.tasks.filter((t) => !t.done);
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-5">
      <div className="space-y-5">
        {c.overlapFlags.length > 0 && (
          <div className="card px-4 py-3 bg-coral-soft border-[#f2cdbd] flex gap-2.5 text-[13.5px]">
            <AlertTriangle size={16} className="text-coral shrink-0 mt-0.5" />
            <div>
              <b>Cross-division flag:</b> {c.overlapFlags.join("; ")}. Coordination happens without sharing EEO content.
            </div>
          </div>
        )}
        <Card title={c.type === "RTW" ? "Summary" : "Complaint narrative"}>
          <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">{c.narrative || <span className="text-muted">No narrative recorded.</span>}</p>
        </Card>
        {b.allegations.length > 0 && (
          <Card title="Allegations" pad={false} right={<Link href={`?tab=allegations`} className="text-[13px] hover:underline">Details →</Link>}>
            <ul className="divide-y divide-line">
              {b.allegations.map((a) => (
                <li key={a.id} className="px-5 py-3 flex justify-between gap-3">
                  <div>
                    <div className="text-[13.5px] font-medium">{a.category}</div>
                    <div className="text-[13px] text-muted">{a.description}</div>
                  </div>
                  <AllegationStatus s={a.status} />
                </li>
              ))}
            </ul>
          </Card>
        )}
        {(c.externalFilings.length > 0 || (perm.manage && c.type !== "RTW")) && (
          <Card title="External agency filings (dual-filing)" pad={false}>
            {c.externalFilings.length === 0 ? (
              <div className="px-5 py-3 text-[13px] text-muted">None recorded. If an EEOC or CRD charge arrives, record it here to track agency deadlines alongside the internal case.</div>
            ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Charge / case #</th>
                  <th>Filed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {c.externalFilings.map((f) => (
                  <tr key={f.number}>
                    <td>{f.agency}</td>
                    <td className="font-mono text-[12.5px]">{f.number}</td>
                    <td>{fmtDate(f.filed)}</td>
                    <td>{f.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
            {perm.manage && <AddFilingForm caseId={c.id} />}
          </Card>
        )}
      </div>
      <div className="space-y-5">
        <Card title="Key facts">
          <dl className="space-y-2.5 text-[13.5px]">
            <Fact k="Incident date" v={fmtDate(c.incidentDate)} />
            <Fact k="Intake channel" v={c.source} />
            <Fact k="Department" v={c.department} />
            <Fact k="Assigned to" v={c.assigneeId ? names[c.assigneeId] : "Unassigned"} />
            <Fact k="Open tasks" v={String(openTasks.length)} />
            {c.paidLeaveStart && <Fact k="Paid admin leave" v={`${fmtDate(c.paidLeaveStart)} → ${c.paidLeaveEnd ? fmtDate(c.paidLeaveEnd) : "present"} (${daysBetween(c.paidLeaveStart, c.paidLeaveEnd ?? new Date())} days)`} />}
            {c.outcome && <Fact k="Outcome" v={c.outcome} />}
          </dl>
        </Card>
        <Card title="Linked cases">
          {linked.length === 0 && hiddenLinks === 0 && <div className="text-[13px] text-muted">None</div>}
          <ul className="space-y-2">
            {linked.map((l) => (
              <li key={l.id} className="text-[13.5px] flex gap-2">
                <Link2 size={14} className="mt-0.5 text-muted" />
                <Link href={`/cases/${l.id}`} className="hover:underline flex-1">
                  <b>{l.number}</b> · {l.title}
                </Link>
                {perm.manage && <UnlinkButton caseId={c.id} otherId={l.id} label={l.number} />}
              </li>
            ))}
          </ul>
          {hiddenLinks > 0 && (
            <div className="text-[12.5px] text-muted mt-2 flex items-center gap-1.5">
              <Lock size={12} /> {hiddenLinks} linked matter{hiddenLinks > 1 ? "s" : ""} in another division (restricted)
            </div>
          )}
          {perm.manage && <LinkCaseForm caseId={c.id} options={linkOptions} />}
        </Card>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function AllegationStatus({ s }: { s: string }) {
  const tone = s === "Sustained" ? "danger" : s === "Not sustained" ? "neutral" : s === "Inconclusive" ? "warn" : "slate";
  return <Badge tone={tone}>{s}</Badge>;
}

export function PartiesTab({ b, perm }: { b: CaseBundle; perm: Perm }) {
  const emp = new Map(b.employees.map((e) => [e.id, e]));
  return (
    <div className="space-y-5">
    {perm.manage && (
      <Card title="Add a party or witness">
        <AddPartyForm caseId={b.case.id} employees={b.employees.filter((e) => e.status === "Active").map((e) => ({ id: e.id, name: e.name, title: e.title, department: e.department }))} />
        <p className="text-[12px] text-muted mt-2">Adding a party re-runs the access policy. Anyone in a complainant&apos;s or respondent&apos;s reporting chain is recused automatically, and the change is recorded.</p>
      </Card>
    )}
    <Card
      title="Parties"
      pad={false}
      right={
        <span className="text-[12px] text-muted inline-flex items-center gap-1.5">
          <RefreshCw size={12} /> Employee data synced from PeopleSoft HCM · nightly
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Employee ID</th>
              <th>Classification</th>
              <th>Department / location</th>
              <th>Supervisor</th>
              <th>Bargaining unit</th>
              <th>Hired</th>
              {perm.manage && <th><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {b.case.parties.map((p) => {
              const e = p.employeeId ? emp.get(p.employeeId) : undefined;
              const sup = e?.supervisorId ? emp.get(e.supervisorId) : undefined;
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.anonymous ? <span className="inline-flex items-center gap-1.5"><Lock size={12} /> Anonymous</span> : p.name}</td>
                  <td>
                    <Badge tone={p.role === "Respondent" ? "coral" : p.role === "Complainant" ? "slate" : "neutral"}>{p.role}</Badge>
                  </td>
                  <td className="font-mono text-[12.5px]">{e?.id ?? "—"}</td>
                  <td>{e?.title ?? "—"}</td>
                  <td>
                    {e ? (
                      <>
                        {e.department}
                        <div className="text-[12px] text-muted">{e.location}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{sup?.name ?? "—"}</td>
                  <td className="text-[12.5px]">{e?.bargainingUnit ?? "—"}</td>
                  <td className="whitespace-nowrap">{e ? fmtDate(e.hireDate) : "—"}</td>
                  {perm.manage && (
                    <td>
                      <RemovePartyButton id={p.id} label={p.anonymous ? "the anonymous complainant" : p.name} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-line text-[12px] text-muted flex items-center gap-1.5">
        <Building2 size={12} /> Read-only, one-way integration. Case status is never written back to personnel records.
      </div>
    </Card>
    </div>
  );
}

export function AllegationsTab({ b, perm }: { b: CaseBundle; perm: Perm }) {
  const approved = b.reports[0]?.status === "Approved";
  const categories = Object.keys(TAXONOMY[b.case.type] ?? {});
  return (
    <div className="space-y-3">
      {perm.manage && (
        <Card title="Add an allegation">
          <AddAllegationForm caseId={b.case.id} categories={categories} />
        </Card>
      )}
      {!b.allegations.length && (
        <Card>
          <Empty>No allegations recorded yet.</Empty>
        </Card>
      )}
      {b.allegations.map((a, i) => (
        <div key={a.id} className="card p-5">
          <div className="flex justify-between gap-3">
            <div>
              <div className="eyebrow">Allegation {i + 1}</div>
              <h3 className="text-[15px] font-semibold mt-0.5">{a.category}</h3>
            </div>
            <div className="flex items-start gap-2">
              {perm.manage ? <FindingSelect id={a.id} value={a.status} /> : <AllegationStatus s={a.status} />}
            </div>
          </div>
          <p className="text-[14px] mt-2">{a.description}</p>
          <div className="text-[12.5px] text-muted mt-3">
            Each allegation gets its own finding.{" "}
            {a.status !== "Under investigation" && !approved ? <b className="text-warn">Proposed. Becomes final when the investigative report is approved.</b> : a.status !== "Under investigation" ? "Final: confirmed by the approved report." : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InterviewsTab({ b, perm }: { b: CaseBundle; aiEnabled: boolean; perm: Perm }) {
  return (
    <div className="space-y-5">
      {perm.manage && (
        <Card title="Schedule an interview">
          <ScheduleInterviewForm caseId={b.case.id} parties={b.case.parties.filter((p) => !p.anonymous).map((p) => ({ name: p.name, role: p.role }))} />
        </Card>
      )}
      {b.interviews.length === 0 && <Card><Empty>No interviews yet.</Empty></Card>}
      {b.interviews.map((iv) => (
        <div key={iv.id} className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[15px] font-semibold">{iv.partyName}</div>
            <Badge>{iv.partyRole}</Badge>
            <Badge tone={iv.status === "Completed" ? "ok" : "warn"}>{iv.status}</Badge>
            <span className="ml-auto text-[12.5px] text-muted inline-flex items-center gap-1">
              <CalendarClock size={13} /> {fmtDateTime(iv.scheduledAt)}
            </span>
          </div>
          {iv.notes && <pre className="mt-3 whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed bg-sunken rounded-lg p-4 max-h-[260px] overflow-auto">{iv.notes}</pre>}
          <div className="mt-2 flex items-center gap-4">
            {perm.manage && <InterviewNotesEditor id={iv.id} initial={iv.notes} />}
            {iv.notes && <span className="text-[12px] text-muted">Use “Summarize interview notes” in the assistant →</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DocumentsTab({ b, names, perm }: { b: CaseBundle; names: Names; perm: Perm }) {
  const recipient = b.case.parties.find((p) => (p.role === "Complainant" || p.role === "Employee") && !p.anonymous)?.name ?? "";
  return (
    <div className="space-y-5">
      {perm.contribute && <UploadZone caseId={b.case.id} isRtw={b.case.type === "RTW"} />}
      {b.hiddenMedicalDocs > 0 && (
        <div className="card px-4 py-2.5 bg-sunken text-[13px] flex items-center gap-2">
          <Lock size={13} /> {b.hiddenMedicalDocs} medical document{b.hiddenMedicalDocs > 1 ? "s are" : " is"} stored in the restricted medical tier and not visible to your role.
        </div>
      )}
      <Card pad={false}>
        {b.documents.length === 0 ? (
          <Empty>No documents.</Empty>
        ) : (
          <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Version</th>
                <th>Uploaded by</th>
                <th>Date</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {b.documents.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">
                    {d.name} {d.medical && <Badge tone="coral" className="ml-1">Medical tier</Badge>}
                    {d.sentAt && (
                      <div className="text-[12px] text-ok font-normal flex items-center gap-1 mt-0.5">
                        <Send size={11} /> Sent {fmtDate(d.sentAt)} to {d.sentTo}
                      </div>
                    )}
                    {d.size ? <div className="text-[11.5px] text-muted font-normal">{Math.max(1, Math.round(d.size / 1024))} KB</div> : null}
                  </td>
                  <td>{d.kind}</td>
                  <td>v{d.version}</td>
                  <td>{names[d.uploadedBy] ?? d.uploadedBy}</td>
                  <td className="whitespace-nowrap">{fmtDate(d.createdAt)}</td>
                  <td>
                    <DocActions
                      doc={{ id: d.id, name: d.name, kind: d.kind, mime: d.mime, hasFile: !!d.data, content: d.content, sentAt: d.sentAt ? d.sentAt.toISOString() : null, sentTo: d.sentTo }}
                      canSend={perm.manage}
                      defaultRecipient={recipient}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function TasksTab({ b, names, perm, team }: { b: CaseBundle; names: Names; perm: Perm; team: { id: string; name: string }[] }) {
  return (
    <div className="space-y-5">
      {perm.contribute && (
        <Card title="Add task">
          <AddTaskForm caseId={b.case.id} people={team} me={perm.me} />
        </Card>
      )}
      <Card pad={false}>
        {b.tasks.length === 0 ? (
          <Empty>No tasks.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {b.tasks.map((t) => {
              const d = t.dueDate ? daysBetween(new Date(), t.dueDate) : null;
              return (
                <li key={t.id} className="px-5 py-3 flex items-start gap-3">
                  <TaskCheck id={t.id} done={t.done} disabled={!perm.contribute} />
                  <div className="flex-1 min-w-0">
                    <div className={cx("text-[14px]", t.done && "line-through text-muted")}>{t.title}</div>
                    <div className="text-[12px] text-muted flex flex-wrap gap-x-3">
                      <span>{t.assigneeId ? names[t.assigneeId] : "Unassigned"}</span>
                      {t.dueDate && <span className={!t.done && d! < 0 ? "text-danger font-medium" : ""}>{!t.done && d! < 0 ? `Overdue (${fmtDate(t.dueDate)})` : `Due ${fmtDate(t.dueDate)}`}</span>}
                      {t.recurring && <span>↻ {t.recurring}</span>}
                      {t.auto && <span>Auto-generated by workflow</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function NotesTab({ b, names, perm, leadName, reporterPortal }: { b: CaseBundle; names: Names; perm: Perm; leadName: string | null; reporterPortal: boolean }) {
  return (
    <div className="space-y-5">
      {perm.contribute && (
        <Card>
          <AddNoteForm caseId={b.case.id} leadName={leadName} reporterPortal={reporterPortal} />
        </Card>
      )}
      {b.notes.length === 0 && (
        <Card>
          <Empty>No notes yet.</Empty>
        </Card>
      )}
      {b.notes.map((n) => (
        <div key={n.id} className="card p-5">
          <div className="flex items-center gap-2 text-[12.5px] text-muted mb-2">
            <b className="text-ink">{authorName(names, n.authorId)}</b>
            <span>{fmtDateTime(n.createdAt)}</span>
            <Badge tone={n.visibility === "External" ? "warn" : "neutral"}>{n.visibility === "External" ? "External · shared with reporter" : "Internal"}</Badge>
            {n.body.includes("(AI-assisted") && <AiBadge label="AI-assisted · reviewed" />}
          </div>
          <EditableNote id={n.id} body={n.body} history={n.history} canEdit={perm.contribute && n.authorId === perm.me} />
        </div>
      ))}
    </div>
  );
}

export function FindingsTab({ b, names, canApprove, perm, approverNames }: { b: CaseBundle; names: Names; canApprove: boolean; perm: Perm; approverNames: string[] }) {
  const latest = b.reports[0];
  if (!latest)
    return (
      <Card>
        <Empty>
          {perm.manage ? (
            <>
              No investigative report yet. Use <b>Draft investigative report</b> in the assistant to start one. You review and edit it before it&apos;s saved.
            </>
          ) : (
            "No investigative report yet."
          )}
        </Empty>
      </Card>
    );
  return (
    <div className="grid lg:grid-cols-[1fr_220px] gap-5">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="text-[15px] font-semibold">Investigative report · v{latest.version}</div>
          <Badge tone={latest.status === "Approved" ? "ok" : latest.status === "Pending approval" ? "warn" : latest.status === "Changes requested" ? "danger" : "neutral"}>{latest.status}</Badge>
          {latest.aiAssisted && <AiBadge label="AI-assisted · human-edited" />}
        </div>
        <ReportPanel report={latest} canEdit={perm.manage} canApprove={canApprove} approverNames={approverNames} names={names} />
      </div>
      <Card title="Version history" pad={false}>
        <ul className="divide-y divide-line">
          {b.reports.map((r) => (
            <li key={r.id} className="px-4 py-2.5 text-[13px]">
              <div className="font-medium">v{r.version} · {r.status}</div>
              <div className="text-[12px] text-muted">
                {names[r.authorId]} · {fmtDateTime(r.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  "Off work": "#3e4a4f",
  "Leave of absence": "#3e4a4f",
  "Temporary modified duty": "#7d8a8e",
  IAP: "#d9653f",
  "Permanent accommodation": "#4a55a2",
  Resolved: "#2f6b43",
};

export function StatusTab({ b }: { b: CaseBundle }) {
  const rtw = b.case.rtw;
  if (!rtw) return <Card><Empty>No work-status data.</Empty></Card>;
  const m = rtwMetrics(rtw);
  const total = m.periods.reduce((n, p) => n + p.days, 0) || 1;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card px-5 py-4">
          <div className="text-[13px] text-muted">Current status</div>
          <div className="text-[18px] font-semibold mt-1">{m.current.status}</div>
          <div className="text-[12.5px] text-muted">{m.currentDays} days</div>
        </div>
        <div className="card px-5 py-4">
          <div className="text-[13px] text-muted">Modified duty days</div>
          <div className={cx("text-[30px] font-semibold", m.modifiedDutyDays >= 170 ? "text-danger" : m.modifiedDutyDays >= 110 ? "text-warn" : "")}>{m.modifiedDutyDays}</div>
          <div className="text-[12.5px] text-muted">Alerts at 120 & 180</div>
        </div>
        <div className="card px-5 py-4">
          <div className="text-[13px] text-muted">Days off work / on leave</div>
          <div className="text-[30px] font-semibold">{m.offWorkDays}</div>
        </div>
        <div className="card px-5 py-4">
          <div className="text-[13px] text-muted">FMLA used</div>
          <div className={cx("text-[30px] font-semibold", m.fmlaPct >= 90 && "text-danger")}>{m.fmlaPct}%</div>
          <div className="text-[12.5px] text-muted">
            {rtw.fmlaHoursUsed} of {rtw.fmlaHoursEntitled} hrs{rtw.leaveExpires ? ` · leave expires ${fmtDate(rtw.leaveExpires)}` : ""}
          </div>
        </div>
      </div>
      <Card title="Stacked work-status timeline">
        <div className="flex h-9 rounded-lg overflow-hidden" role="img" aria-label="Work status over time">
          {m.periods.map((p, i) => (
            <div key={i} style={{ width: `${(p.days / total) * 100}%`, background: STATUS_COLOR[p.status] ?? "#999" }} className="text-white text-[11px] flex items-center px-2 whitespace-nowrap overflow-hidden" title={`${p.status}: ${p.days} days`}>
              {p.days > total * 0.12 && p.status}
            </div>
          ))}
        </div>
        <ol className="mt-5 relative border-l-2 border-line ml-2 space-y-4">
          {m.periods.map((p, i) => (
            <li key={i} className="pl-5 relative">
              <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full" style={{ background: STATUS_COLOR[p.status] ?? "#999" }} />
              <div className="text-[14px] font-medium">
                {p.status} <span className="text-muted font-normal text-[13px]">· {p.days} days</span>
              </div>
              <div className="text-[12.5px] text-muted">
                {fmtDate(p.start)} → {p.end ? fmtDate(p.end) : "present"}
              </div>
              {p.restrictions && <div className="text-[13px] mt-0.5">Restrictions: {p.restrictions}</div>}
            </li>
          ))}
        </ol>
      </Card>
      <div className="text-[12px] text-muted">
        {rtw.occupational ? `Occupational: workers' comp claim ${rtw.claimNumber} (County Policy 06-02)` : "Non-occupational"} · Leave data from the leave administrator&apos;s claim portal (simulated)
      </div>
    </div>
  );
}

export function AuditTab({ rows, names, caseId, chainOk }: { rows: (typeof auditLog.$inferSelect)[]; names: Names; caseId: string; chainOk: boolean }) {
  return (
    <Card
      title="Case audit trail"
      pad={false}
      right={
        <span className="flex items-center gap-3 text-[12px]">
          <span className={cx("inline-flex items-center gap-1", chainOk ? "text-ok" : "text-danger")}>
            <ShieldCheck size={13} /> {chainOk ? "Hash chain verified" : "Chain verification failed"}
          </span>
          <span className="text-muted">{rows.length} events</span>
          <a href={`/api/audit-export?case=${caseId}`} className="inline-flex items-center gap-1 underline">
            <Download size={12} /> Export CSV
          </a>
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">Every view, change, AI use and access denial on this case, oldest first</caption>
          <thead>
            <tr>
              <th>#</th>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Detail</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.seq}>
                <td className="tabular-nums text-muted">{r.seq}</td>
                <td className="whitespace-nowrap">{fmtDateTime(r.at)}</td>
                <td className="whitespace-nowrap">{r.userId ? (names[r.userId] ?? r.userId) : "System / public"}</td>
                <td>
                  <ActionBadge a={r.action} />
                </td>
                <td className="text-[12.5px] text-ink-2 max-w-[360px]">{detailText(r.detail)}</td>
                <td className="font-mono text-[11px] text-faint">{r.hash.slice(0, 10)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const ACTION_LABEL: Record<string, string> = {
  "case.view": "Viewed case",
  "case.view.metadata": "Viewed metadata",
  "case.created": "Case created",
  "case.assigned": "Assigned",
  "case.reassigned": "Reassigned",
  "case.stage_changed": "Stage changed",
  "case.closed": "Case closed",
  "case.reopened": "Case re-opened",
  "case.hold_placed": "Placed on hold",
  "case.hold_released": "Hold released",
  "case.linked": "Linked case",
  "case.unlinked": "Unlinked case",
  "legal_hold.placed": "Legal hold placed",
  "legal_hold.released": "Legal hold released",
  "access.changed": "Access changed",
  "authz.denied": "Access denied",
  "auth.login": "Signed in",
  "party.added": "Party added",
  "party.removed": "Party removed",
  "allegation.added": "Allegation added",
  "allegation.finding_set": "Finding set",
  "filing.recorded": "Agency filing recorded",
  "note.added": "Note added",
  "note.edited": "Note edited",
  "task.created": "Task created",
  "task.completed": "Task completed",
  "task.reopened": "Task re-opened",
  "interview.scheduled": "Interview scheduled",
  "interview.notes_saved": "Interview notes saved",
  "document.uploaded": "Document uploaded",
  "document.created": "Document created",
  "document.preview": "Document viewed",
  "document.download": "Document downloaded",
  "document.print": "Document printed",
  "correspondence.sent": "Letter sent",
  "report.saved": "Report saved",
  "report.commented": "Report comment",
  "report.exported": "Exported",
  "report.printed": "Report printed",
  "approval.requested": "Approval requested",
  "approval.granted": "Findings approved",
  "approval.changes_requested": "Changes requested",
  "ai.invoke": "AI used",
  "ai.disposition": "AI output reviewed",
  "ai.denied": "AI denied",
  "ai.blocked.disabled": "AI blocked (disabled)",
  "intake.submitted": "Intake submitted",
  "intake.viewed": "Intake viewed",
  "intake.dismissed": "Intake dismissed",
  "intake.restored": "Intake restored",
  "intake.status_checked": "Reporter checked status",
  "intake.status_check_failed": "Failed status lookup",
  "intake.reporter_message": "Reporter message",
  "admin.security_config_changed": "Security setting changed",
  "admin.audit_exported": "Audit log exported",
  "admin.access_review_attested": "Access review attested",
  "admin.permission_change_requested": "Permission change requested",
};

export const actionLabel = (a: string) => ACTION_LABEL[a] ?? a.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function ActionBadge({ a }: { a: string }) {
  const tone = a.startsWith("ai.") ? "ai" : a.startsWith("authz") || a.endsWith("_failed") ? "danger" : a.startsWith("admin") || a.startsWith("access") ? "warn" : "neutral";
  return (
    <span title={a}>
      <Badge tone={tone}>{actionLabel(a)}</Badge>
    </span>
  );
}

export function detailText(d: Record<string, unknown>) {
  return Object.entries(d)
    .filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export { Md };
