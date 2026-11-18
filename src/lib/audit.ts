import "server-only";
import { createHash } from "node:crypto";
import { desc, asc } from "drizzle-orm";
import type { DB } from "./db";
import { auditLog } from "./db/schema";

/**
 * Append-only, hash-chained audit log. Each entry's hash covers its content plus the
 * previous entry's hash, so any edit or deletion breaks the chain and is detectable.
 * The app exposes no update/delete path for this table.
 */
export const GENESIS = "0".repeat(64);

/** Key-sorted JSON so the hash survives Postgres jsonb key reordering. */
function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(o[k]))
      .join(",") +
    "}"
  );
}

function digest(prevHash: string, e: { at: string; userId: string | null; action: string; caseId: string | null; detail: unknown }) {
  return createHash("sha256")
    .update(prevHash + canonical([e.at, e.userId, e.action, e.caseId, e.detail]))
    .digest("hex");
}

export async function audit(
  db: DB,
  userId: string | null,
  action: string,
  caseId: string | null = null,
  detail: Record<string, unknown> = {},
  at: Date = new Date(),
) {
  const [last] = await db.select({ hash: auditLog.hash }).from(auditLog).orderBy(desc(auditLog.seq)).limit(1);
  const prevHash = last?.hash ?? GENESIS;
  const iso = at.toISOString();
  const hash = digest(prevHash, { at: iso, userId, action, caseId, detail });
  await db.insert(auditLog).values({ at, userId, action, caseId, detail, prevHash, hash });
}

export async function verifyChain(db: DB): Promise<{ ok: boolean; count: number; brokenAt?: number }> {
  const rows = await db.select().from(auditLog).orderBy(asc(auditLog.seq));
  let prev = GENESIS;
  for (const r of rows) {
    const expected = digest(prev, {
      at: new Date(r.at).toISOString(),
      userId: r.userId,
      action: r.action,
      caseId: r.caseId,
      detail: r.detail,
    });
    if (r.prevHash !== prev || r.hash !== expected) return { ok: false, count: rows.length, brokenAt: r.seq };
    prev = r.hash;
  }
  return { ok: true, count: rows.length };
}
