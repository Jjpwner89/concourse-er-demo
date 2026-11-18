"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertTriangle, UserSearch, ShieldCheck } from "lucide-react";
import { createCaseFromIntake, dismissIntake, runTriage } from "@/app/actions";
import { Dialog, ErrorText } from "@/components/use-action";
import { btn } from "@/components/ui";
import type { Triage } from "@/lib/ai/features";
import { AiBadge, Button, Badge } from "@/components/ui";
import type { CaseType } from "@/lib/db/schema";
import { TAXONOMY, TEAMS, TYPE_DEFAULTS, type Team } from "@/lib/taxonomy";

type Staff = { id: string; name: string; team: Team };

/** Prefer the current user if they're on the team, otherwise the first team member. */
function pickAssignee(staff: Staff[], team: string, me: string, current: string | null) {
  const members = staff.filter((u) => u.team === team);
  if (current && members.some((u) => u.id === current)) return current;
  return members.find((u) => u.id === me)?.id ?? members[0]?.id ?? null;
}

/** Starting values when AI triage is off or unavailable: the case manager triages by hand. */
function manualTriage(form: string): Triage {
  const caseType: CaseType = form === "EEO" ? "EEO" : form === "Accommodation" ? "RTW" : "ER";
  const d = TYPE_DEFAULTS[caseType];
  const category = Object.keys(TAXONOMY[caseType])[0];
  return {
    suggestedTitle: "",
    caseType,
    category,
    subtype: "",
    team: d.team,
    sensitivity: d.sensitivity,
    summary: "",
    overlapFlags: [],
    respondentMatches: [],
    accommodationNeeded: false,
    urgency: "routine",
  };
}

export function TriagePanel({ intakeId, staff, currentUserId, form }: { intakeId: string; staff: Staff[]; currentUserId: string; form: string }) {
  const [t, setT] = useState<Triage | null>(null);
  const [live, setLive] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    runTriage(intakeId).then((r) => {
      setLoading(false);
      if (!r.ok) {
        // AI is optional: fall back to a blank, editable triage form.
        const m = manualTriage(form);
        setErr(r.error);
        setManual(true);
        setT(m);
        setAssignee(pickAssignee(staff, m.team, currentUserId, null));
        return;
      }
      setT(r.data.triage);
      setAssignee(pickAssignee(staff, r.data.triage.team, currentUserId, null));
      setLive(r.data.live);
      setResp(r.data.triage.respondentMatches.filter((m) => m.confidence !== "low").map((m) => m.employeeId));
      setFlags(r.data.triage.overlapFlags);
    });
  }, [intakeId, staff, currentUserId, form]);

  const upd = (k: keyof Triage) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => t && setT({ ...t, [k]: e.target.value });

  // Case type drives routing (team, default sensitivity, valid categories). Routing never changes the case type.
  const changeType = (caseType: CaseType) => {
    if (!t) return;
    const d = TYPE_DEFAULTS[caseType];
    const cats = TAXONOMY[caseType];
    const category = t.category in cats ? t.category : Object.keys(cats)[0];
    const subtype = cats[category]?.includes(t.subtype) ? t.subtype : "";
    setT({ ...t, caseType, team: d.team, sensitivity: d.sensitivity, category, subtype });
    setAssignee((a) => pickAssignee(staff, d.team, currentUserId, a));
  };
  const changeTeam = (team: string) => {
    if (!t) return;
    setT({ ...t, team });
    setAssignee((a) => pickAssignee(staff, team, currentUserId, a));
  };

  // Keep any AI value that isn't in the taxonomy visible rather than silently dropping it.
  const cats = t ? TAXONOMY[t.caseType] : {};
  const catOptions = t ? [...Object.keys(cats), ...(t.category && !(t.category in cats) ? [t.category] : [])] : [];
  const subs = t ? (cats[t.category] ?? []) : [];
  const subOptions = t ? [...subs, ...(t.subtype && !subs.includes(t.subtype) ? [t.subtype] : [])] : [];
  const members = t ? staff.filter((u) => u.team === t.team) : [];

  return (
    <aside className="card overflow-hidden xl:sticky xl:top-[78px]" aria-label="AI triage">
      <header className="px-4 py-3 border-b border-line flex items-center gap-2 bg-ai-soft/60">
        <Sparkles size={16} className="text-ai" />
        <h2 className="font-semibold text-[14.5px]">{manual ? "Triage" : "AI triage"}</h2>
        {t && !manual && (
          <span className="ml-auto">
            <AiBadge label="Suggestions" live={live} />
          </span>
        )}
      </header>
      {loading && (
        <div className="p-6 text-[13.5px] text-muted flex items-center gap-2">
          <span className="thinking text-ai text-[18px] leading-none">
            <span>•</span>
            <span>•</span>
            <span>•</span>
          </span>
          Reading the submission and checking the HR directory…
        </div>
      )}
      {err && manual && (
        <div className="mx-4 mt-4 rounded-lg bg-sunken px-3 py-2.5 text-[12.5px] text-ink-2" role="status">
          AI suggestions are unavailable ({err.replace(/\.$/, "")}). Fill in the triage below. Case management works the same without AI.
        </div>
      )}
      {t && (
        <div className="p-4 space-y-4 text-[13.5px]">
          {t.summary && <div className="bg-sunken rounded-lg p-3 leading-relaxed">{t.summary}</div>}

          {flags.length > 0 || t.overlapFlags.length > 0 ? (
            <div className="space-y-1.5">
              {t.overlapFlags.map((f) => (
                <label key={f} className="flex gap-2 items-start bg-coral-soft border border-[#f2cdbd] rounded-lg p-2.5">
                  <input type="checkbox" checked={flags.includes(f)} onChange={(e) => setFlags(e.target.checked ? [...flags, f] : flags.filter((x) => x !== f))} className="mt-0.5" />
                  <AlertTriangle size={14} className="text-coral shrink-0 mt-0.5" />
                  <span>{f}</span>
                </label>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <L label="Case type">
              <select className="field" value={t.caseType} onChange={(e) => changeType(e.target.value as CaseType)}>
                {["EEO", "ER", "CI", "RTW"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </L>
            <L label="Sensitivity">
              <select className="field" value={t.sensitivity} onChange={upd("sensitivity")}>
                {["standard", "high", "eeo", "medical"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </L>
            <L label="Category">
              <select
                className="field"
                value={t.category}
                onChange={(e) => {
                  const category = e.target.value;
                  setT({ ...t, category, subtype: (cats[category] ?? []).includes(t.subtype) ? t.subtype : "" });
                }}
              >
                {catOptions.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </L>
            <L label="Subtype">
              <select className="field" value={t.subtype} onChange={upd("subtype")}>
                <option value="">None</option>
                {subOptions.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </L>
          </div>
          <L label="Case title">
            <input className="field" value={t.suggestedTitle} onChange={upd("suggestedTitle")} placeholder="Short neutral title, e.g. Harassment allegation — Yard 4" required />
          </L>

          <div>
            <div className="text-[12.5px] font-medium mb-1.5 flex items-center gap-1.5">
              <UserSearch size={13} /> Possible respondent matches (PeopleSoft)
            </div>
            {t.respondentMatches.length === 0 && <div className="text-muted text-[12.5px]">{manual ? "Add respondents and witnesses on the Parties tab after the case is created." : "No confident match. Add parties after the case is created."}</div>}
            {t.respondentMatches.map((m) => (
              <label key={m.employeeId} className="flex gap-2 items-start border border-line rounded-lg p-2.5 mb-1.5">
                <input type="checkbox" checked={resp.includes(m.employeeId)} onChange={(e) => setResp(e.target.checked ? [...resp, m.employeeId] : resp.filter((x) => x !== m.employeeId))} className="mt-0.5" />
                <span>
                  <b>{m.name}</b> <span className="text-muted font-mono text-[11.5px]">{m.employeeId}</span> <Badge tone={m.confidence === "high" ? "ok" : "warn"}>{m.confidence}</Badge>
                  <span className="block text-[12.5px] text-muted">{m.reason}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <L label="Route to">
              <select className="field" value={t.team} onChange={(e) => changeTeam(e.target.value)}>
                {TEAMS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </L>
            <L label="Assign to">
              <select className="field" value={assignee ?? ""} onChange={(e) => setAssignee(e.target.value || null)}>
                <option value="">Team queue</option>
                {members.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </L>
          </div>
          <div className="-mt-2 text-[11.5px] text-muted">Changing the case type updates routing, sensitivity and categories. You can still override routing.</div>
          <div className="flex items-center gap-2 text-[12.5px] text-muted">
            Urgency: <Badge tone={t.urgency === "routine" ? "neutral" : "warn"}>{t.urgency}</Badge>
            {t.accommodationNeeded && <Badge tone="coral">Needs accommodation to participate</Badge>}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              disabled={pending || !t.suggestedTitle.trim()}
              onClick={() =>
                start(async () => {
                  setCreateErr(null);
                  const r = await createCaseFromIntake(intakeId, { ...t, overlapFlags: flags, respondentIds: resp, assigneeId: assignee });
                  if (!r.ok) return setCreateErr(r.error);
                  // Routed to another team? Return to the queue with a confirmation instead of a wall.
                  if (r.data.accessible) router.push(`/cases/${r.data.caseId}`);
                  else router.push(`/intake?routed=${encodeURIComponent(r.data.number)}&team=${encodeURIComponent(r.data.team)}`);
                })
              }
            >
              {manual ? "Create case" : "Accept & create case"}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setDismissOpen(true)}>
              Dismiss…
            </Button>
          </div>
          <ErrorText error={createErr} />
          <div className="text-[11.5px] text-muted flex gap-1.5 leading-snug">
            <ShieldCheck size={13} className="shrink-0 mt-px" /> {manual ? "Your triage decisions are recorded in the audit trail." : "These are suggestions. You confirm the type, routing and parties. Your choices and the AI's suggestions are both recorded."}
          </div>
        </div>
      )}
      <Dialog open={dismissOpen} onClose={() => setDismissOpen(false)} title="Dismiss intake">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setCreateErr(null);
              const r = await dismissIntake(intakeId, dismissReason);
              if (!r.ok) return setCreateErr(r.error);
              setDismissOpen(false);
              router.push("/intake?dismissed=1");
            });
          }}
        >
          <label className="block">
            <span className="block text-[13px] font-medium mb-1">Reason</span>
            <select className="field" value={dismissReason} onChange={(e) => setDismissReason(e.target.value)} required>
              <option value="">Choose a reason…</option>
              {["Duplicate of an existing report", "Not a workplace matter / outside HR jurisdiction", "Referred to another department", "Test or spam submission", "Insufficient information and no way to follow up"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <p className="text-[12.5px] text-muted">Dismissed intakes stay in the queue&apos;s Dismissed list and can be restored. The reason is recorded in the audit trail.</p>
          <ErrorText error={createErr} />
          <div className="flex justify-end gap-2">
            <button type="button" className={btn("ghost")} onClick={() => setDismissOpen(false)}>
              Cancel
            </button>
            <button className={btn("danger")} disabled={pending || !dismissReason}>
              Dismiss intake
            </button>
          </div>
        </form>
      </Dialog>
    </aside>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}
