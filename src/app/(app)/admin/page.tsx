import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { currentUser } from "@/lib/session";
import { canUseAdmin } from "@/lib/policy";
import { accessMatrix, getSetting, userNames } from "@/lib/data";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { audit, verifyChain } from "@/lib/audit";
import { aiConfigured, MODEL } from "@/lib/ai/claude";
import { AI_FEATURES, WORKFLOWS } from "@/lib/settings-defaults";
import { PERSONAS, ROLE_LABEL } from "@/lib/personas";
import { Badge, Card, PageHeader, btn, cx } from "@/components/ui";
import { ActionBadge, detailText } from "@/components/case/tabs";
import { AiControls } from "./ai-controls";
import { AccessReview } from "./access-review";
import { fmtDateTime } from "@/lib/format";
import { ShieldCheck, ShieldAlert, Download, CheckCircle2 } from "lucide-react";

const TABS = [
  ["ai", "AI controls"],
  ["access", "Access explainer"],
  ["audit", "Audit log"],
  ["workflows", "Workflows & retention"],
  ["users", "Users & roles"],
  ["review", "Access review"],
  ["integrations", "Integrations"],
] as const;

export default async function Admin({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const user = await currentUser();
  const db = await getDb();
  if (!canUseAdmin(user)) {
    await audit(db, user.id, "authz.denied", null, { surface: "admin console" });
    return <div className="card p-8">Administration is restricted to system administrators.</div>;
  }
  const tab = (typeof sp.tab === "string" ? sp.tab : "ai") as (typeof TABS)[number][0];

  return (
    <div>
      <PageHeader eyebrow="Administration" title="Platform administration" sub="Configuration without vendor programming. Every change here is a privileged action and is audited." />
      <nav className="flex gap-1 border-b border-line mb-6 overflow-x-auto">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/admin?tab=${k}`} aria-current={k === tab ? "page" : undefined} className={cx("px-3 py-2 text-[13.5px] -mb-px border-b-2 whitespace-nowrap", k === tab ? "border-night font-medium" : "border-transparent text-muted hover:text-ink")}>
            {l}
          </Link>
        ))}
      </nav>
      {tab === "ai" && <AiTab />}
      {tab === "access" && <AccessTab caseId={typeof sp.case === "string" ? sp.case : "c-0118"} />}
      {tab === "audit" && <AuditTab filter={typeof sp.f === "string" ? sp.f : ""} />}
      {tab === "workflows" && <WorkflowsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "review" && <ReviewTab />}
      {tab === "integrations" && <IntegrationsTab />}
    </div>
  );
}

async function AiTab() {
  const enabled = await getSetting<boolean>("ai_enabled", true);
  const features = await getSetting<Record<string, boolean>>("ai_features", {});
  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
      <AiControls enabled={enabled} features={features} labels={AI_FEATURES} />
      <Card title="AI data handling">
        <ul className="space-y-2.5 text-[13.5px]">
          {[
            `Model: Anthropic Claude (${MODEL}) via API. ${aiConfigured() ? "Connected." : "Not connected: offline demo output."}`,
            "No County data, prompts, outputs or derived data are used for model training, fine-tuning or evaluation.",
            "Retrieval, summarization, similar-case matching and search all go through the same authorization check as the UI, including role, EEO wall, medical tier, recusal and privilege.",
            "AI output is labeled, editable and stored as a draft until a person accepts, edits or discards it.",
            "Every AI use is audited: user, case, feature, time and disposition.",
            "Turning off any capability leaves core case management unaffected.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <CheckCircle2 size={15} className="text-ok shrink-0 mt-0.5" />
              {t}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

async function AccessTab({ caseId }: { caseId: string }) {
  const db = await getDb();
  const cases = await db.select({ id: s.cases.id, number: s.cases.number, type: s.cases.type }).from(s.cases).orderBy(asc(s.cases.number));
  const matrix = await accessMatrix(caseId);
  const sel = cases.find((c) => c.id === caseId);
  return (
    <div className="space-y-5">
      <Card>
        <form className="flex flex-wrap items-center gap-3" action="/admin">
          <input type="hidden" name="tab" value="access" />
          <span className="text-[14px]">Who can see</span>
          <select name="case" defaultValue={caseId} className="field !w-auto">
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.number}
              </option>
            ))}
          </select>
          <button className={btn("secondary", "sm")}>Explain</button>
          <span className="text-[12.5px] text-muted">Evaluates the live policy for each role. Case content isn&apos;t shown.</span>
        </form>
      </Card>
      <Card title={`Access decisions · ${sel?.number ?? ""}`} pad={false}>
        <table className="tbl">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Access</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map(({ persona, decision }) => (
              <tr key={persona.id}>
                <td className="font-medium">{persona.name}</td>
                <td>{ROLE_LABEL[persona.role]}</td>
                <td>
                  <Badge tone={decision.access === "full" ? "ok" : decision.access === "metadata" ? "warn" : "danger"}>{decision.access === "full" ? "Full" : decision.access === "metadata" ? "Metadata only" : "None"}</Badge>
                </td>
                <td className="text-[13px]">{decision.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-[12.5px] text-muted">The same decision applies to screens, search, dashboards, exports, APIs and AI features. There is one policy function and no second path.</p>
    </div>
  );
}

async function AuditTab({ filter }: { filter: string }) {
  const db = await getDb();
  const chain = await verifyChain(db);
  const names = await userNames();
  const rows = await db.select().from(s.auditLog).orderBy(desc(s.auditLog.seq)).limit(400);
  const shown = filter ? rows.filter((r) => r.action.startsWith(filter)) : rows;
  const filters = [["", "All"], ["ai.", "AI use"], ["authz", "Authorization failures"], ["admin", "Privileged admin"], ["case.", "Case changes"], ["document", "Documents"], ["report", "Reports & exports"], ["auth.", "Sign-in"]];
  return (
    <div className="space-y-5">
      <div className={cx("card px-5 py-3.5 flex items-center gap-3 text-[14px]", chain.ok ? "bg-ok-soft border-[#c9dfcf]" : "bg-danger-soft")}>
        {chain.ok ? <ShieldCheck className="text-ok" size={18} /> : <ShieldAlert className="text-danger" size={18} />}
        {chain.ok ? (
          <span>
            <b>Hash chain verified.</b> All {chain.count} events are intact. Each entry is cryptographically linked to the one before it, so an edit or deletion would be detected.
          </span>
        ) : (
          <span>
            <b>Chain broken at event #{chain.brokenAt}.</b>
          </span>
        )}
        <a href="/api/audit-export" className={cx(btn("secondary", "sm"), "ml-auto")}>
          <Download size={13} /> Export CSV
        </a>
      </div>
      <div className="flex flex-wrap gap-1">
        {filters.map(([k, l]) => (
          <Link key={k} href={`/admin?tab=audit&f=${k}`} className={cx("px-2.5 py-1 rounded-md text-[12.5px] border", k === filter ? "bg-night text-white border-night" : "border-line bg-surface hover:bg-sunken")}>
            {l}
          </Link>
        ))}
      </div>
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Case</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.seq}>
                  <td className="tabular-nums text-muted">{r.seq}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(r.at)}</td>
                  <td className="whitespace-nowrap">{r.userId ? names[r.userId] ?? r.userId : "System / public"}</td>
                  <td>
                    <ActionBadge a={r.action} />
                  </td>
                  <td className="font-mono text-[12px]">{r.caseId ?? ""}</td>
                  <td className="text-[12.5px] text-ink-2 max-w-[420px] break-words">{detailText(r.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-[12.5px] text-muted">The SIEM feed streams these events as syslog (RFC 5424) or JSON over HTTPS. Legal-hold records are excluded from routine purges.</p>
    </div>
  );
}

async function WorkflowsTab() {
  const retention = await getSetting<{ type: string; years: number; basis: string }[]>("retention", []);
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {Object.entries(WORKFLOWS).map(([type, w]) => (
          <Card key={type} title={`${type} workflow`} right={<Badge>Configurable</Badge>}>
            <ol className="flex flex-wrap gap-1.5 mb-4">
              {w.stages.map((st, i) => (
                <li key={st} className="text-[12px] bg-slate-4 text-slate rounded-md px-2 py-1">
                  {i + 1}. {st}
                </li>
              ))}
            </ol>
            <div className="eyebrow mb-1.5">Rules</div>
            <ul className="space-y-1.5 text-[13.5px] list-disc ml-4">
              {w.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <Card title="Records retention" pad={false}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Case type</th>
              <th>Retain after closure</th>
              <th>Basis</th>
              <th>Action at expiry</th>
            </tr>
          </thead>
          <tbody>
            {retention.map((r) => (
              <tr key={r.type}>
                <td className="font-medium">{r.type}</td>
                <td>{r.years} years</td>
                <td className="text-[13px]">{r.basis}</td>
                <td className="text-[13px]">Archive, then logged purge after approval. Skipped while a legal hold is active.</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-[12.5px] text-muted">Stage 1 shows workflow configuration read-only. A visual workflow builder is planned for stage 2.</p>
    </div>
  );
}

function UsersTab() {
  return (
    <Card title="Users & roles" pad={false} right={<span className="text-[12px] text-muted">Provisioned from Entra ID (SCIM) · SSO + MFA enforced</span>}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Name</th>
            <th>Title</th>
            <th>Role</th>
            <th>Scope</th>
            <th>Content access</th>
          </tr>
        </thead>
        <tbody>
          {PERSONAS.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{p.name}</td>
              <td>{p.title}</td>
              <td>
                <Badge>{ROLE_LABEL[p.role]}</Badge>
              </td>
              <td className="text-[13px]">{p.departments.length ? p.departments.join(", ") : "County-wide"}</td>
              <td className="text-[13px]">{p.blurb}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

async function ReviewTab() {
  const last = await getSetting<{ at: string; by: string; flagged: string[] } | null>("access_review", null);
  const names = await userNames();
  return (
    <Card
      title="Quarterly privileged-access review"
      pad={false}
      right={<span className="text-[12px] text-muted">{last ? `Last attested ${fmtDateTime(last.at)} by ${names[last.by] ?? last.by}${last.flagged.length ? ` · ${last.flagged.length} flagged` : ""}` : "Not yet attested this quarter"}</span>}
    >
      <p className="px-5 py-3 text-[13px] text-ink-2 border-b border-line">
        Confirm that each person still needs the access their role grants. In production this list comes from Entra ID group membership, and removals de-provision through SCIM.
      </p>
      <AccessReview users={PERSONAS.map((p) => ({ id: p.id, name: p.name, role: ROLE_LABEL[p.role], scope: p.departments.length ? p.departments.join(", ") : "County-wide", privilege: p.blurb }))} />
    </Card>
  );
}

function IntegrationsTab() {
  const rows = [
    ["PeopleSoft / Oracle HCM", "Employee demographics, position, supervisor, bargaining unit", "Inbound only · nightly + on-demand lookup · OAuth 2.0 client credentials · approved attributes only", "Simulated"],
    ["Microsoft Entra ID", "SSO (SAML 2.0 / OIDC), MFA & conditional access, SCIM provisioning", "Federated · no local passwords · break-glass account vaulted & monitored", "Simulated"],
    ["Microsoft 365", "Outlook (email-to-case, invites), Teams (notifications), Office (documents)", "Graph API · least-privilege scopes", "Simulated"],
    ["County SIEM", "Security & audit event stream", "Syslog RFC 5424 / HTTPS JSON", "Simulated"],
    ["Third-party hotline", "Hotline reports into the intake queue", "Webhook + SFTP fallback", "Planned"],
    ["Leave administrator portal", "Leave dates & FMLA balances for Return to Work", "SFTP file · daily", "Planned"],
  ];
  return (
    <Card title="Integrations" pad={false}>
      <table className="tbl">
        <thead>
          <tr>
            <th>System</th>
            <th>Purpose</th>
            <th>Method & security</th>
            <th>Stage 1</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b, c, d]) => (
            <tr key={a}>
              <td className="font-medium whitespace-nowrap">{a}</td>
              <td className="text-[13px]">{b}</td>
              <td className="text-[13px]">{c}</td>
              <td>
                <Badge tone={d === "Planned" ? "neutral" : "slate"}>{d}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
