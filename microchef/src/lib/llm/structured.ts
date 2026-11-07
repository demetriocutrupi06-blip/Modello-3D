import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { LlmCall, LlmContentBlock, LlmMessage } from "./types";

export class LlmOutputError extends Error {
  constructor(
    message: string,
    public readonly issues: string[],
  ) {
    super(message);
  }
}

export class LlmRefusalError extends Error {}

export interface StructuredOptions<T> {
  call: LlmCall;
  schema: z.ZodType<T>;
  system: string;
  content: LlmContentBlock[];
  /** controlli aggiuntivi oltre allo schema (es. che le sezioni citate esistano); restituisce gli errori */
  validate?: (value: T) => string[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

/** Schema JSON da passare all'API, derivato dallo schema zod con la conversione dell'SDK. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return betaZodOutputFormat(schema).schema as Record<string, unknown>;
}

/** Estrae il primo oggetto JSON dal testo (tollera eventuali ``` attorno). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("nessun oggetto JSON nella risposta");
  return JSON.parse(trimmed.slice(start, end + 1));
}

function check<T>(schema: z.ZodType<T>, text: string, validate?: (v: T) => string[]): { ok: true; value: T } | { ok: false; issues: string[] } {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    return { ok: false, issues: [`JSON non valido: ${(e as Error).message}`] };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(radice)"}: ${i.message}`) };
  }
  const extra = validate?.(parsed.data) ?? [];
  return extra.length ? { ok: false, issues: extra } : { ok: true, value: parsed.data };
}

/**
 * Chiede al modello un JSON conforme allo schema. Se la validazione fallisce,
 * riprova UNA volta spiegando gli errori; poi solleva LlmOutputError.
 */
export async function generateStructured<T>(opts: StructuredOptions<T>): Promise<T> {
  const jsonSchema = toJsonSchema(opts.schema);
  const messages: LlmMessage[] = [{ role: "user", content: opts.content }];

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await opts.call({ system: opts.system, messages, jsonSchema, maxTokens: opts.maxTokens, effort: opts.effort });
    if (res.stopReason === "refusal") throw new LlmRefusalError("Il modello ha rifiutato la richiesta.");
    const result =
      res.stopReason === "max_tokens"
        ? { ok: false as const, issues: ["risposta troncata (max_tokens): sii più conciso"] }
        : check(opts.schema, res.text, opts.validate);
    if (result.ok) return result.value;
    if (attempt === 1) throw new LlmOutputError("La risposta del modello non è valida anche dopo una riprova.", result.issues);

    messages.push({ role: "assistant", content: res.content });
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text:
            "La risposta precedente non rispetta lo schema richiesto. Errori:\n" +
            result.issues.slice(0, 30).map((i) => `- ${i}`).join("\n") +
            "\nRestituisci di nuovo l'intero oggetto JSON corretto, senza testo aggiuntivo.",
        },
      ],
    });
  }
  throw new Error("irraggiungibile");
}
