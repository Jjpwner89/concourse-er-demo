"use client";
import { useState, useTransition } from "react";
import { setAiSettings } from "@/app/actions";
import { Button, Card, cx } from "@/components/ui";

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx("w-10 h-[22px] rounded-full relative transition cursor-pointer disabled:opacity-40", on ? "bg-ok" : "bg-line-strong")}
    >
      <span className={cx("absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all", on ? "left-[21px]" : "left-[3px]")} />
    </button>
  );
}

export function AiControls({ enabled, features, labels }: { enabled: boolean; features: Record<string, boolean>; labels: Record<string, string> }) {
  const [all, setAll] = useState(enabled);
  const [f, setF] = useState<Record<string, boolean>>(Object.fromEntries(Object.keys(labels).map((k) => [k, features[k] !== false])));
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Card title="AI capabilities" right={<Toggle on={all} onChange={(v) => { setAll(v); setSaved(false); }} label="All AI functionality" />}>
      <p className="text-[13px] text-muted mb-4">Turn AI off entirely, or one capability at a time. Case management keeps working without it.</p>
      <ul className="divide-y divide-line">
        {Object.entries(labels).map(([k, l]) => (
          <li key={k} className="py-2.5 flex items-center justify-between">
            <span className={cx("text-[14px]", !all && "text-faint")}>{l}</span>
            <Toggle on={all && f[k]} disabled={!all} onChange={(v) => { setF({ ...f, [k]: v }); setSaved(false); }} label={l} />
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 mt-4">
        <Button disabled={pending} onClick={() => start(async () => { await setAiSettings(all, f); setSaved(true); })}>
          Save changes
        </Button>
        {saved && <span className="text-[13px] text-ok">Saved and recorded in the audit log.</span>}
      </div>
    </Card>
  );
}
