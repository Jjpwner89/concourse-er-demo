import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/session";
import { requireContribute } from "@/lib/data";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/audit";

/** Prototype limit (Vercel request bodies cap at 4.5 MB). Production streams to encrypted blob storage. */
const MAX_BYTES = 4 * 1024 * 1024;
const TEXT_TYPES = /^(text\/|application\/json)/;

/** Upload one or more files to a case. Access is checked by the same policy as every other write. */
export async function POST(req: Request) {
  const user = await currentUser();
  const form = await req.formData();
  const caseId = String(form.get("caseId") ?? "");
  const kind = String(form.get("kind") ?? "Evidence");
  // Anything typed "Medical" always lands in the restricted medical tier, whatever the case type.
  const medical = kind === "Medical" || form.get("medical") === "true";
  let db;
  try {
    ({ db } = await requireContribute(user, caseId, "upload"));
  } catch {
    return Response.json({ ok: false, error: "You are not authorized to add documents to this case." }, { status: 403 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ ok: false, error: "No files received." }, { status: 400 });
  const saved: string[] = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) return Response.json({ ok: false, error: `${f.name} is larger than 4 MB (prototype limit).` }, { status: 413 });
    const buf = Buffer.from(await f.arrayBuffer());
    const existing = await db.select({ version: s.documents.version }).from(s.documents).where(and(eq(s.documents.caseId, caseId), eq(s.documents.name, f.name)));
    const version = existing.length ? Math.max(...existing.map((d) => d.version)) + 1 : 1;
    const mime = f.type || "application/octet-stream";
    await db.insert(s.documents).values({
      caseId,
      name: f.name,
      kind,
      medical,
      version,
      uploadedBy: user.id,
      createdAt: new Date(),
      mime,
      size: f.size,
      data: buf.toString("base64"),
      content: TEXT_TYPES.test(mime) ? buf.toString("utf8").slice(0, 20000) : null,
    });
    await audit(db, user.id, "document.uploaded", caseId, { name: f.name, version, kind, medical, bytes: f.size, sha256: await sha256(buf) });
    saved.push(f.name);
  }
  revalidatePath(`/cases/${caseId}`);
  return Response.json({ ok: true, saved, medical });
}

async function sha256(buf: Buffer) {
  const h = await crypto.subtle.digest("SHA-256", new Uint8Array(buf));
  return Buffer.from(h).toString("hex").slice(0, 16);
}
