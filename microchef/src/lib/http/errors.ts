import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { LlmConfigError } from "@/lib/llm/client";
import { LlmOutputError, LlmRefusalError } from "@/lib/llm/structured";
import { IngestError } from "@/features/oven-profile/ingest";

/** Traduce gli errori in risposte JSON con un messaggio comprensibile per l'utente. */
export function errorResponse(e: unknown) {
  if (e instanceof IngestError) return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof LlmConfigError) return NextResponse.json({ error: e.message }, { status: 500 });
  if (e instanceof LlmRefusalError) return NextResponse.json({ error: e.message }, { status: 422 });
  if (e instanceof LlmOutputError)
    return NextResponse.json({ error: `${e.message} Riprova tra poco.`, details: e.issues.slice(0, 10) }, { status: 502 });
  if (e instanceof Anthropic.AuthenticationError)
    return NextResponse.json({ error: "Chiave API di Anthropic non valida: controlla ANTHROPIC_API_KEY." }, { status: 500 });
  if (e instanceof Anthropic.RateLimitError)
    return NextResponse.json({ error: "Troppe richieste all'API di Anthropic: riprova tra un minuto." }, { status: 429 });
  if (e instanceof Anthropic.APIError)
    return NextResponse.json({ error: `Errore dell'API di Anthropic (${e.status ?? "rete"}): riprova.` }, { status: 502 });
  console.error(e);
  return NextResponse.json({ error: "Errore imprevisto del server." }, { status: 500 });
}
