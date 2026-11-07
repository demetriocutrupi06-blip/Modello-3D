import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/llm/structured";
import type { LlmCall } from "@/lib/llm/types";

const Transcription = z.object({
  pages: z.array(z.object({ page: z.number(), text: z.string() })),
});

/**
 * PDF scansionato (immagini senza testo): lo passiamo all'API come documento,
 * che legge anche le pagine come immagini, e chiediamo la trascrizione fedele pagina per pagina.
 */
export async function transcribeScannedPdf(call: LlmCall, pdf: Buffer, pageCount: number): Promise<string[]> {
  const result = await generateStructured({
    call,
    schema: Transcription,
    maxTokens: 64000,
    effort: "low",
    system:
      "Trascrivi fedelmente il testo di un manuale d'uso, pagina per pagina, in italiano. Non riassumere e non aggiungere nulla. " +
      "Mantieni i titoli delle sezioni in MAIUSCOLO come nell'originale e le tabelle come righe di testo.",
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
      { type: "text", text: `Il documento ha ${pageCount} pagine. Trascrivile tutte.` },
    ],
  });
  const pages = Array.from({ length: pageCount }, () => "");
  for (const p of result.pages) if (p.page >= 1 && p.page <= pageCount) pages[p.page - 1] = p.text;
  return pages;
}
