import Link from "next/link";
import { Lock } from "lucide-react";
import type { VisibleCase } from "@/lib/data";
import { redact } from "@/lib/data";
import { caseDeadlines, caseAgeDays } from "@/lib/deadlines";
import { Badge, Empty, SensitivityBadge, StatusBadge, TypeBadge, cx } from "./ui";
import { fmtDate } from "@/lib/format";

export function CaseTable({
  cases,
  names,
  cols = ["number", "title", "type", "department", "stage", "assignee", "deadline", "age"],
  empty = "No cases.",
}: {
  cases: VisibleCase[];
  names: Record<string, string>;
  cols?: ("number" | "title" | "type" | "department" | "stage" | "assignee" | "deadline" | "age" | "status" | "opened")[];
  empty?: string;
}) {
  if (!cases.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            {cols.includes("number") && <th>Case</th>}
            {cols.includes("title") && <th>Matter</th>}
            {cols.includes("type") && <th>Type</th>}
            {cols.includes("department") && <th>Department</th>}
            {cols.includes("status") && <th>Status</th>}
            {cols.includes("stage") && <th>Stage</th>}
            {cols.includes("assignee") && <th>Assigned</th>}
            {cols.includes("opened") && <th>Opened</th>}
            {cols.includes("deadline") && <th>Next deadline</th>}
            {cols.includes("age") && <th className="text-right">Age</th>}
          </tr>
        </thead>
        <tbody>
          {cases.map((raw) => {
            const c = redact(raw);
            const meta = c.access === "metadata";
            const dl = caseDeadlines(c).sort((a, b) => a.daysLeft - b.daysLeft)[0];
            return (
              <tr key={c.id}>
                {cols.includes("number") && (
                  <td className="whitespace-nowrap">
                    <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                      {c.number}
                    </Link>
                  </td>
                )}
                {cols.includes("title") && (
                  <td className="min-w-[260px]">
                    {meta ? (
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <Lock size={12} /> Content restricted
                      </span>
                    ) : (
                      <Link href={`/cases/${c.id}`} className="hover:underline">
                        {c.title}
                      </Link>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1">
                      <SensitivityBadge s={c.sensitivity} />
                      {c.status !== "Open" && !cols.includes("status") && <StatusBadge status={c.status} />}
                      {c.legalHold && <Badge tone="danger">Legal hold</Badge>}
                      {c.paidLeaveStart && !meta && <Badge tone="warn">Paid admin leave</Badge>}
                    </div>
                  </td>
                )}
                {cols.includes("type") && (
                  <td>
                    <TypeBadge type={c.type} /> <span className="text-muted text-[12.5px] ml-1">{c.category}</span>
                  </td>
                )}
                {cols.includes("department") && <td className="whitespace-nowrap">{c.department}</td>}
                {cols.includes("status") && (
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                )}
                {cols.includes("stage") && <td className="whitespace-nowrap">{c.stage}</td>}
                {cols.includes("assignee") && <td className="whitespace-nowrap">{c.assigneeId ? names[c.assigneeId] : <span className="text-coral">Unassigned</span>}</td>}
                {cols.includes("opened") && <td className="whitespace-nowrap">{fmtDate(c.createdAt)}</td>}
                {cols.includes("deadline") && (
                  <td className="whitespace-nowrap">
                    {dl ? (
                      <span className={cx(dl.daysLeft < 0 ? "text-danger font-medium" : dl.daysLeft <= 14 ? "text-warn font-medium" : "")}>
                        {dl.daysLeft < 0 ? `${-dl.daysLeft}d overdue` : `${dl.daysLeft}d`}
                        <span className="text-muted font-normal text-[12px]"> · {dl.label}</span>
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                )}
                {cols.includes("age") && <td className="text-right tabular-nums">{caseAgeDays(c.createdAt)}d</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
