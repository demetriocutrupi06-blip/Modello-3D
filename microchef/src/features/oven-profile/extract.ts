import { generateStructured } from "@/lib/llm/structured";
import type { LlmCall } from "@/lib/llm/types";
import type { ManualSectionDraft } from "@/lib/ingest/sections";
import { OvenProfile, normalizeProfile, validateProfile } from "./schema";

export const PROFILE_SYSTEM_PROMPT = `Sei un tecnico che legge manuali d'uso di forni a microonde e ne ricava una scheda tecnica strutturata, in italiano.

Regole:
- Usa SOLO le informazioni presenti nelle sezioni del manuale fornite. Non aggiungere dati presi da conoscenze generali o da altri modelli.
- Se un dato non c'è, usa null o una lista vuota e scrivilo in "notes". Un dato mancante è meglio di un dato inventato.
- Distingui la potenza RESA (output, quella dei livelli di potenza, es. 900 W) dalla potenza ASSORBITA (consumo elettrico nelle specifiche tecniche, es. 1400 W): vanno in campi diversi.
- Per ogni elemento indica in "source" l'id della sezione da cui l'hai preso, copiandolo esattamente fra quelli forniti (es. "p14-livelli-di-potenza-e-modifiche-dei-tempi"), oppure null.
- Se il manuale copre più modelli, riporta solo ciò che vale per il modello indicato dall'utente o, se non indicato, per il modello del manuale; segnala le ambiguità in "notes".
- I programmi automatici vanno riportati con tutti i codici, gli alimenti e le porzioni che il manuale elenca.
- In "containerRules" riassumi quali materiali di contenitori sono ammessi o vietati e in quali modalità.
- Le avvertenze di sicurezza devono essere frasi brevi e operative (massimo 25 parole ciascuna), senza duplicati.`;

export function formatSectionsForPrompt(sections: Pick<ManualSectionDraft, "id" | "title" | "pageFrom" | "pageTo" | "text">[]): string {
  return sections
    .map((s) => {
      const pages = s.pageFrom === s.pageTo ? `p. ${s.pageFrom}` : `pp. ${s.pageFrom}-${s.pageTo}`;
      return `<sezione id="${s.id}" titolo="${s.title.replace(/"/g, "'")}" pagine="${pages}">\n${s.text}\n</sezione>`;
    })
    .join("\n\n");
}

export async function extractOvenProfile(opts: {
  call: LlmCall;
  sections: ManualSectionDraft[];
  modelHint?: string;
}): Promise<OvenProfile> {
  const ids = new Set(opts.sections.map((s) => s.id));
  const profile = await generateStructured({
    call: opts.call,
    schema: OvenProfile,
    system: PROFILE_SYSTEM_PROMPT,
    maxTokens: 48000,
    validate: (p) => validateProfile(p, ids),
    content: [
      {
        type: "text",
        text: `<manuale>\n${formatSectionsForPrompt(opts.sections)}\n</manuale>`,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text",
        text:
          (opts.modelHint ? `Il forno dell'utente è: ${opts.modelHint}.\n` : "") +
          "Compila la scheda tecnica del forno secondo lo schema richiesto.",
      },
    ],
  });
  return normalizeProfile(profile);
}
