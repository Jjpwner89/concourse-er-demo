import type { Persona } from "./personas";

/**
 * THE single authorization decision point.
 *
 * Every read path — case lists, case detail, search, dashboards, exports, and every AI
 * feature (retrieval, summarization, similar-case matching, Q&A) — calls `caseAccess()`.
 * There is no second code path, so AI can never see more than the user can.
 *
 *   full      → narrative, parties, documents, notes, AI
 *   metadata  → number, type, status, dates (system maintenance only; no narrative/AI)
 *   none      → the case does not exist for this user (not listed, not searchable, not counted)
 */
export type Access = "full" | "metadata" | "none";

export type PolicyCase = {
  id: string;
  type: "EEO" | "ER" | "CI" | "RTW";
  sensitivity: "standard" | "high" | "eeo" | "medical" | "privileged";
  department: string;
  category: string;
  assigneeId: string | null;
};

export type PolicyContext = {
  /** employee IDs of complainants/respondents on the case */
  partyEmployeeIds: string[];
  /** employeeId -> supervisorId */
  supervisorOf: Map<string, string | null>;
};

export type Decision = { access: Access; reason: string };

/** Walks up the reporting chain from each party; true if `employeeId` is above any of them. */
export function inReportingChain(
  employeeId: string,
  partyEmployeeIds: string[],
  supervisorOf: Map<string, string | null>,
): boolean {
  for (const start of partyEmployeeIds) {
    let cur = supervisorOf.get(start) ?? null;
    let hops = 0;
    while (cur && hops < 20) {
      if (cur === employeeId) return true;
      cur = supervisorOf.get(cur) ?? null;
      hops++;
    }
  }
  return false;
}

const SUPERVISOR_VISIBLE_CATEGORIES = new Set(["Performance counseling", "Attendance"]);

export function caseAccess(user: Persona, c: PolicyCase, ctx: PolicyContext): Decision {
  const isEEO = c.type === "EEO" || c.sensitivity === "eeo";
  const isMedical = c.type === "RTW" || c.sensitivity === "medical";
  const isInvestigative = isEEO || c.type === "CI" || c.sensitivity === "high" || c.sensitivity === "privileged";

  // 1. Conflict of interest. Parties never see their own case. On investigative matters
  //    (EEO, Central Investigations, high-sensitivity), anyone in a complainant's or
  //    respondent's reporting chain is automatically recused. Routine attendance/performance
  //    matters stay visible to the chain, since supervisors own those.
  if (user.employeeId) {
    if (ctx.partyEmployeeIds.includes(user.employeeId)) {
      return { access: "none", reason: "Recused: user is a party to this case" };
    }
    if (isInvestigative && inReportingChain(user.employeeId, ctx.partyEmployeeIds, ctx.supervisorOf)) {
      return { access: "none", reason: "Recused: user is in a party's reporting chain" };
    }
  }

  // 2. System administrators: metadata only, never content (separation of admin vs. content privilege).
  if (user.role === "it_admin") {
    return { access: "metadata", reason: "System administrator: metadata only" };
  }

  // 3. EEO wall: designated EEO staff only.
  if (isEEO) {
    if (user.role === "eeo_investigator" || user.role === "eeo_manager") {
      return { access: "full", reason: "Designated EEO staff" };
    }
    return { access: "none", reason: "EEO-restricted case" };
  }

  // 4. Medical / Return-to-Work tier.
  if (isMedical) {
    if (user.role === "rtw_specialist") return { access: "full", reason: "Return-to-Work team" };
    return { access: "none", reason: "Medical/accommodation-restricted case" };
  }

  // 5. Attorney-client privileged: senior investigators only.
  if (c.sensitivity === "privileged") {
    if (user.role === "ci_investigator") return { access: "full", reason: "Senior investigator" };
    return { access: "none", reason: "Attorney-client privileged" };
  }

  // 6. General ER / Central Investigations cases.
  switch (user.role) {
    case "ci_investigator":
    case "hr_director":
      return { access: "full", reason: "Organization-wide ER access" };
    case "hrbp":
      if (c.sensitivity === "high") return { access: "none", reason: "High-sensitivity: managers & senior investigators only" };
      if (user.departments.includes(c.department)) return { access: "full", reason: "Supported department" };
      return { access: "none", reason: "Outside supported departments" };
    case "supervisor":
      if (
        user.departments.includes(c.department) &&
        SUPERVISOR_VISIBLE_CATEGORIES.has(c.category) &&
        c.sensitivity === "standard"
      ) {
        return { access: "full", reason: "Supervisor: own department corrective action" };
      }
      return { access: "none", reason: "Not visible to supervisors" };
    case "eeo_investigator":
    case "eeo_manager":
      if (c.assigneeId === user.id) return { access: "full", reason: "Assigned" };
      return { access: "none", reason: "Not assigned" };
    case "rtw_specialist":
      return { access: "none", reason: "Outside Return-to-Work scope" };
  }
  return { access: "none", reason: "Default deny" };
}

/** Medical documents inside any case are a further restricted tier. */
export function canSeeMedicalDocs(user: Persona): boolean {
  return user.role === "rtw_specialist";
}

export function canUseAdmin(user: Persona): boolean {
  return user.role === "it_admin";
}

/**
 * Write permissions, layered on top of read access (caseAccess = "full" is always required too).
 *   manage     → run the case: stage changes, close, holds, reassign, parties, allegations, findings, reports, letters
 *   contribute → add notes, tasks and documents (supervisors on their own corrective-action matters)
 *   read-only  → HR leadership oversight: view and comment only
 */
export function canManage(user: Persona): boolean {
  return ["eeo_investigator", "eeo_manager", "ci_investigator", "hrbp", "rtw_specialist"].includes(user.role);
}

export function canContribute(user: Persona): boolean {
  return canManage(user) || user.role === "supervisor";
}

/** Who may approve findings. Never the report's author or the case's assigned investigator. */
export function canApprove(user: Persona, c: PolicyCase, authorId?: string | null): boolean {
  if (authorId && authorId === user.id) return false;
  if (c.assigneeId === user.id) return false;
  if (c.type === "EEO") return user.role === "eeo_manager";
  if (c.type === "RTW") return false;
  return user.role === "ci_investigator" || user.role === "hr_director";
}

export function canCreateCases(user: Persona): boolean {
  return canManage(user);
}

/** Who sees identifiable data on dashboards. Others get de-identified aggregates. */
export function dashboardScope(user: Persona): "identified" | "deidentified" | "none" {
  if (user.role === "hr_director") return "deidentified";
  if (user.role === "supervisor" || user.role === "it_admin") return "none";
  return "identified";
}
