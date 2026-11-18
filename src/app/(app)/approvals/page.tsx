import Link from "next/link";
import { currentUser } from "@/lib/session";
import { pendingApprovalsFor, userNames } from "@/lib/data";
import { Card, Empty, PageHeader, TypeBadge, btn } from "@/components/ui";
import { daysBetween, fmtDate } from "@/lib/format";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const user = await currentUser();
  const [items, names] = await Promise.all([pendingApprovalsFor(user), userNames()]);
  return (
    <div>
      <PageHeader eyebrow="Work" title="Approvals" sub="Investigative reports waiting for your decision. You never see your own reports or cases you're assigned to here." />
      <Card pad={false}>
        {items.length === 0 ? (
          <Empty>Nothing is waiting for your approval.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <caption className="sr-only">Reports pending approval</caption>
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Report</th>
                  <th>Author</th>
                  <th>Submitted</th>
                  <th>Waiting</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map(({ report: r, case: c }) => {
                  const waiting = daysBetween(r.createdAt, new Date());
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <TypeBadge type={c.type} /> <b>{c.number}</b>
                        </div>
                        <div className="text-[12.5px] text-muted">{c.title}</div>
                      </td>
                      <td>Investigative report v{r.version}</td>
                      <td>{names[r.authorId] ?? r.authorId}</td>
                      <td className="whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td className={waiting > 5 ? "text-warn font-medium" : ""}>{waiting === 0 ? "Today" : `${waiting} day${waiting === 1 ? "" : "s"}`}</td>
                      <td className="text-right">
                        <Link href={`/cases/${c.id}?tab=findings`} className={btn("primary", "sm")}>
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
