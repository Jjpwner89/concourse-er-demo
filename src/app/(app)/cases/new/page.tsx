import Link from "next/link";
import { currentUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { canCreateCases } from "@/lib/policy";
import { teamForRole } from "@/lib/taxonomy";
import { PageHeader } from "@/components/ui";
import { NewCaseForm } from "./form";

export const metadata = { title: "New case" };

export default async function NewCasePage() {
  const user = await currentUser();
  if (!canCreateCases(user))
    return (
      <div className="card p-8 max-w-xl">
        Your role can&apos;t open cases.{" "}
        <Link href="/cases" className="underline">
          Back to cases
        </Link>
      </div>
    );
  const db = await getDb();
  const [emps, users] = await Promise.all([db.select().from(s.employees), db.select().from(s.users)]);
  const staff = users.flatMap((u) => {
    const team = teamForRole(u.role);
    return team ? [{ id: u.id, name: u.name, team }] : [];
  });
  const departments = [...new Set(emps.map((e) => e.department))].sort();
  const myTeam = teamForRole(user.role);
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow={
          <Link href="/cases" className="hover:underline">
            Cases
          </Link>
        }
        title="New case"
        sub="For matters that arrive by phone, email, walk-in, hotline, manager referral or an agency charge. Portal reports go through the intake queue."
      />
      <NewCaseForm
        employees={emps.filter((e) => e.status === "Active").map((e) => ({ id: e.id, name: e.name, title: e.title, department: e.department }))}
        staff={staff}
        departments={departments}
        me={user.id}
        defaultType={myTeam === "EEO" ? "EEO" : myTeam === "Return to Work" ? "RTW" : myTeam === "Central Investigations" ? "CI" : "ER"}
      />
    </div>
  );
}
