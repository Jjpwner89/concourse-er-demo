import { currentUser } from "@/lib/session";
import { userNames, visibleCases, type VisibleCase } from "@/lib/data";
import { aiSearch, AiUnavailable } from "@/lib/ai/features";
import { CaseTable } from "@/components/case-table";
import { AiBadge, Card, PageHeader, btn } from "@/components/ui";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/audit";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const user = await currentUser();
  const names = await userNames();
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = str("q");
  const useAi = str("ai") === "1";

  const all = (await visibleCases(user)).filter((c) => c.access === "full");
  const db = await getDb();
  const emps = await db.select().from(s.employees);
  const empById = new Map(emps.map((e) => [e.id, e]));

  let results: VisibleCase[] | null = null;
  let explanation = "";
  let live = false;
  let aiError = "";

  if (q && useAi) {
    try {
      const r = await aiSearch(user, q);
      results = r.results;
      explanation = r.filters.explanation;
      live = r.live;
    } catch (e) {
      aiError = e instanceof AiUnavailable ? e.message : "Search failed";
    }
  }

  const f = { employee: str("employee"), supervisor: str("supervisor"), number: str("number"), keyword: useAi ? "" : q, from: str("from"), to: str("to"), dept: str("dept"), type: str("type"), investigator: str("investigator"), status: str("status"), unit: str("unit") };
  const structured = Object.values(f).some(Boolean);
  if (!useAi && structured) {
    const lc = (x: string) => x.toLowerCase();
    results = all.filter((c) => {
      const partyEmps = c.parties.map((p) => (p.employeeId ? empById.get(p.employeeId) : undefined)).filter(Boolean);
      if (f.employee && !c.parties.some((p) => lc(p.name).includes(lc(f.employee)))) return false;
      if (f.supervisor && !partyEmps.some((e) => e?.supervisorId && lc(empById.get(e.supervisorId)?.name ?? "").includes(lc(f.supervisor)))) return false;
      if (f.number && !lc(c.number).includes(lc(f.number))) return false;
      if (f.keyword && !lc(`${c.title} ${c.narrative} ${c.category}`).includes(lc(f.keyword))) return false;
      if (f.from && new Date(c.createdAt) < new Date(f.from)) return false;
      if (f.to && new Date(c.createdAt) > new Date(f.to + "T23:59:59")) return false;
      if (f.dept && c.department !== f.dept) return false;
      if (f.type && c.type !== f.type) return false;
      if (f.investigator && c.assigneeId !== f.investigator) return false;
      if (f.status && c.status !== f.status) return false;
      if (f.unit && !partyEmps.some((e) => e?.bargainingUnit === f.unit)) return false;
      return true;
    });
    await audit(db, user.id, "search.performed", null, { filters: Object.fromEntries(Object.entries(f).filter(([, v]) => v)), results: results.length });
  }

  const depts = [...new Set(all.map((c) => c.department))].sort();
  const units = [...new Set(emps.map((e) => e.bargainingUnit))].sort();
  const investigators = [...new Set(all.map((c) => c.assigneeId).filter(Boolean))] as string[];

  return (
    <div>
      <PageHeader eyebrow="Search" title="Search cases" sub="Results only include cases you're authorized to see. AI search uses the same rules." />
      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        <div className="space-y-5">
          <Card title="Ask in plain English">
            <form action="/search" className="space-y-2">
              <input type="hidden" name="ai" value="1" />
              <textarea name="q" defaultValue={useAi ? q : ""} className="field min-h-[80px]" placeholder="e.g. open harassment cases in Public Works from the last 60 days" aria-label="Natural-language search" />
              <button className={btn("ai")}>Search with AI</button>
            </form>
          </Card>
          <Card title="Filters">
            <form action="/search" className="space-y-2.5 text-[13px]">
              <F label="Employee (complainant or respondent)" name="employee" v={f.employee} />
              <F label="Supervisor" name="supervisor" v={f.supervisor} />
              <F label="Case number" name="number" v={f.number} />
              <F label="Keywords" name="q" v={f.keyword} />
              <div className="grid grid-cols-2 gap-2">
                <F label="Opened from" name="from" v={f.from} type="date" />
                <F label="to" name="to" v={f.to} type="date" />
              </div>
              <S label="Department" name="dept" v={f.dept} opts={depts.map((d) => [d, d])} />
              <S label="Case type" name="type" v={f.type} opts={["EEO", "ER", "CI", "RTW"].map((d) => [d, d])} />
              <S label="Investigator" name="investigator" v={f.investigator} opts={investigators.map((i) => [i, names[i]])} />
              <S label="Status" name="status" v={f.status} opts={["Open", "On hold", "Closed"].map((d) => [d, d])} />
              <S label="Bargaining unit" name="unit" v={f.unit} opts={units.map((d) => [d, d])} />
              <button className={btn("primary")}>Apply filters</button>
            </form>
          </Card>
        </div>
        <div>
          {aiError && <div className="card p-4 text-danger text-[13.5px] mb-4">{aiError}</div>}
          {results === null ? (
            <Card>
              <div className="text-[14px] text-muted py-10 text-center">Use a filter or ask a question to search {all.length} cases you can access.</div>
            </Card>
          ) : (
            <Card
              pad={false}
              title={`${results.length} result${results.length === 1 ? "" : "s"}`}
              right={useAi ? <span className="flex items-center gap-2 text-[12.5px] text-muted"><AiBadge label="AI-interpreted" live={live} /> {explanation}</span> : undefined}
            >
              <CaseTable cases={results} names={names} cols={["number", "title", "type", "department", "status", "assignee", "opened"]} empty="No matching cases." />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function F({ label, name, v, type = "text" }: { label: string; name: string; v: string; type?: string }) {
  return (
    <label className="block">
      <span className="block text-muted mb-0.5">{label}</span>
      <input name={name} defaultValue={v} type={type} className="field !py-1.5" />
    </label>
  );
}
function S({ label, name, v, opts }: { label: string; name: string; v: string; opts: [string, string][] }) {
  return (
    <label className="block">
      <span className="block text-muted mb-0.5">{label}</span>
      <select name={name} defaultValue={v} className="field !py-1.5">
        <option value="">Any</option>
        {opts.map(([val, l]) => (
          <option key={val} value={val}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
