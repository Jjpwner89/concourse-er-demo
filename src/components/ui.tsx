import Link from "next/link";
import { clsx } from "clsx";
import { Sparkles, Lock, ShieldAlert, HeartPulse, Scale } from "lucide-react";
import type { ReactNode } from "react";

export const cx = clsx;

export function Logo({ dark = false, size = 18 }: { dark?: boolean; size?: number }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 font-medium tracking-tight", dark ? "text-night-ink" : "text-ink")} style={{ fontSize: size }}>
      Concourse
      <svg width={size * 0.95} height={size * 0.95} viewBox="0 0 24 24" aria-hidden>
        <path d="M5 4.5 12.5 12 5 19.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="miter" />
        <path d="M11.5 4.5 19 12l-7.5 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="miter" />
      </svg>
    </span>
  );
}

type Tone = "neutral" | "slate" | "ok" | "warn" | "danger" | "coral" | "ai" | "dark";
const toneClass: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2 border-line",
  slate: "bg-slate-4 text-slate border-slate-3",
  ok: "bg-ok-soft text-ok border-[#c9dfcf]",
  warn: "bg-warn-soft text-warn border-[#ecd9ae]",
  danger: "bg-danger-soft text-danger border-[#ecc4ba]",
  coral: "bg-coral-soft text-coral border-[#f2cdbd]",
  ai: "bg-ai-soft text-ai border-ai-line",
  dark: "bg-night text-night-ink border-night",
};

export function Badge({ tone = "neutral", children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[11.5px] font-medium whitespace-nowrap", toneClass[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function AiBadge({ label = "AI draft", live = true }: { label?: string; live?: boolean }) {
  return (
    <Badge tone="ai" icon={<Sparkles size={11} />}>
      {label}
      {!live && <span className="opacity-60"> · offline</span>}
    </Badge>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const map: Record<string, Tone> = { EEO: "dark", ER: "slate", CI: "slate", RTW: "slate" };
  return <Badge tone={map[type] ?? "neutral"}>{type}</Badge>;
}

export function SensitivityBadge({ s }: { s: string }) {
  if (s === "eeo") return <Badge tone="dark" icon={<Lock size={11} />}>EEO · Restricted</Badge>;
  if (s === "medical") return <Badge tone="coral" icon={<HeartPulse size={11} />}>Medical · Restricted</Badge>;
  if (s === "high") return <Badge tone="warn" icon={<ShieldAlert size={11} />}>High sensitivity</Badge>;
  if (s === "privileged") return <Badge tone="danger" icon={<Scale size={11} />}>Attorney-client privileged</Badge>;
  return null;
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "Open" ? "ok" : status === "On hold" ? "warn" : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "ai" | "danger"; size?: "sm" | "md" }) {
  return (
    <button {...rest} className={cx(btn(variant, size), className)}>
      {children}
    </button>
  );
}

export function btn(variant: "primary" | "secondary" | "ghost" | "ai" | "danger" = "primary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap",
    size === "sm" ? "text-[12.5px] px-2.5 py-1.5" : "text-[13.5px] px-3.5 py-2",
    variant === "primary" && "bg-night text-white hover:bg-night-3",
    variant === "secondary" && "bg-surface text-ink border border-line-strong hover:bg-sunken",
    variant === "ghost" && "text-ink-2 hover:bg-sunken",
    variant === "ai" && "bg-ai-soft text-ai border border-ai-line hover:bg-[#e2e5f8]",
    variant === "danger" && "bg-danger-soft text-danger border border-[#ecc4ba] hover:bg-[#f3d6ce]",
  );
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {sub && <div className="text-muted text-[14px] mt-1">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, tone, href }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "danger" | "warn"; href?: string }) {
  const inner = (
    <div className="px-5 py-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cx("text-[30px] font-semibold tracking-tight leading-tight mt-0.5", tone === "danger" && "text-danger", tone === "warn" && "text-warn")}>{value}</div>
      {sub && <div className="text-[12.5px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="card block hover:border-slate-3 transition">
      {inner}
    </Link>
  ) : (
    <div className="card">{inner}</div>
  );
}

export function Card({ title, right, children, className, pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("card", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
          <h2 className="text-[14.5px] font-semibold">{title}</h2>
          {right}
        </header>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="text-[13.5px] text-muted py-6 text-center">{children}</div>;
}

/** Minimal, safe markdown for AI output: **bold**, bullets, numbered lists, paragraphs. */
export function Md({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list;
    blocks.push(
      L.ordered ? (
        <ol key={blocks.length}>{L.items.map((t, i) => <li key={i}>{inline(t)}</li>)}</ol>
      ) : (
        <ul key={blocks.length}>{L.items.map((t, i) => <li key={i}>{inline(t)}</li>)}</ul>
      ),
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const b = line.match(/^\s*[-*•]\s+(.*)$/);
    const n = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (b || n) {
      const ordered = !!n;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((b ?? n)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(<p key={blocks.length}>{h ? <strong>{h[1]}</strong> : inline(line)}</p>);
  }
  flush();
  return <div className={cx("prose-ai", className)}>{blocks}</div>;
}

function inline(t: string): ReactNode {
  const parts = t.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : p,
  );
}
