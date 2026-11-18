"use client";
import { useState } from "react";
import Link from "next/link";
import { completeTasks } from "@/app/actions";
import { TaskCheck } from "@/components/case/case-forms";
import { Button, Empty, cx } from "@/components/ui";
import { ErrorText, useAction } from "@/components/use-action";

export type TaskRow = { id: number; title: string; done: boolean; caseId: string; caseNumber: string; assignee: string; recurring: string | null; due: string; overdue: boolean; auto: boolean };

export function TaskGroup({ rows, selectable }: { rows: TaskRow[]; selectable: boolean }) {
  const [sel, setSel] = useState<number[]>([]);
  const { pending, error, run } = useAction();
  if (!rows.length) return <Empty>Nothing here.</Empty>;
  const all = sel.length === rows.length;
  return (
    <div>
      {selectable && (
        <div className="px-5 py-2 border-b border-line flex items-center gap-3 text-[12.5px] bg-sunken/60">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={all} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} /> Select all
          </label>
          {sel.length > 0 && (
            <Button size="sm" disabled={pending} onClick={() => run(() => completeTasks(sel), () => setSel([]))}>
              Mark {sel.length} done
            </Button>
          )}
          <ErrorText error={error} />
        </div>
      )}
      <ul className="divide-y divide-line">
        {rows.map((t) => (
          <li key={t.id} className="px-5 py-3 flex gap-3 items-start">
            {selectable && <input type="checkbox" className="mt-0.5" checked={sel.includes(t.id)} onChange={(e) => setSel(e.target.checked ? [...sel, t.id] : sel.filter((x) => x !== t.id))} aria-label={`Select ${t.title}`} />}
            <TaskCheck id={t.id} done={t.done} />
            <div className="flex-1">
              <div className={cx("text-[14px]", t.done && "line-through text-muted")}>{t.title}</div>
              <div className="text-[12px] text-muted flex flex-wrap gap-x-3">
                <Link href={`/cases/${t.caseId}?tab=tasks`} className="hover:underline">
                  {t.caseNumber}
                </Link>
                <span>{t.assignee}</span>
                {t.recurring && <span>↻ {t.recurring}</span>}
                {t.auto && <span>Workflow</span>}
              </div>
            </div>
            <div className={cx("text-[12.5px] whitespace-nowrap", t.overdue ? "text-danger font-medium" : "text-muted")}>
              {t.overdue && <span className="sr-only">Overdue: </span>}
              {t.due}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
