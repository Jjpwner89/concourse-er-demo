import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Thin wrapper around the Claude API.
 * - Model: Claude Opus 5.5 at low/medium effort (fast, high quality drafting).
 * - Server-side refusal fallbacks enabled ("default" routing).
 * - If no API key is configured, returns null so callers use offline demo output.
 *   (Data handling note for the proposal: County data is sent only to the API with
 *    no training use; see docs.)
 */
export const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
function getClient() {
  if (!aiConfigured()) return null;
  client ??= new Anthropic();
  return client;
}

export const SYSTEM_GUARDRAILS = `You are the embedded assistant inside a public-sector Employee Relations case management system used by County HR investigators.

Rules you always follow:
- You draft; humans decide. Never state a final finding, discipline decision, or accommodation determination as settled. Use language like "the evidence appears to show" and flag where investigator judgment is required.
- Use only the case material provided. If something is not in the material, say it is not in the record. Do not invent facts, dates, names, or quotes.
- Be neutral and factual. Avoid characterizing parties' credibility unless asked, and then cite the specific basis.
- Never include medical diagnoses or health details unless they appear in the material you were given.
- Write in plain, professional English suitable for a County HR record. Keep it concise.`;

type Effort = "low" | "medium" | "high";

function textOf(msg: Anthropic.Beta.BetaMessage): string {
  return msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function generateText(opts: { prompt: string; system?: string; effort?: Effort; maxTokens?: number }): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const msg = await c.beta.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system ?? SYSTEM_GUARDRAILS,
      output_config: { effort: opts.effort ?? "low" },
      messages: [{ role: "user", content: opts.prompt }],
    });
    if (msg.stop_reason === "refusal") return null;
    return textOf(msg) || null;
  } catch (err) {
    logError(err);
    return null;
  }
}

export async function generateJSON<T>(opts: { prompt: string; schema: z.ZodType<T>; system?: string; effort?: Effort }): Promise<T | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const jsonSchema = z.toJSONSchema(opts.schema) as Record<string, unknown>;
    delete jsonSchema["$schema"];
    const msg = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system ?? SYSTEM_GUARDRAILS,
      output_config: { effort: opts.effort ?? "low", format: { type: "json_schema", schema: jsonSchema } },
      messages: [{ role: "user", content: opts.prompt }],
    });
    if (msg.stop_reason === "refusal") return null;
    const parsed = opts.schema.safeParse(JSON.parse(textOf(msg)));
    return parsed.success ? parsed.data : null;
  } catch (err) {
    logError(err);
    return null;
  }
}

function logError(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) console.error("[ai] invalid ANTHROPIC_API_KEY");
  else if (err instanceof Anthropic.RateLimitError) console.error("[ai] rate limited");
  else if (err instanceof Anthropic.APIError) console.error(`[ai] API error ${err.status}: ${err.message}`);
  else console.error("[ai] error", err);
}
