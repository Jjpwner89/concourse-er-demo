import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/session";
import { requireFullAccess } from "@/lib/data";
import { canSeeMedicalDocs } from "@/lib/policy";
import { getDb } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { fmtDateTime } from "@/lib/format";

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Serve a case document. ?mode=preview (inline) | download | print.
 * Same policy as the case itself, plus the medical tier. Every access is audited.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const mode = new URL(req.url).searchParams.get("mode") ?? "preview";
  const user = await currentUser();
  const db = await getDb();
  const [d] = await db.select().from(s.documents).where(eq(s.documents.id, Number(id)));
  if (!d) return new Response("Not found", { status: 404 });
  try {
    await requireFullAccess(user, d.caseId, `document ${mode}`);
  } catch {
    return new Response("Not available", { status: 404 });
  }
  if (d.medical && !canSeeMedicalDocs(user)) {
    await audit(db, user.id, "authz.denied", d.caseId, { reason: "Medical tier", surface: `document ${mode}`, docId: d.id });
    return new Response("Not available", { status: 404 });
  }
  const action = mode === "download" ? "download" : mode === "print" ? "print" : "preview";
  await audit(db, user.id, `document.${action}`, d.caseId, { docId: d.id, name: d.name, version: d.version });
  const headers: Record<string, string> = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };

  // Only these types are ever rendered inline from our origin. Everything else (HTML, SVG, Office…) downloads.
  const SAFE_INLINE = ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"];
  const isText = !d.data || (d.mime ?? "").startsWith("text/") || d.mime === "application/json";
  if (mode === "print" || (isText && mode !== "download")) {
    // Text documents (letters, statements, notes) render as a clean, printable page.
    const [c] = await db.select({ number: s.cases.number }).from(s.cases).where(eq(s.cases.id, d.caseId));
    if (d.data && mode === "print" && !isText && SAFE_INLINE.includes(d.mime ?? "")) {
      return new Response(Buffer.from(d.data, "base64"), { headers: { ...headers, "content-type": d.mime!, "content-disposition": `inline; filename="${encodeURIComponent(d.name)}"` } });
    }
    const body = d.content ?? "No text content available for this document.";
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(d.name)}</title>
<style>body{font:15px/1.6 Georgia,serif;color:#121619;max-width:720px;margin:40px auto;padding:0 24px}header{font:12px/1.4 system-ui,sans-serif;color:#555;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:24px;display:flex;justify-content:space-between}pre{white-space:pre-wrap;font:inherit}footer{font:11px system-ui,sans-serif;color:#777;border-top:1px solid #ddd;margin-top:32px;padding-top:8px}@media print{body{margin:0}}</style></head>
<body><header><span>${esc(c?.number ?? "")} · ${esc(d.kind)} · v${d.version}</span><span>CONFIDENTIAL · San Bernardino County HR</span></header><pre>${esc(body)}</pre>
<footer>${mode === "print" ? `Printed by ${esc(user.name)} on ${esc(fmtDateTime(new Date()))}. This print is recorded in the case audit trail.` : "Viewing is recorded in the case audit trail."}</footer>
${mode === "print" ? "<script>window.addEventListener('load',()=>window.print())</script>" : ""}</body></html>`;
    return new Response(html, { headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  }

  const bytes = d.data ? Buffer.from(d.data, "base64") : Buffer.from(d.content ?? "", "utf8");
  const inline = mode !== "download" && d.data && SAFE_INLINE.includes(d.mime ?? "");
  const type = !d.data ? "text/plain; charset=utf-8" : inline ? d.mime! : "application/octet-stream";
  const name = d.data ? d.name : d.name.replace(/\.(docx?|pdf)$/i, "") + ".txt";
  if (inline && d.mime!.startsWith("image/")) headers["content-security-policy"] = "sandbox; default-src 'none'; img-src 'self'";
  return new Response(bytes, { headers: { ...headers, "content-type": type, "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"` } });
}
