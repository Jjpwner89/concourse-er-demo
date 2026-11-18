export type Role =
  | "eeo_investigator"
  | "eeo_manager"
  | "ci_investigator"
  | "rtw_specialist"
  | "hrbp"
  | "supervisor"
  | "it_admin"
  | "hr_director";

export type Persona = {
  id: string;
  name: string;
  title: string;
  role: Role;
  employeeId: string | null;
  departments: string[];
  initials: string;
  blurb: string;
};

export const ROLE_LABEL: Record<Role, string> = {
  eeo_investigator: "EEO Investigator",
  eeo_manager: "EEO Manager",
  ci_investigator: "Central Investigations",
  rtw_specialist: "Return to Work",
  hrbp: "HR Business Partner",
  supervisor: "Department Supervisor",
  it_admin: "System Administrator",
  hr_director: "HR Leadership",
};

export const PERSONAS: Persona[] = [
  {
    id: "u-maria",
    name: "Maria Delgado",
    title: "EEO Investigator",
    role: "eeo_investigator",
    employeeId: "E30101",
    departments: [],
    initials: "MD",
    blurb: "Works EEO complaints end to end.",
  },
  {
    id: "u-angela",
    name: "Angela Brooks",
    title: "EEO Manager",
    role: "eeo_manager",
    employeeId: "E30100",
    departments: [],
    initials: "AB",
    blurb: "Assigns EEO cases and approves findings.",
  },
  {
    id: "u-james",
    name: "James Okafor",
    title: "Senior Investigator, Central Investigations",
    role: "ci_investigator",
    employeeId: "E30201",
    departments: [],
    initials: "JO",
    blurb: "Misconduct, workplace violence, high-sensitivity matters. No EEO content.",
  },
  {
    id: "u-priya",
    name: "Priya Nair",
    title: "Return-to-Work Specialist",
    role: "rtw_specialist",
    employeeId: "E30301",
    departments: [],
    initials: "PN",
    blurb: "Modified duty, IAP and leave cases. Only role with medical access.",
  },
  {
    id: "u-dana",
    name: "Dana Whitfield",
    title: "HR Business Partner",
    role: "hrbp",
    employeeId: "E30401",
    departments: ["Public Works", "Transportation"],
    initials: "DW",
    blurb: "Supports Public Works and Transportation. Sees ER cases for those departments only.",
  },
  {
    id: "u-marcus",
    name: "Marcus Bell",
    title: "Deputy Director, Public Works",
    role: "supervisor",
    employeeId: "E20011",
    departments: ["Public Works"],
    initials: "MB",
    blurb: "Supervisor user. In the respondent's reporting chain, so automatically recused.",
  },
  {
    id: "u-kevin",
    name: "Kevin Tran",
    title: "IT System Administrator",
    role: "it_admin",
    employeeId: "E40001",
    departments: [],
    initials: "KT",
    blurb: "Full admin console. Case metadata only — never narrative or documents.",
  },
  {
    id: "u-lisa",
    name: "Lisa Chen",
    title: "Director of Human Resources",
    role: "hr_director",
    employeeId: "E30001",
    departments: [],
    initials: "LC",
    blurb: "Organization-wide dashboards. EEO and medical data de-identified.",
  },
];

export const DEFAULT_PERSONA = "u-maria";

export function personaById(id: string | undefined | null): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}
