"use client";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Lock, Eye } from "lucide-react";
import { closeCase, reassignCase, reopenCase, setHold, setStage, toggleLegalHold } from "@/app/actions";
import { btn } from "@/components/ui";
import { Dialog, ErrorText, useAction } from "@/components/use-action";

export function CaseActions({
  caseId,
  stage,
  stages,
  status,
  legalHold,
  assigneeId,
  assignees,
  canManage,
  gate,
  closeNeedsReport,
  outcomes,
}: {
  caseId: string;
  stage: string;
  stages: string[];
  status: string;
  legalHold: boolean;
  assigneeId: string | null;
  assignees: { id: string; name: string }[];
  canManage: boolean;
  /** Why the next stage is blocked by the approval workflow, if it is. */
  gate: string | null;
  closeNeedsReport: boolean;
  outcomes: { label: string; findings: boolean }[];
}) {
  const [menu, setMenu] = useState(false);
  const [dlg, setDlg] = useState<null | "close" | "hold" | "reopen" | "legal">(null);
  const { pending, error, setError, run } = useAction();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!canManage)
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted border border-line rounded-lg px-2.5 py-1.5 bg-surface">
        <Eye size={13} /> Read-only for your role
      </span>
    );

  const idx = stages.indexOf(stage);
  const terminal = stages[stages.length - 1];
  const next = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;
  const nextIsTerminal = next === terminal;
  const closed = status === "Closed";
  const open = (d: typeof dlg) => {
    setError(null);
    setMenu(false);
    setDlg(d);
  };

  return (
    <div className="flex flex-col items-end gap-1.5" ref={ref}>
      <div className="flex items-center gap-2">
        {!closed && next && !nextIsTerminal && (
          <button disabled={pending || !!gate} className={btn("primary")} onClick={() => run(() => setStage(caseId, next))} aria-describedby={gate ? "stage-gate" : undefined}>
            {gate && <Lock size={13} />} Advance to {next}
          </button>
        )}
        {!closed && (nextIsTerminal || !next) && (
          <button disabled={pending} className={btn("primary")} onClick={() => open("close")}>
            Close case…
          </button>
        )}
        {closed && (
          <button disabled={pending} className={btn("secondary")} onClick={() => open("reopen")}>
            Re-open case…
          </button>
        )}
        <div className="relative">
          <button className={btn("secondary")} onClick={() => setMenu(!menu)} aria-label="More case actions" aria-haspopup="menu" aria-expanded={menu}>
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 mt-2 w-[260px] card shadow-xl z-40 py-1 text-[13.5px]">
              <div className="px-3 py-1.5 eyebrow">Reassign</div>
              {assignees.map((a) => (
                <button
                  role="menuitem"
                  key={a.id}
                  disabled={a.id === assigneeId || pending}
                  onClick={() => run(() => reassignCase(caseId, a.id), () => setMenu(false))}
                  className="w-full text-left px-3 py-1.5 hover:bg-sunken disabled:text-faint cursor-pointer"
                >
                  {a.name} {a.id === assigneeId && "(current)"}
                </button>
              ))}
              <div className="border-t border-line my-1" />
              {!closed && (
                <button role="menuitem" className="w-full text-left px-3 py-1.5 hover:bg-sunken cursor-pointer" onClick={() => (status === "On hold" ? run(() => setHold(caseId, null), () => setMenu(false)) : open("hold"))}>
                  {status === "On hold" ? "Release hold" : "Place case on hold…"}
                </button>
              )}
              <button role="menuitem" className="w-full text-left px-3 py-1.5 hover:bg-sunken cursor-pointer" onClick={() => open("legal")}>
                {legalHold ? "Release legal hold…" : "Place legal hold…"}
              </button>
              {!closed && (
                <button role="menuitem" className="w-full text-left px-3 py-1.5 hover:bg-sunken text-danger cursor-pointer" onClick={() => open("close")}>
                  Close case…
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {gate && !closed && (
        <p id="stage-gate" className="text-[12px] text-muted max-w-[340px] text-right">
          {gate}
        </p>
      )}
      <ErrorText error={dlg ? null : error} className="max-w-[340px]" />

      <CloseDialog open={dlg === "close"} onClose={() => setDlg(null)} outcomes={outcomes} gate={closeNeedsReport ? "report" : null} pending={pending} error={error} onSubmit={(o, n) => run(() => closeCase(caseId, o, n), () => setDlg(null))} />
      <ReasonDialog
        open={dlg === "hold"}
        title="Place case on hold"
        label="Reason for hold"
        placeholder="e.g. Respondent on extended leave; pending litigation"
        help="Deadline clocks and history are preserved while the case is on hold."
        action="Place on hold"
        pending={pending}
        error={error}
        onClose={() => setDlg(null)}
        onSubmit={(r) => run(() => setHold(caseId, r), () => setDlg(null))}
      />
      <ReasonDialog
        open={dlg === "reopen"}
        title="Re-open case"
        label="Reason for re-opening"
        placeholder="e.g. New evidence received; appeal granted"
        help="The prior outcome is kept in the audit trail."
        action="Re-open"
        pending={pending}
        error={error}
        onClose={() => setDlg(null)}
        onSubmit={(r) => run(() => reopenCase(caseId, r), () => setDlg(null))}
      />
      <Dialog open={dlg === "legal"} onClose={() => setDlg(null)} title={legalHold ? "Release legal hold" : "Place legal hold"}>
        <p className="text-[13.5px] text-ink-2">
          {legalHold
            ? "Releasing the hold returns the case record, documents and audit trail to the normal retention schedule."
            : "A legal hold suspends retention and purge for the case record, documents and audit trail until it's released."}
        </p>
        <ErrorText error={error} className="mt-3" />
        <div className="flex justify-end gap-2 mt-5">
          <button className={btn("ghost")} onClick={() => setDlg(null)}>
            Cancel
          </button>
          <button className={btn("primary")} disabled={pending} onClick={() => run(() => toggleLegalHold(caseId), () => setDlg(null))}>
            {legalHold ? "Release hold" : "Place hold"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function CloseDialog({
  open,
  onClose,
  outcomes,
  gate,
  pending,
  error,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  outcomes: { label: string; findings: boolean }[];
  gate: string | null;
  pending: boolean;
  error: string | null;
  onSubmit: (outcome: string, note: string) => void;
}) {
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const chosen = outcomes.find((o) => o.label === outcome);
  return (
    <Dialog open={open} onClose={onClose} title="Close case">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (outcome) onSubmit(outcome, note);
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="block text-[13px] font-medium mb-1">Outcome</span>
          <select className="field" value={outcome} onChange={(e) => setOutcome(e.target.value)} required>
            <option value="">Choose an outcome…</option>
            {outcomes.map((o) => (
              <option key={o.label}>{o.label}</option>
            ))}
          </select>
        </label>
        {chosen?.findings && gate && <p className="text-[12.5px] text-warn">This outcome states a finding, so it needs an approved investigative report first.</p>}
        <label className="block">
          <span className="block text-[13px] font-medium mb-1">Closing note (optional)</span>
          <textarea className="field min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <ErrorText error={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btn("ghost")} onClick={onClose}>
            Cancel
          </button>
          <button className={btn("primary")} disabled={pending || !outcome}>
            Close case
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ReasonDialog(props: { open: boolean; title: string; label: string; placeholder: string; help: string; action: string; pending: boolean; error: string | null; onClose: () => void; onSubmit: (r: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={props.open} onClose={props.onClose} title={props.title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim()) props.onSubmit(reason.trim());
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="block text-[13px] font-medium mb-1">{props.label}</span>
          <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={props.placeholder} required autoFocus />
        </label>
        <p className="text-[12.5px] text-muted">{props.help}</p>
        <ErrorText error={props.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btn("ghost")} onClick={props.onClose}>
            Cancel
          </button>
          <button className={btn("primary")} disabled={props.pending || !reason.trim()}>
            {props.action}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
