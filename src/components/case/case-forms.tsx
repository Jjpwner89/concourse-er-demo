"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Upload, FileText, Eye, Download, Pencil, History, Printer, Send, Trash2, Plus, Unlink } from "lucide-react";
import {
  addAllegation,
  addFiling,
  addNote,
  addParty,
  addTask,
  commentOnReport,
  decideReport,
  editNote,
  linkCase,
  markLetterSent,
  removeParty,
  saveInterviewNotes,
  saveReportEdit,
  scheduleInterview,
  setAllegationFinding,
  submitReport,
  toggleTask,
  unlinkCase,
} from "@/app/actions";
import { Button, Md, btn, cx } from "@/components/ui";
import { Dialog, ErrorText, useAction } from "@/components/use-action";
import { dayFromToday, fmtDateTime, todayISO } from "@/lib/format";
import { FILING_AGENCIES, FINDINGS, PARTY_ROLES } from "@/lib/taxonomy";

// ───────────── Tasks ─────────────

export function TaskCheck({ id, done, disabled }: { id: number; done: boolean; disabled?: boolean }) {
  const { pending, run } = useAction();
  return (
    <button
      aria-label={done ? "Mark task not done" : "Mark task done"}
      aria-pressed={done}
      disabled={pending || disabled}
      onClick={() => run(() => toggleTask(id))}
      className={cx("w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-default", done ? "bg-ok border-ok text-white" : "border-line-strong bg-surface hover:border-slate-2")}
    >
      {done && <Check size={12} strokeWidth={3} />}
    </button>
  );
}

export function AddTaskForm({ caseId, people, me }: { caseId: string; people: { id: string; name: string }[]; me: string }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(() => dayFromToday(7));
  const [rec, setRec] = useState("");
  const [who, setWho] = useState(me);
  const { pending, error, run } = useAction();
  return (
    <form
      className="flex flex-wrap gap-2 items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        run(() => addTask(caseId, title.trim(), due, rec || null, who), () => setTitle(""));
      }}
    >
      <input className="field flex-1 min-w-[220px]" placeholder="New task…" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task title" />
      <input type="date" className="field !w-auto" value={due} min={todayISO()} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
      <select className="field !w-auto" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Assign to">
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id === me ? "Me" : p.name}
          </option>
        ))}
      </select>
      <select className="field !w-auto" value={rec} onChange={(e) => setRec(e.target.value)} aria-label="Recurrence">
        <option value="">One-time</option>
        <option>Every week</option>
        <option>Every 2 weeks</option>
        <option>Every month</option>
      </select>
      <Button disabled={pending}>Add task</Button>
      <ErrorText error={error} className="w-full" />
    </form>
  );
}

// ───────────── Notes ─────────────

export function AddNoteForm({ caseId, leadName, reporterPortal }: { caseId: string; leadName: string | null; reporterPortal: boolean }) {
  const [body, setBody] = useState("");
  const [vis, setVis] = useState<"Internal" | "External">("Internal");
  const [share, setShare] = useState(false);
  const { pending, error, run } = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        run(() => addNote(caseId, body.trim(), vis, share), () => {
          setBody("");
          setShare(false);
        });
      }}
      className="space-y-2"
    >
      <textarea className="field min-h-[90px]" placeholder="Add a case note. Supports **bold** and - bullet lists." value={body} onChange={(e) => setBody(e.target.value)} aria-label="Note" />
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Visibility</span>
          <select className="field !w-auto !py-1.5" value={vis} onChange={(e) => setVis(e.target.value as "Internal")} aria-describedby="vis-help">
            <option value="Internal">Internal: case team only</option>
            <option value="External">External: shared with the reporter</option>
          </select>
        </label>
        {leadName && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Notify {leadName}
          </label>
        )}
        <Button className="ml-auto" disabled={pending}>
          Add note
        </Button>
      </div>
      <p id="vis-help" className="text-[12px] text-muted">
        {vis === "External"
          ? reporterPortal
            ? "External notes appear in the reporter's follow-up portal (anonymous reporters see them with their code). Don't include other parties' information."
            : "External notes are suitable to share with the complainant or employee. This case didn't come from the portal, so send them by letter or email."
          : "Internal notes are visible only to staff authorized on this case."}
      </p>
      <ErrorText error={error} />
    </form>
  );
}

export function EditableNote({ id, body, history, canEdit }: { id: number; body: string; history: { body: string; at: string }[]; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);
  const [showHist, setShowHist] = useState(false);
  const { pending, error, run } = useAction();
  if (editing)
    return (
      <div className="space-y-2">
        <textarea className="field min-h-[90px]" value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit note" />
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => editNote(id, text), () => setEditing(false))}>
            Save (keeps history)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        <ErrorText error={error} />
      </div>
    );
  return (
    <div>
      <Md text={body} className="text-[14px]" />
      <div className="flex gap-3 mt-1.5 text-[12px] text-muted">
        {canEdit && (
          <button className="inline-flex items-center gap-1 hover:text-ink cursor-pointer" onClick={() => setEditing(true)}>
            <Pencil size={11} /> Edit
          </button>
        )}
        {history.length > 0 && (
          <button className="inline-flex items-center gap-1 hover:text-ink cursor-pointer" onClick={() => setShowHist(!showHist)} aria-expanded={showHist}>
            <History size={11} /> {history.length} prior version{history.length > 1 ? "s" : ""}
          </button>
        )}
      </div>
      {showHist && (
        <div className="mt-2 space-y-2 border-l-2 border-line pl-3">
          {history.map((h, i) => (
            <div key={i} className="text-[12.5px] text-muted">
              <div className="text-[11px]">{fmtDateTime(h.at)}</div>
              <div className="line-through decoration-faint">{h.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────── Interviews ─────────────

const localDateTime = (days: number, time: string) => `${dayFromToday(days)}T${time}`;

export function ScheduleInterviewForm({ caseId, parties }: { caseId: string; parties: { name: string; role: string }[] }) {
  const [party, setParty] = useState(parties[0] ? `${parties[0].name}|${parties[0].role}` : "");
  const [when, setWhen] = useState(() => localDateTime(3, "10:00"));
  const [sent, setSent] = useState(false);
  const { pending, error, run } = useAction();
  if (!parties.length) return <p className="text-[13px] text-muted">Add a named party or witness on the Parties tab to schedule an interview.</p>;
  return (
    <form
      className="flex flex-wrap gap-2 items-center"
      onSubmit={(e) => {
        e.preventDefault();
        const [n, r] = party.split("|");
        // Convert the browser's local time to an absolute timestamp so the server can't shift it.
        run(() => scheduleInterview(caseId, n, r, new Date(when).toISOString()), () => {
          setSent(true);
          setTimeout(() => setSent(false), 3000);
        });
      }}
    >
      <select className="field !w-auto" value={party} onChange={(e) => setParty(e.target.value)} aria-label="Interviewee">
        {parties.map((p) => (
          <option key={p.name + p.role} value={`${p.name}|${p.role}`}>
            {p.name} ({p.role})
          </option>
        ))}
      </select>
      <input type="datetime-local" className="field !w-auto" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Date and time" />
      <Button disabled={pending}>Schedule & send Outlook invite</Button>
      {sent && (
        <span role="status" className="text-[12.5px] text-ok">
          ✓ Invite sent (simulated Outlook integration)
        </span>
      )}
      <ErrorText error={error} className="w-full" />
    </form>
  );
}

export function InterviewNotesEditor({ id, initial }: { id: number; initial: string | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial ?? "");
  const { pending, error, run } = useAction();
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-[12.5px] underline text-ink-2 cursor-pointer">
        {initial ? "Edit notes" : "Add interview notes"}
      </button>
    );
  return (
    <div className="space-y-2 mt-2 w-full">
      <textarea className="field min-h-[160px] font-mono text-[12.5px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or type interview notes…" aria-label="Interview notes" />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !text.trim()} onClick={() => run(() => saveInterviewNotes(id, text), () => setOpen(false))}>
          Save notes & mark completed
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}

// ───────────── Documents ─────────────

export function UploadZone({ caseId, isRtw }: { caseId: string; isRtw: boolean }) {
  const [over, setOver] = useState(false);
  const [kind, setKind] = useState("Evidence");
  const [medicalBox, setMedicalBox] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const medical = kind === "Medical" || medicalBox;
  const send = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    setMsg("");
    const fd = new FormData();
    fd.set("caseId", caseId);
    fd.set("kind", kind);
    fd.set("medical", String(medical));
    for (const f of Array.from(files)) fd.append("files", f);
    const r = await fetch("/api/documents", { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ ok: false, error: "Upload failed." }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setMsg(`Uploaded ${r.saved.length} file${r.saved.length > 1 ? "s" : ""}${r.medical ? " to the restricted medical tier" : ""}. Hash recorded in the audit trail.`);
    router.refresh();
  };
  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          send(e.dataTransfer.files);
        }}
        className={cx("block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition focus-within:ring-2 focus-within:ring-slate-2", over ? "border-slate-2 bg-slate-4/50" : "border-line-strong bg-sunken")}
      >
        <Upload className="mx-auto text-muted" size={20} aria-hidden />
        <div className="text-[13.5px] mt-1.5">
          Drag & drop files, or <span className="underline">browse</span>
        </div>
        <div className="text-[12px] text-muted">PDF, Word, email (.msg/.eml), images, audio, video · up to 4 MB each in this prototype</div>
        <input type="file" multiple className="sr-only" onChange={(e) => send(e.target.files)} aria-label="Upload documents" />
      </label>
      <div className="flex flex-wrap items-center gap-3 mt-2 text-[13px]">
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Type</span>
          <select className="field !w-auto !py-1.5" value={kind} onChange={(e) => setKind(e.target.value)}>
            {["Evidence", "Statement", "Correspondence", "Report", "Medical"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        {isRtw && kind !== "Medical" && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={medicalBox} onChange={(e) => setMedicalBox(e.target.checked)} /> Contains medical information
          </label>
        )}
        {medical && <span className="text-coral text-[12.5px]">Stored in the restricted medical tier. Only Return-to-Work staff can open it.</span>}
        {busy && <span className="text-muted">Uploading…</span>}
        {msg && (
          <span role="status" className="text-ok">
            {msg}
          </span>
        )}
      </div>
      <ErrorText error={error} className="mt-1" />
    </div>
  );
}

export function DocActions({ doc, canSend, defaultRecipient }: { doc: { id: number; name: string; kind: string; mime: string | null; hasFile: boolean; content: string | null; sentAt: string | null; sentTo: string | null }; canSend: boolean; defaultRecipient: string }) {
  const [open, setOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const src = `/api/documents/${doc.id}`;
  const inlineType = doc.hasFile && doc.mime ? (doc.mime === "application/pdf" ? "pdf" : /^image\/(png|jpeg|gif|webp)$/.test(doc.mime) ? "image" : doc.mime.startsWith("text/") ? "text" : "none") : "text";
  return (
    <div className="flex gap-1 justify-end items-center">
      <button className="p-1.5 rounded hover:bg-sunken cursor-pointer" aria-label={`Preview ${doc.name}`} title="Preview" onClick={() => setOpen(true)}>
        <Eye size={14} />
      </button>
      <a className="p-1.5 rounded hover:bg-sunken" aria-label={`Download ${doc.name}`} title="Download" href={`${src}?mode=download`}>
        <Download size={14} />
      </a>
      <a className="p-1.5 rounded hover:bg-sunken" aria-label={`Print ${doc.name}`} title="Print" href={`${src}?mode=print`} target="_blank" rel="noopener">
        <Printer size={14} />
      </a>
      {canSend && doc.kind === "Correspondence" && !doc.sentAt && (
        <button className={btn("secondary", "sm")} onClick={() => setSendOpen(true)}>
          <Send size={12} /> Mark sent
        </button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={doc.name} wide>
        <div className="text-[12px] text-muted mb-2 flex items-center gap-1.5">
          <FileText size={13} /> Viewing is recorded in the audit trail
        </div>
        {open &&
          (inlineType === "pdf" ? (
            <iframe src={src} title={doc.name} className="w-full h-[65vh] rounded-lg border border-line bg-sunken" />
          ) : inlineType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={doc.name} className="max-h-[65vh] mx-auto rounded-lg border border-line" />
          ) : inlineType === "text" ? (
            <iframe src={src} title={doc.name} className="w-full h-[65vh] rounded-lg border border-line bg-white" />
          ) : (
            <div className="bg-sunken rounded-lg p-6 text-center text-[13.5px]">
              Preview isn&apos;t available for this file type.{" "}
              <a className="underline" href={`${src}?mode=download`}>
                Download it
              </a>{" "}
              to open it in its own application.
            </div>
          ))}
      </Dialog>
      <SendDialog open={sendOpen} onClose={() => setSendOpen(false)} docId={doc.id} defaultRecipient={defaultRecipient} />
    </div>
  );
}

function SendDialog({ open, onClose, docId, defaultRecipient }: { open: boolean; onClose: () => void; docId: number; defaultRecipient: string }) {
  const [to, setTo] = useState(defaultRecipient);
  const [channel, setChannel] = useState("Email (Outlook)");
  const { pending, error, run } = useAction();
  return (
    <Dialog open={open} onClose={onClose} title="Record letter as sent">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => markLetterSent(docId, to, channel), onClose);
        }}
      >
        <label className="block">
          <span className="block text-[13px] font-medium mb-1">Recipient</span>
          <input className="field" value={to} onChange={(e) => setTo(e.target.value)} required />
        </label>
        <label className="block">
          <span className="block text-[13px] font-medium mb-1">Sent by</span>
          <select className="field" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {["Email (Outlook)", "Certified mail", "Hand delivered", "Posted to follow-up portal"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <p className="text-[12.5px] text-muted">Records the date, recipient and method on the document and in the audit trail. Outlook sending is simulated in this prototype.</p>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btn("ghost")} onClick={onClose}>
            Cancel
          </button>
          <button className={btn("primary")} disabled={pending}>
            Record as sent
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ───────────── Report & approval ─────────────

export function ReportPanel({
  report,
  canEdit,
  canApprove,
  approverNames,
  names,
}: {
  report: { id: number; version: number; body: string; status: string; aiAssisted: boolean; authorId: string; comments: { authorId: string; body: string; at: string }[] };
  canEdit: boolean;
  canApprove: boolean;
  approverNames: string[];
  names: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(report.body);
  const [comment, setComment] = useState("");
  const [changesOpen, setChangesOpen] = useState(false);
  const [changes, setChanges] = useState("");
  const { pending, error, run } = useAction();
  const editable = report.status === "Draft" || report.status === "Changes requested";
  return (
    <div>
      {editing ? (
        <div className="space-y-2">
          <textarea className="field doc min-h-[420px]" value={text} onChange={(e) => setText(e.target.value)} aria-label="Report text" />
          <div className="flex gap-2">
            <Button disabled={pending} onClick={() => run(() => saveReportEdit(report.id, text), () => setEditing(false))}>
              Save as v{report.version + 1}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="doc whitespace-pre-wrap bg-surface border border-line rounded-lg px-8 py-7 max-h-[560px] overflow-auto" tabIndex={0} aria-label="Report text">
          {report.body}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {editable && canEdit && !editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={13} /> Edit
          </Button>
        )}
        {editable && canEdit && !editing && (
          <Button disabled={pending} onClick={() => run(() => submitReport(report.id))}>
            Submit for approval
          </Button>
        )}
        {report.status === "Pending approval" && canApprove && (
          <>
            <Button disabled={pending} onClick={() => run(() => decideReport(report.id, "Approved"))}>
              <Check size={14} /> Approve findings
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setChangesOpen(true)}>
              Request changes…
            </Button>
          </>
        )}
        {report.status === "Pending approval" && !canApprove && (
          <span className="text-[12.5px] text-muted">Awaiting approval from {approverNames.length ? approverNames.join(" or ") : "an approver"}. Approvers can&apos;t be the author or the assigned investigator.</span>
        )}
        <a href={`/print/report/${report.id}`} target="_blank" rel="noopener" className={cx(btn("ghost"), "ml-auto")}>
          <Printer size={13} /> Print / PDF
        </a>
      </div>
      <ErrorText error={error} className="mt-2" />
      <Dialog open={changesOpen} onClose={() => setChangesOpen(false)} title="Request changes">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => decideReport(report.id, "Changes requested", changes), () => {
              setChangesOpen(false);
              setChanges("");
            });
          }}
        >
          <label className="block">
            <span className="block text-[13px] font-medium mb-1">What needs to change?</span>
            <textarea className="field min-h-[100px]" value={changes} onChange={(e) => setChanges(e.target.value)} required autoFocus />
          </label>
          <p className="text-[12.5px] text-muted">Your comment goes to {names[report.authorId] ?? "the author"} with the report.</p>
          <ErrorText error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className={btn("ghost")} onClick={() => setChangesOpen(false)}>
              Cancel
            </button>
            <button className={btn("primary")} disabled={pending || !changes.trim()}>
              Send back for changes
            </button>
          </div>
        </form>
      </Dialog>
      <div className="mt-6">
        <h3 className="eyebrow mb-2">Review comments</h3>
        {report.comments.length === 0 && <div className="text-[13px] text-muted mb-2">No comments yet.</div>}
        <ul className="space-y-2 mb-3">
          {report.comments.map((c, i) => (
            <li key={i} className="card px-3.5 py-2.5 text-[13.5px]">
              <div className="text-[12px] text-muted">
                <b className="text-ink">{names[c.authorId]}</b> · {fmtDateTime(c.at)}
              </div>
              {c.body}
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!comment.trim()) return;
            run(() => commentOnReport(report.id, comment.trim()), () => setComment(""));
          }}
        >
          <input className="field" placeholder="Comment on this draft…" value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Comment" />
          <Button variant="secondary" disabled={pending}>
            Comment
          </Button>
        </form>
      </div>
    </div>
  );
}

// ───────────── Parties ─────────────

type Emp = { id: string; name: string; title: string; department: string };

export function AddPartyForm({ caseId, employees }: { caseId: string; employees: Emp[] }) {
  const [role, setRole] = useState<string>("Witness");
  const [q, setQ] = useState("");
  const [emp, setEmp] = useState<Emp | null>(null);
  const [external, setExternal] = useState(false);
  const [name, setName] = useState("");
  const [result, setResult] = useState<{ gained: string[]; lost: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = useAction();
  const matches = q.trim().length >= 2 ? employees.filter((e) => `${e.name} ${e.id} ${e.title}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        run(async () => {
          const r = await addParty(caseId, { role, employeeId: external ? null : (emp?.id ?? null), name: external ? name : (emp?.name ?? "") });
          if (!r.ok) setError(r.error);
          else {
            setResult(r.data);
            setEmp(null);
            setQ("");
            setName("");
          }
        });
      }}
    >
      <div className="flex flex-wrap gap-2 items-start">
        <select className="field !w-auto" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Party role">
          {PARTY_ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        {external ? (
          <input className="field flex-1 min-w-[220px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name (non-employee)" aria-label="Name" />
        ) : emp ? (
          <div className="field flex-1 min-w-[220px] flex items-center gap-2 !py-1.5">
            <b>{emp.name}</b> <span className="text-muted text-[12.5px]">{emp.title} · {emp.department}</span>
            <button type="button" className="ml-auto text-[12px] underline cursor-pointer" onClick={() => setEmp(null)}>
              Change
            </button>
          </div>
        ) : (
          <div className="relative flex-1 min-w-[220px]">
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search HRIS by name, ID or title…" aria-label="Search employees" role="combobox" aria-expanded={matches.length > 0} aria-controls="emp-list" aria-autocomplete="list" />
            {matches.length > 0 && (
              <ul id="emp-list" role="listbox" className="absolute z-30 left-0 right-0 mt-1 card shadow-lg py-1 max-h-60 overflow-auto">
                {matches.map((m) => (
                  <li key={m.id} role="option" aria-selected={false}>
                    <button type="button" className="w-full text-left px-3 py-1.5 hover:bg-sunken text-[13px] cursor-pointer" onClick={() => setEmp(m)}>
                      <b>{m.name}</b> <span className="text-muted">{m.id} · {m.title} · {m.department}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <Button disabled={pending || (external ? !name.trim() : !emp)}>
          <Plus size={13} /> Add party
        </Button>
      </div>
      <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
        <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} /> Not a County employee (applicant, contractor, member of the public)
      </label>
      {result && (
        <p role="status" className="text-[12.5px] text-ok">
          ✓ Added. Access re-evaluated{result.lost.length ? `: ${result.lost.join(", ")} now recused (reporting chain or party).` : ": no one's access changed."}
        </p>
      )}
      <ErrorText error={error} />
    </form>
  );
}

export function RemovePartyButton({ id, label }: { id: number; label: string }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run } = useAction();
  return (
    <>
      <button className="p-1 rounded text-muted hover:text-danger hover:bg-sunken cursor-pointer" aria-label={`Remove ${label}`} onClick={() => setOpen(true)}>
        <Trash2 size={13} />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Remove party">
        <p className="text-[13.5px]">Remove {label} from this case? The removal is recorded in the audit trail and access is re-evaluated.</p>
        <ErrorText error={error} className="mt-2" />
        <div className="flex justify-end gap-2 mt-4">
          <button className={btn("ghost")} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className={btn("danger")} disabled={pending} onClick={() => run(() => removeParty(id), () => setOpen(false))}>
            Remove
          </button>
        </div>
      </Dialog>
    </>
  );
}

// ───────────── Allegations ─────────────

export function AddAllegationForm({ caseId, categories }: { caseId: string; categories: string[] }) {
  const [cat, setCat] = useState(categories[0] ?? "");
  const [desc, setDesc] = useState("");
  const { pending, error, run } = useAction();
  return (
    <form
      className="flex flex-wrap gap-2 items-start"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addAllegation(caseId, cat, desc), () => setDesc(""));
      }}
    >
      <select className="field !w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Allegation category">
        {categories.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <input className="field flex-1 min-w-[240px]" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What is alleged (who, what, when)" aria-label="Allegation description" />
      <Button disabled={pending || !desc.trim()}>
        <Plus size={13} /> Add allegation
      </Button>
      <ErrorText error={error} className="w-full" />
    </form>
  );
}

export function FindingSelect({ id, value }: { id: number; value: string }) {
  const { pending, error, run } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-1.5 text-[12.5px]">
        <span className="text-muted">Finding</span>
        <select className="field !w-auto !py-1 text-[12.5px]" value={value} disabled={pending} onChange={(e) => run(() => setAllegationFinding(id, e.target.value))}>
          {FINDINGS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <ErrorText error={error} />
    </div>
  );
}

// ───────────── Linked cases & external filings ─────────────

export function LinkCaseForm({ caseId, options }: { caseId: string; options: { id: string; number: string; title: string }[] }) {
  const [other, setOther] = useState("");
  const { pending, error, run } = useAction();
  if (!options.length) return null;
  return (
    <form
      className="flex gap-2 mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (other) run(() => linkCase(caseId, other), () => setOther(""));
      }}
    >
      <select className="field !py-1.5 text-[12.5px]" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Case to link">
        <option value="">Link a related case…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.number} · {o.title.slice(0, 40)}
          </option>
        ))}
      </select>
      <Button size="sm" variant="secondary" disabled={pending || !other}>
        Link
      </Button>
      <ErrorText error={error} />
    </form>
  );
}

export function UnlinkButton({ caseId, otherId, label }: { caseId: string; otherId: string; label: string }) {
  const { pending, run } = useAction();
  return (
    <button className="p-0.5 text-muted hover:text-danger cursor-pointer" aria-label={`Unlink ${label}`} title="Unlink" disabled={pending} onClick={() => run(() => unlinkCase(caseId, otherId))}>
      <Unlink size={12} />
    </button>
  );
}

export function AddFilingForm({ caseId }: { caseId: string }) {
  const [agency, setAgency] = useState(FILING_AGENCIES[0]);
  const [num, setNum] = useState("");
  const [filed, setFiled] = useState(() => todayISO());
  const [status, setStatus] = useState("Open");
  const { pending, error, run } = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      className="flex flex-wrap gap-2 items-center px-5 py-3 border-t border-line"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addFiling(caseId, { agency, number: num, filed, status }), () => setNum(""));
      }}
    >
      <select className="field !w-auto !py-1.5 text-[12.5px]" value={agency} onChange={(e) => setAgency(e.target.value)} aria-label="Agency">
        {FILING_AGENCIES.map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
      <input className="field !w-[170px] !py-1.5 text-[12.5px] font-mono" value={num} onChange={(e) => setNum(e.target.value)} placeholder="Charge / case #" aria-label="Charge or case number" />
      <input type="date" className="field !w-auto !py-1.5 text-[12.5px]" value={filed} max={todayISO()} onChange={(e) => setFiled(e.target.value)} aria-label="Filed date" />
      <select className="field !w-auto !py-1.5 text-[12.5px]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filing status">
        {["Open", "Position statement due", "Mediation", "Right to sue issued", "Closed"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <Button size="sm" variant="secondary" disabled={pending || !num.trim()}>
        <Plus size={12} /> Record filing
      </Button>
      <ErrorText error={error} className="w-full" />
    </form>
  );
}
