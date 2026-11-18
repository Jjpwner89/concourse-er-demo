import "server-only";
import path from "node:path";
import * as schema from "./schema";
import type { PgliteDatabase } from "drizzle-orm/pglite";

/**
 * Database access.
 * - Local dev (no DATABASE_URL): embedded Postgres via PGlite, stored in ./.pglite
 * - Vercel (DATABASE_URL set): Neon serverless Postgres
 * Both are real Postgres; the app code is identical.
 */
export type DB = PgliteDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

const g = globalThis as unknown as { __dbPromise?: Promise<DB> };

async function init(): Promise<DB> {
  let db: DB;
  if (process.env.DATABASE_URL) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    const ndb = drizzle(neon(process.env.DATABASE_URL), { schema });
    db = ndb as unknown as DB;
    // On a brand-new database, several serverless instances can cold-start at once and race to
    // create tables / seed. The loser gets "already exists" or a duplicate key; wait and re-check.
    await withRetry(async () => {
      await migrate(ndb, { migrationsFolder: MIGRATIONS });
      await seed(db);
    });
    return db;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(path.join(process.cwd(), ".pglite"));
    const pdb = drizzle(client, { schema });
    await migrate(pdb, { migrationsFolder: MIGRATIONS });
    db = pdb;
  }
  await seed(db);
  return db;
}

async function seed(db: DB) {
  const { seedIfEmpty } = await import("./seed");
  await seedIfEmpty(db);
}

async function withRetry(fn: () => Promise<void>, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as { cause?: { code?: string }; code?: string }).cause?.code ?? (e as { code?: string }).code;
      // 42P07 duplicate table, 42701 duplicate column, 42710 duplicate object, 23505 unique violation (concurrent seed)
      if (i >= attempts || !["42P07", "42701", "42710", "23505"].includes(code ?? "")) throw e;
      await new Promise((r) => setTimeout(r, 750 * i));
    }
  }
}

export function getDb(): Promise<DB> {
  if (!g.__dbPromise) {
    g.__dbPromise = init().catch((e) => {
      g.__dbPromise = undefined;
      throw e;
    });
  }
  return g.__dbPromise;
}

export { schema };
