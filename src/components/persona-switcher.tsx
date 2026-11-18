"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import { resetDemo, switchPersona } from "@/app/actions";

type P = { id: string; name: string; title: string; initials: string; role: string; blurb: string };

export function PersonaSwitcher({ current, personas }: { current: string; personas: P[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const me = personas.find((p) => p.id === current)!;

  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 rounded-lg pl-1.5 pr-2 py-1 hover:bg-night-2 cursor-pointer" aria-haspopup="menu" aria-expanded={open}>
        <Avatar initials={me.initials} />
        <div className="text-left leading-tight hidden sm:block">
          <div className="text-[13px] font-medium">{me.name}</div>
          <div className="text-[11px] text-night-muted">{me.role}</div>
        </div>
        <ChevronDown size={14} className="text-night-muted" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[380px] card shadow-xl text-ink overflow-hidden z-50" role="menu">
          <div className="px-4 py-3 border-b border-line bg-sunken">
            <div className="eyebrow">Demo · switch persona</div>
            <div className="text-[12px] text-muted mt-0.5">Stands in for County SSO. Each persona has different access.</div>
          </div>
          <div className="max-h-[420px] overflow-auto py-1">
            {personas.map((p) => (
              <button
                key={p.id}
                disabled={pending}
                onClick={() => start(() => switchPersona(p.id, p.id === current ? path : stayOn(path)))}
                className={clsx("w-full text-left flex gap-3 px-4 py-2.5 hover:bg-sunken cursor-pointer", p.id === current && "bg-slate-4/60")}
              >
                <Avatar initials={p.initials} light />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">
                    {p.name} <span className="text-muted font-normal">· {p.role}</span>
                  </div>
                  <div className="text-[12px] text-muted leading-snug">{p.blurb}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-line px-4 py-2.5 flex justify-between items-center">
            <span className="text-[11.5px] text-muted">Reset restores the original demo data.</span>
            <button
              onClick={() => confirm("Reset all demo data?") && start(() => resetDemo())}
              className="inline-flex items-center gap-1 text-[12.5px] text-danger hover:underline cursor-pointer"
            >
              <RotateCcw size={12} /> Reset demo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Keep the presenter on the same case when switching, so access walls are visible in place. */
function stayOn(path: string) {
  return path.startsWith("/cases/") || path.startsWith("/dashboards") || path.startsWith("/search") ? path : "/";
}

export function Avatar({ initials, light }: { initials: string; light?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center justify-center rounded-full w-8 h-8 text-[11.5px] font-semibold shrink-0", light ? "bg-slate-4 text-slate" : "bg-night-3 text-white")}>
      {initials}
    </span>
  );
}
