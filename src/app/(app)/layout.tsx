import Link from "next/link";
import { currentUser } from "@/lib/session";
import { intakesFor, notificationsFor, pendingApprovalsFor } from "@/lib/data";
import { dashboardScope } from "@/lib/policy";
import { PERSONAS, ROLE_LABEL } from "@/lib/personas";
import { Logo } from "@/components/ui";
import { NavLink } from "@/components/nav-link";
import { PersonaSwitcher } from "@/components/persona-switcher";
import { Notifications } from "@/components/notifications";
import { GlobalSearch } from "@/components/global-search";
import { Home, Inbox, FolderOpen, CheckSquare, Search, BarChart3, HeartHandshake, Settings, ExternalLink, Stamp, Table2 } from "lucide-react";
import { aiConfigured } from "@/lib/ai/claude";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  const [intakes, notes, approvals] = await Promise.all([intakesFor(user), notificationsFor(user), pendingApprovalsFor(user)]);
  const approver = ["eeo_manager", "ci_investigator", "hr_director"].includes(user.role);
  const r = user.role;
  const investigator = ["eeo_investigator", "eeo_manager", "ci_investigator", "hrbp", "rtw_specialist"].includes(r);

  const nav = [
    { href: "/", label: "Home", icon: <Home size={16} />, show: true },
    { href: "/intake", label: "Intake queue", icon: <Inbox size={16} />, show: investigator, count: intakes.length },
    { href: "/rtw", label: "Return to Work", icon: <HeartHandshake size={16} />, show: r === "rtw_specialist" },
    { href: "/cases", label: r === "it_admin" ? "Case registry" : "Cases", icon: <FolderOpen size={16} />, show: true },
    { href: "/tasks", label: "My tasks", icon: <CheckSquare size={16} />, show: investigator || r === "supervisor" },
    { href: "/search", label: "Search", icon: <Search size={16} />, show: r !== "it_admin" },
    { href: "/approvals", label: "Approvals", icon: <Stamp size={16} />, show: approver, count: approvals.length },
    { href: "/dashboards", label: "Dashboards", icon: <BarChart3 size={16} />, show: r !== "supervisor" && r !== "it_admin" },
    { href: "/reports", label: "Report builder", icon: <Table2 size={16} />, show: dashboardScope(user) !== "none" },
    { href: "/admin", label: "Administration", icon: <Settings size={16} />, show: r === "it_admin" },
  ].filter((n) => n.show);

  return (
    <div className="min-h-screen flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:text-ink focus:px-3 focus:py-2 focus:rounded-lg focus:shadow-lg">
        Skip to main content
      </a>
      <aside className="w-[232px] shrink-0 bg-night text-night-ink flex flex-col sticky top-0 h-screen">
        <div className="px-5 pt-5 pb-4 border-b border-night-3">
          <div className="text-[9.5px] tracking-[0.22em] text-night-muted font-semibold">OFFICE OF</div>
          <div className="text-[14px] font-semibold leading-tight">Human Resources</div>
        </div>
        <div className="px-5 pt-5 pb-3 text-[17px] font-semibold leading-snug">Employee Relations Workspace</div>
        <nav className="px-3 flex flex-col gap-0.5" aria-label="Main">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} icon={n.icon} count={n.count}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 border-t border-night-3 space-y-3">
          <Link href="/report" target="_blank" className="flex items-center gap-1.5 text-[12.5px] text-night-muted hover:text-night-ink">
            <ExternalLink size={13} /> Public intake portal
          </Link>
          <div>
            <Logo dark size={15} />
            <div className="text-[11px] text-night-muted mt-1 leading-snug">San Bernardino County prototype · synthetic data</div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[58px] bg-night text-night-ink flex items-center gap-4 px-6 sticky top-0 z-30 border-b border-night-3">
          <GlobalSearch disabled={r === "it_admin"} />
          <div className="ml-auto flex items-center gap-3">
            {!aiConfigured() && (
              <span className="hidden lg:inline text-[11.5px] text-night-muted border border-night-3 rounded-md px-2 py-1" title="Set ANTHROPIC_API_KEY to enable live Claude output">
                AI: offline demo mode
              </span>
            )}
            <Notifications items={notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />
            <PersonaSwitcher
              current={user.id}
              personas={PERSONAS.map((p) => ({ id: p.id, name: p.name, title: p.title, initials: p.initials, role: ROLE_LABEL[p.role], blurb: p.blurb }))}
            />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-8 py-7 max-w-[1440px] w-full outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
