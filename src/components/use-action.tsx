"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { AlertCircle, X } from "lucide-react";

type Res = { ok: boolean; error?: string } | void | undefined | null;

/** Runs a server action, tracks pending state and surfaces the action's error message. */
export function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<Res>, onOk?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r && r.ok === false) setError(r.error ?? "Something went wrong.");
      else onOk?.();
    });
  return { pending, error, setError, run };
}

export function ErrorText({ error, className = "" }: { error: string | null; className?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className={`text-[13px] text-danger flex items-start gap-1.5 ${className}`}>
      <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
    </p>
  );
}

/** Accessible modal built on the native <dialog> element (focus trap, Esc to close, inert background). */
export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby={id} className={`m-auto rounded-2xl border border-line bg-surface text-ink shadow-2xl backdrop:bg-black/35 p-0 w-full ${wide ? "max-w-3xl" : "max-w-md"}`}>
      {open && (
        <div className="p-5">
          <div className="flex items-center mb-3">
            <h2 id={id} className="text-[16px] font-semibold">
              {title}
            </h2>
            <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-sunken cursor-pointer" aria-label="Close dialog">
              <X size={16} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
