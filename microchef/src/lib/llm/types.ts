import type Anthropic from "@anthropic-ai/sdk";

export type LlmMessage = Anthropic.Beta.BetaMessageParam;
export type LlmContentBlock = Anthropic.Beta.BetaContentBlockParam;

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  jsonSchema?: Record<string, unknown>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

export interface LlmResponse {
  text: string;
  stopReason: string | null;
  /** contenuto originale della risposta, da rimandare invariato in caso di riprova */
  content: Anthropic.Beta.BetaMessageContentParam;
}

/** Funzione che esegue una chiamata al modello: iniettabile per i test. */
export type LlmCall = (req: LlmRequest) => Promise<LlmResponse>;
