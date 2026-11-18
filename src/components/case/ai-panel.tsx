"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, FileText, ListChecks, Network, MessageSquare, ScrollText, ShieldCheck, ArrowUp, X } from "lucide-react";
import { disposeDraft, runCaseAI, runSimilar } from "@/app/actions";
import { AiBadge, Button, Md, cx } from "@/components/ui";
import { LETTERS } from "@/lib/taxonomy";
import type { CaseType } from "@/lib/db/schema";

type Feature = "summarize" | "next_steps" | "draft_report" | "ask" | "interview_summary" | "letters" | "similar_cases";
type Item = {
  key: string;
  draftId?: number;
  feature: Feature;
  label: string;
  content?: string;
  live?: boolean;
  status: "loading" | "ready" | "Accepted" | "Edited & accepted" | "Discarded" | "error";
  error?: string;
  savedTo?: string | null;
  matches?: { id: string; number: string; title: string; reasons: string[] }[];
};

const LABEL: Record<Feature, string> = {
  summarize: "Case summary",
  next_steps: "Suggested next steps",
  draft_report: "Investigative report draft",
  ask: "Answer",
  interview_summary: "Interview summary",
  letters: "Letter draft",
  similar_cases: "Related matters",
};

export function AiPanel({
  caseId,
  caseType,
  canManage,
  enabled,
  live,
  interviews,
}: {
  caseId: string;
  caseType: string;
  canManage: boolean;
  enabled: Record<string, boolean>;
  live: boolean;
  interviews: { id: number; label: string }[];
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"en" | "es">("en");
  const [, start] = useTransition();
  const anyOn = Object.values(enabled).some(Boolean);
  const seq = useRef(0);

  const run = (feature: Feature, label: string, extra: { question?: string; interviewId?: number; letterType?: string; language?: string } = {}) => {
    const key = String(++seq.current);
    setItems((xs) => [{ key, feature, label, status: "loading" }, ...xs]);
    start(async () => {
      if (feature === "similar_cases") {
        const r = await runSimilar(caseId);
        setItems((xs) => xs.map((x) => (x.key === key ? (r.ok ? { ...x, status: "ready", draftId: r.data.draft.id, content: r.data.draft.content, live: r.data.draft.live, matches: r.data.matches } : { ...x, status: "error", error: r.error }) : x)));
        return;
      }
      const r = await runCaseAI(caseId, feature as Exclude<Feature, "similar_cases">, extra);
      setItems((xs) => xs.map((x) => (x.key === key ? (r.ok && r.data ? { ...x, status: "ready", draftId: r.data.id, content: r.data.content, live: r.data.live } : { ...x, status: "error", error: r.ok ? "No result" : r.error }) : x)));
    });
  };

  const actions: { f: Feature; label: string; icon: React.ReactNode; show: boolean; extra?: { letterType?: string } }[] = [
    { f: "summarize", label: "Summarize case", icon: <FileText size={14} />, show: enabled.summarize },
    { f: "next_steps", label: "Suggest next steps", icon: <ListChecks size={14} />, show: enabled.next_steps },
    { f: "similar_cases", label: "Find related cases", icon: <Network size={14} />, show: enabled.similar_cases },
    { f: "draft_report", label: "Draft investigative report", icon: <ScrollText size={14} />, show: enabled.draft_report && caseType !== "RTW" && canManage },
  ];
  const letters = canManage ? (LETTERS[caseType as CaseType] ?? []) : [];

  return (
    <aside className="xl:sticky xl:top-[78px] card overflow-hidden flex flex-col xl:max-h-[calc(100vh-100px)]" aria-label="AI assistant">
      <header className="px-4 py-3 border-b border-line flex items-center gap-2 bg-ai-soft/60">
        <Sparkles size={16} className="text-ai" />
        <div className="font-semibold text-[14.5px]">Case assistant</div>
        <span className="ml-auto text-[11px] text-muted">{live ? "Claude · live" : "Offline demo"}</span>
      </header>

      {!anyOn ? (
        <div className="p-5 text-[13.5px] text-muted">AI capabilities are turned off by your administrator. Case management works normally without them.</div>
      ) : (
        <>
          <div className="p-3 grid grid-cols-2 gap-1.5 border-b border-line">
            {actions
              .filter((a) => a.show)
              .map((a) => (
                <button key={a.f} onClick={() => run(a.f, a.label)} className="flex items-center gap-1.5 text-left text-[12.5px] px-2.5 py-2 rounded-lg border border-line hover:border-ai-line hover:bg-ai-soft/50 cursor-pointer">
                  <span className="text-ai">{a.icon}</span>
                  {a.label}
                </button>
              ))}
            {enabled.interview_summary && interviews.length > 0 && (
              <select
                className="col-span-2 field !py-1.5 text-[12.5px]"
                value=""
                onChange={(e) => {
                  const iv = interviews.find((i) => String(i.id) === e.target.value);
                  if (iv) run("interview_summary", `Summarize interview: ${iv.label}`, { interviewId: iv.id });
                }}
                aria-label="Summarize interview notes"
              >
                <option value="">Summarize interview notes…</option>
                {interviews.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            )}
            {enabled.letters && letters.length > 0 && (
              <div className="col-span-2 flex gap-1.5">
                <select
                  className="field !py-1.5 text-[12.5px] flex-1"
                  value=""
                  onChange={(e) => e.target.value && run("letters", `${e.target.value}${lang === "es" ? " (Español)" : ""}`, { letterType: e.target.value, language: lang })}
                  aria-label="Draft a letter or notice"
                >
                  <option value="">Draft a letter or notice…</option>
                  {letters.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
                <select className="field !w-auto !py-1.5 text-[12.5px]" value={lang} onChange={(e) => setLang(e.target.value as "en")} aria-label="Letter language">
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-3 min-h-[120px]">
            {items.length === 0 && (
              <div className="text-[12.5px] text-muted px-1 py-4 leading-relaxed">
                Ask about this case or pick an action. Output comes back as a labeled <b>draft</b>. Nothing goes into the record until you accept it.
              </div>
            )}
            {items.map((it) => (
              <ResultCard key={it.key} it={it} caseId={caseId} onChange={(patch) => setItems((xs) => xs.map((x) => (x.key === it.key ? { ...x, ...patch } : x)))} onClose={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} />
            ))}
          </div>

          {enabled.ask && (
            <form
              className="p-3 border-t border-line"
              onSubmit={(e) => {
                e.preventDefault();
                if (!q.trim()) return;
                run("ask", q.trim(), { question: q.trim() });
                setQ("");
              }}
            >
              <div className="flex items-center gap-2 border border-line-strong rounded-xl px-3 py-2 focus-within:border-ai">
                <MessageSquare size={14} className="text-muted shrink-0" />
                <input value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 outline-none text-[13.5px] bg-transparent" placeholder="Ask about this case…" aria-label="Ask about this case" />
                <button className="p-1 rounded-md bg-ai text-white disabled:opacity-40 cursor-pointer" disabled={!q.trim()} aria-label="Send">
                  <ArrowUp size={14} />
                </button>
              </div>
            </form>
          )}
        </>
      )}
      <footer className="px-4 py-2.5 border-t border-line bg-sunken text-[11px] text-muted flex gap-2 leading-snug">
        <ShieldCheck size={14} className="shrink-0 mt-px" />
        <span>Uses only records you&apos;re authorized to see. Every use is audited. County data is never used to train models.</span>
      </footer>
    </aside>
  );
}

function ResultCard({ it, caseId, onChange, onClose }: { it: Item; caseId: string; onChange: (p: Partial<Item>) => void; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const dispose = (status: "Accepted" | "Edited & accepted" | "Discarded", content?: string) =>
    start(async () => {
      const r = await disposeDraft(it.draftId!, status, content);
      if (r.ok) onChange({ status, content: content ?? it.content, savedTo: r.created });
      setEditing(false);
    });
  const final = it.status === "Accepted" || it.status === "Edited & accepted";
  const dest = it.savedTo === "findings" ? "Findings" : it.savedTo === "documents" ? "Documents" : "Notes";

  return (
    <div className={cx("rounded-xl border", it.status === "Discarded" ? "border-line opacity-60" : "border-ai-line")}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ai-line/60">
        <AiBadge label={final ? "AI-assisted · reviewed" : "AI draft"} live={it.live ?? true} />
        <span className="text-[12px] text-muted truncate" title={it.label}>
          {it.feature === "ask" ? `“${it.label}”` : it.feature === "letters" ? it.label : LABEL[it.feature]}
        </span>
        <button onClick={onClose} className="ml-auto text-faint hover:text-ink cursor-pointer" aria-label="Dismiss">
          <X size={13} />
        </button>
      </div>
      <div className="px-3 py-2.5 text-[13px] leading-relaxed">
        {it.status === "loading" && (
          <div className="flex items-center gap-2 text-muted py-2">
            <span className="thinking text-ai text-[18px] leading-none">
              <span>•</span>
              <span>•</span>
              <span>•</span>
            </span>
            Reading the case file…
          </div>
        )}
        {it.status === "error" && <div className="text-danger">{it.error}</div>}
        {it.content &&
          (editing ? (
            <textarea className="field min-h-[220px] text-[13px]" value={text} onChange={(e) => setText(e.target.value)} />
          ) : it.feature === "draft_report" || it.feature === "letters" ? (
            <div className="doc text-[13.5px] whitespace-pre-wrap max-h-[360px] overflow-auto">{it.content}</div>
          ) : (
            <Md text={it.content} />
          ))}
        {it.matches && it.matches.length > 0 && !editing && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {it.matches.map((m) => (
              <Link key={m.id} href={`/cases/${m.id}`} className="text-[12px] underline">
                {m.number}
              </Link>
            ))}
          </div>
        )}
      </div>
      {it.status === "ready" && it.draftId && (
        <div className="flex gap-1.5 px-3 pb-3">
          {editing ? (
            <>
              <Button size="sm" disabled={pending} onClick={() => dispose("Edited & accepted", text)}>
                Save & accept
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" disabled={pending} onClick={() => dispose("Accepted")}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setText(it.content ?? "");
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => dispose("Discarded")}>
                Discard
              </Button>
            </>
          )}
        </div>
      )}
      {final && (
        <div className="px-3 pb-2.5 text-[12px] text-ok">
          ✓ Saved to{" "}
          <Link className="underline" href={`/cases/${caseId}?tab=${it.savedTo ?? "notes"}`}>
            {dest}
          </Link>{" "}
          with your review recorded
        </div>
      )}
      {it.status === "Discarded" && <div className="px-3 pb-2.5 text-[12px] text-muted">Discarded (recorded in the audit trail)</div>}
    </div>
  );
}
