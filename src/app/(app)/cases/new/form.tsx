"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualCase } from "@/app/actions";
import type { CaseType } from "@/lib/db/schema";
import { INTAKE_CHANNELS, TAXONOMY, TEAMS, TYPE_DEFAULTS, type Team } from "@/lib/taxonomy";
import { Button, Card } from "@/components/ui";
import { ErrorText } from "@/components/use-action";
import { todayISO } from "@/lib/format";

type Emp = { id: string; name: string; title: string; department: string };
type Staff = { id: string; name: string; team: Team };

export function NewCaseForm({ employees, staff, departments, me, defaultType }: { employees: Emp[]; staff: Staff[]; departments: string[]; me: string; defaultType: CaseType }) {
  const [type, setType] = useState<CaseType>(defaultType);
  const [team, setTeam] = useState<string>(TYPE_DEFAULTS[defaultType].team);
  const [sensitivity, setSensitivity] = useState<string>(TYPE_DEFAULTS[defaultType].sensitivity);
  const [category, setCategory] = useState(Object.keys(TAXONOMY[defaultType])[0]);
  const [subtype, setSubtype] = useState("");
  const [channel, setChannel] = useState(INTAKE_CHANNELS[0]);
  const [title, setTitle] = useState("");
  const [narrative, setNarrative] = useState("");
  const [incident, setIncident] = useState("");
  const [department, setDepartment] = useState("");
  const [complainant, setComplainant] = useState<Emp | null>(null);
  const [complainantName, setComplainantName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [respondents, setRespondents] = useState<Emp[]>([]);
  const [assignee, setAssignee] = useState<string | null>(() => staff.find((u) => u.id === me && u.team === TYPE_DEFAULTS[defaultType].team)?.id ?? staff.find((u) => u.team === TYPE_DEFAULTS[defaultType].team)?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const pickAssignee = (t: string) => {
    const members = staff.filter((u) => u.team === t);
    setAssignee((a) => (a && members.some((m) => m.id === a) ? a : (members.find((m) => m.id === me)?.id ?? members[0]?.id ?? null)));
  };
  // Case type sets routing, sensitivity and the category list. Routing never changes the type.
  const changeType = (t: CaseType) => {
    setType(t);
    const d = TYPE_DEFAULTS[t];
    setTeam(d.team);
    setSensitivity(d.sensitivity);
    setCategory(Object.keys(TAXONOMY[t])[0]);
    setSubtype("");
    pickAssignee(d.team);
  };
  const subs = TAXONOMY[type][category] ?? [];
  const members = staff.filter((u) => u.team === team);
  const future = !!incident && incident > todayISO();
  const isRtw = type === "RTW";

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (future) return setError("The incident date can't be in the future.");
        setError(null);
        start(async () => {
          const r = await createManualCase({
            caseType: type,
            category,
            subtype,
            title,
            narrative,
            sensitivity: sensitivity as "standard",
            department: department || null,
            assigneeId: assignee,
            source: channel,
            anonymous: anonymous && !isRtw,
            incidentDate: incident || null,
            complainant: anonymous && !isRtw ? { name: "Anonymous complainant", anonymous: true } : complainant ? { employeeId: complainant.id, name: complainant.name } : complainantName.trim() ? { name: complainantName.trim() } : null,
            respondentIds: respondents.map((r) => r.id),
            team,
          });
          if (!r.ok) return setError(r.error);
          router.push(r.data.accessible ? `/cases/${r.data.caseId}` : `/intake?routed=${encodeURIComponent(r.data.number)}&team=${encodeURIComponent(r.data.team)}`);
        });
      }}
    >
      <Card title="Classification">
        <div className="grid sm:grid-cols-3 gap-4">
          <F label="Received by">
            <select className="field" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {INTAKE_CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </F>
          <F label="Case type">
            <select className="field" value={type} onChange={(e) => changeType(e.target.value as CaseType)}>
              <option value="EEO">EEO (discrimination, harassment, retaliation)</option>
              <option value="ER">Employee Relations</option>
              <option value="CI">Central Investigations</option>
              <option value="RTW">Return to Work / accommodation</option>
            </select>
          </F>
          <F label="Sensitivity">
            <select className="field" value={sensitivity} onChange={(e) => setSensitivity(e.target.value)}>
              {["standard", "high", "eeo", "medical"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </F>
          <F label="Category">
            <select
              className="field"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubtype("");
              }}
            >
              {Object.keys(TAXONOMY[type]).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </F>
          <F label={type === "EEO" ? "Protected basis / subtype" : "Subtype"}>
            <select className="field" value={subtype} onChange={(e) => setSubtype(e.target.value)}>
              <option value="">None</option>
              {subs.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </F>
          <F label="Incident date">
            <input type="date" className={`field ${future ? "!border-danger" : ""}`} value={incident} max={todayISO()} onChange={(e) => setIncident(e.target.value)} aria-invalid={future} />
          </F>
        </div>
        {future && (
          <p role="alert" className="text-[13px] text-danger mt-2">
            The incident date can&apos;t be in the future.
          </p>
        )}
      </Card>

      <Card title="What was reported">
        <div className="space-y-4">
          <F label="Case title">
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short, neutral title, e.g. Allegation of retaliation — Fleet Services" required />
          </F>
          <F label="Narrative">
            <textarea className="field min-h-[140px]" value={narrative} onChange={(e) => setNarrative(e.target.value)} placeholder="Summarize what the caller or sender reported, in their words where possible." required />
          </F>
          <F label="Department">
            <select className="field" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Set from the respondent&apos;s HRIS record</option>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </F>
        </div>
      </Card>

      <Card title="People">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <div className="text-[13px] font-medium mb-1">{isRtw ? "Employee" : "Complainant"}</div>
            {!isRtw && (
              <label className="flex items-center gap-1.5 text-[12.5px] mb-2">
                <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Anonymous (hotline or caller declined to give a name)
              </label>
            )}
            {!anonymous && (
              <>
                {complainant ? (
                  <Chip emp={complainant} onRemove={() => setComplainant(null)} />
                ) : (
                  <EmployeePicker employees={employees} onPick={setComplainant} placeholder="Search HRIS…" />
                )}
                {!complainant && <input className="field mt-2" value={complainantName} onChange={(e) => setComplainantName(e.target.value)} placeholder="…or name of a non-employee (applicant, public)" aria-label="Non-employee name" />}
              </>
            )}
          </div>
          {!isRtw && (
            <div>
              <div className="text-[13px] font-medium mb-1">Respondent(s)</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {respondents.map((r) => (
                  <Chip key={r.id} emp={r} onRemove={() => setRespondents(respondents.filter((x) => x.id !== r.id))} />
                ))}
              </div>
              <EmployeePicker employees={employees.filter((e) => !respondents.some((r) => r.id === e.id))} onPick={(e) => setRespondents([...respondents, e])} placeholder="Search HRIS to add…" />
              <p className="text-[12px] text-muted mt-1.5">Anyone in a respondent&apos;s reporting chain is recused automatically.</p>
            </div>
          )}
        </div>
      </Card>

      <Card title="Routing">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Route to">
            <select
              className="field"
              value={team}
              onChange={(e) => {
                setTeam(e.target.value);
                pickAssignee(e.target.value);
              }}
            >
              {TEAMS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </F>
          <F label="Assign to">
            <select className="field" value={assignee ?? ""} onChange={(e) => setAssignee(e.target.value || null)}>
              <option value="">Team queue</option>
              {members.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </F>
        </div>
        <p className="text-[12px] text-muted mt-2">Case type sets routing, sensitivity and categories. You can still override routing.</p>
      </Card>

      <ErrorText error={error} />
      <div className="flex gap-2">
        <Button disabled={pending || future}>{pending ? "Creating…" : "Create case"}</Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-medium mb-1">{label}</span>
      {children}
    </label>
  );
}

function Chip({ emp, onRemove }: { emp: Emp; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-line rounded-lg px-2 py-1 text-[13px] bg-sunken">
      <b>{emp.name}</b> <span className="text-muted text-[12px]">{emp.title}</span>
      <button type="button" onClick={onRemove} className="text-muted hover:text-danger cursor-pointer" aria-label={`Remove ${emp.name}`}>
        ×
      </button>
    </span>
  );
}

function EmployeePicker({ employees, onPick, placeholder }: { employees: Emp[]; onPick: (e: Emp) => void; placeholder: string }) {
  const [q, setQ] = useState("");
  const listId = useId();
  const matches = q.trim().length >= 2 ? employees.filter((e) => `${e.name} ${e.id} ${e.title}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return (
    <div className="relative">
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} role="combobox" aria-expanded={matches.length > 0} aria-controls={listId} aria-autocomplete="list" />
      {matches.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 left-0 right-0 mt-1 card shadow-lg py-1 max-h-60 overflow-auto">
          {matches.map((m) => (
            <li key={m.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-sunken text-[13px] cursor-pointer"
                onClick={() => {
                  onPick(m);
                  setQ("");
                }}
              >
                <b>{m.name}</b> <span className="text-muted">{m.id} · {m.title} · {m.department}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
