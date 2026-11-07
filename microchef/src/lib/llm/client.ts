import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LlmCall, LlmRequest, LlmResponse } from "./types";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new LlmConfigError("ANTHROPIC_API_KEY non impostata: aggiungila al file .env e riavvia il server.");
  }
  client ??= new Anthropic();
  return client;
}

export class LlmConfigError extends Error {}

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const EFFORT = (process.env.ANTHROPIC_EFFORT || "medium") as "low" | "medium" | "high";

/**
 * Chiamata reale all'API di Anthropic.
 * - streaming + finalMessage: i manuali sono lunghi e le risposte JSON possono esserlo altrettanto;
 * - output strutturato con lo schema JSON derivato da zod;
 * - fallback lato server in caso di rifiuto per policy (`fallbacks: "default"`).
 */
export const anthropicCall: LlmCall = async (req: LlmRequest): Promise<LlmResponse> => {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: req.maxTokens ?? 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: req.system,
    messages: req.messages,
    output_config: {
      effort: req.effort ?? EFFORT,
      ...(req.jsonSchema ? { format: { type: "json_schema", schema: req.jsonSchema } } : {}),
    },
  });
  const msg = await stream.finalMessage();
  const text = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { text, stopReason: msg.stop_reason ?? null, content: msg.content as unknown as LlmResponse["content"] };
};
