import Link from "next/link";
import { currentUser } from "@/lib/session";
import { userNames, visibleCases } from "@/lib/data";
import { CaseTable } from "@/components/case-table";
import { Card, PageHeader, btn, cx } from "@/components/ui";
import { Download, Lock, Plus } from "lucide-react";
import { canCreateCases } from "@/lib/policy";

export default async function CasesPage({ searchParams }: PageProps<"/cases">) {
  const sp = await searchParams;
  const user = await currentUser();
  const [all, names] = await Promise.all([visibleCases(user), userNames()]);
  const type = typeof sp.type === "string" ? sp.type : "";
  const status = typeof sp.status === "string" ? sp.status : "Open";
  const dept = typeof sp.dept === "string" ? sp.dept : "";
  const scope = typeof sp.scope === "string" ? sp.scope : "all";

  let rows = all;
  if (type) rows = rows.filter((c) => c.type === type);
  if (status !== "All") rows = rows.filter((c) => (status === "Open" ? c.status !== "Closed" : c.status === status));
  if (dept) rows = rows.filter((c) => c.department === dept);
  if (scope === "mine") rows = rows.filter((c) => c.assigneeId === user.id);

  const types = [...new Set(all.map((c) => c.type))];
  const depts = [...new Set(all.map((c) => c.department))].sort();
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ type, status, dept, scope, ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/cases?${p.toString()}`;
  };
  const metaOnly = user.role === "it_admin";

  return (
    <div>
      <PageHeader
        eyebrow="Cases"
        title={metaOnly ? "Case registry" : "Cases"}
        sub={metaOnly ? "Metadata only. Narrative, parties and documents aren't visible to administrators." : `${all.length} cases you're authorized to see`}
        right={
          <div className="flex gap-2">
            {canCreateCases(user) && (
              <Link href="/cases/new" className={btn("primary")}>
                <Plus size={14} /> New case
              </Link>
            )}
            <a href={`/api/export?${new URLSearchParams({ type, status, dept, scope }).toString()}`} className={btn("secondary")}>
              <Download size={14} /> Export CSV
            </a>
          </div>
        }
      />
      {metaOnly && (
        <div className="card bg-sunken px-5 py-3 mb-5 text-[13.5px] flex items-center gap-2">
          <Lock size={14} /> System administrators see case metadata for maintenance purposes only.
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Seg label="Status" items={["Open", "On hold", "Closed", "All"]} value={status} href={(v) => qs({ status: v })} />
        <Seg label="Type" items={["", ...types]} value={type} href={(v) => qs({ type: v })} render={(v) => v || "All"} />
        {!metaOnly && <Seg label="Scope" items={["all", "mine"]} value={scope} href={(v) => qs({ scope: v })} render={(v) => (v === "mine" ? "Assigned to me" : "All visible")} />}
        <form action="/cases" className="ml-auto flex items-center gap-2">
          {Object.entries({ type, status, scope }).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <select name="dept" defaultValue={dept} className="field !w-auto !py-1.5 text-[13px]" aria-label="Department">
            <option value="">All departments</option>
            {depts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <button className={btn("secondary", "sm")}>Apply</button>
        </form>
      </div>
      <Card pad={false}>
        <CaseTable cases={rows} names={names} cols={metaOnly ? ["number", "title", "type", "department", "status", "stage", "opened"] : ["number", "title", "type", "department", "stage", "assignee", "deadline", "age"]} empty="No cases match these filters." />
      </Card>
    </div>
  );
}

function Seg({ label, items, value, href, render = (v) => v }: { label: string; items: string[]; value: string; href: (v: string) => string; render?: (v: string) => string }) {
  return (
    <div className="flex items-center gap-1 bg-surface border border-line rounded-lg p-0.5" role="group" aria-label={label}>
      {items.map((v) => (
        <Link key={v || "all"} href={href(v)} aria-current={v === value ? "true" : undefined} className={cx("px-2.5 py-1 rounded-md text-[12.5px]", v === value ? "bg-night text-white" : "text-ink-2 hover:bg-sunken")}>
          {render(v)}
        </Link>
      ))}
    </div>
  );
}
