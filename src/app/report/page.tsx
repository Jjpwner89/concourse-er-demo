import { IntakePortal } from "./portal";
import { EMPLOYEES } from "@/lib/db/seed";

export const metadata = { title: "Report a workplace concern · San Bernardino County (prototype)" };

const DEPARTMENTS = [...new Set(EMPLOYEES.map((e) => e.department))].filter((d) => d !== "Innovation & Technology").sort();

export default function ReportPage() {
  return <IntakePortal departments={DEPARTMENTS} />;
}
