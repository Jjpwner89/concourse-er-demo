import { currentUser } from "@/lib/session";
import { tasksFor, userNames } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui";
import { daysBetween, fmtDate } from "@/lib/format";
import { canContribute } from "@/lib/policy";
import { TaskGroup, type TaskRow } from "./task-group";

export const metadata = { title: "My tasks" };

export default async function TasksPage() {
  const user = await currentUser();
  const [all, names] = await Promise.all([tasksFor(user), userNames()]);
  const mine = all.filter((t) => t.assigneeId === user.id || user.role === "supervisor");
  const d = (t: (typeof mine)[number]) => (t.dueDate ? daysBetween(new Date(), t.dueDate) : null);
  const row = (t: (typeof mine)[number]): TaskRow => ({
    id: t.id,
    title: t.title,
    done: t.done,
    caseId: t.caseId,
    caseNumber: t.case.number,
    assignee: user.role === "supervisor" ? (names[t.assigneeId ?? ""] ?? "") : "",
    recurring: t.recurring,
    due: fmtDate(t.dueDate),
    overdue: !t.done && (d(t) ?? 0) < 0,
    auto: t.auto,
  });
  const open = mine.filter((t) => !t.done);
  const groups: [string, typeof open, boolean][] = [
    ["Overdue", open.filter((t) => (d(t) ?? 1) < 0), true],
    ["Due this week", open.filter((t) => d(t) !== null && d(t)! >= 0 && d(t)! <= 7), true],
    ["Later", open.filter((t) => d(t) === null || d(t)! > 7), true],
    ["Completed", mine.filter((t) => t.done), false],
  ];
  const can = canContribute(user);
  return (
    <div>
      <PageHeader eyebrow="Work" title="My tasks" sub="Across every case you're assigned. Reminders go out by Teams and email before due dates." />
      <div className="space-y-6">
        {groups.map(([label, rows, sel]) => (
          <section key={label} id={label.toLowerCase().replace(/ /g, "-")} className="scroll-mt-20" aria-label={label}>
            <Card title={`${label} (${rows.length})`} pad={false}>
              <TaskGroup rows={rows.map(row)} selectable={sel && can && rows.length > 1} />
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
