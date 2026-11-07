/**
 * Adattamento con Claude (a pagamento). Il modello decide COSA fare (modalità, intenzione di potenza
 * e tempo, accessori, avvisi); i numeri vengono poi riportati dal codice ai valori reali del forno:
 * potenza agganciata al livello disponibile più vicino, tempi arrotondati con roundCookingSeconds.
 */
import type { OvenProfile } from "@/features/oven-profile/schema";
import { pickLevel, roundCookingSeconds } from "@/features/power-converter/logic";
import { searchSections, type SearchableSection } from "@/lib/retrieval/bm25";
import { generateStructured } from "@/lib/llm/structured";
import type { LlmCall } from "@/lib/llm/types";
import type { ParsedRecipe } from "./parse";
import { recipeToText } from "./parse";
import { AdaptedRecipeData } from "./schema";

export const ADAPT_SYSTEM_PROMPT = `Sei un cuoco esperto di forni a microonde combinati. Adatti ricette pensate per forno tradizionale o fornelli al forno SPECIFICO dell'utente, descritto dal suo profilo e dalle sezioni del suo manuale.

Regole:
- Usa solo le modalità, i livelli di potenza, gli accessori e i programmi presenti nel profilo del forno.
- Ogni impostazione che deriva dal manuale deve citare in "sources" gli id delle sezioni fornite (copiati esattamente). Se usi una regola di cucina generale, coverage = "regola_generale". Se il forno o il manuale non coprono un caso (es. friggere), coverage = "non_coperto" e spiegalo in "note": non inventare impostazioni.
- Fattibilità: "si" se tutto si può fare con il forno; "parziale" se qualche passaggio va fatto altrove o è incerto; "sconsigliato" se il risultato sarebbe molto diverso dall'originale.
- Ingredienti: adattali solo se serve (es. meno liquidi al microonde) e spiega la modifica in "note".
- Per i passaggi al microonde indica le pause per mescolare o girare e i tempi di riposo.
- Contenitori: indica materiali adatti alla modalità, rispettando le regole del profilo (niente metallo con le microonde).
- "warnings": avvertenze di sicurezza pertinenti prese dal manuale, con la sezione di provenienza.
- Le quantità restano per il numero di porzioni indicato dall'utente.
- Scrivi in italiano, con frasi brevi e operative.`;

export function relevantSections(recipe: ParsedRecipe, profile: OvenProfile, sections: SearchableSection[], k = 12): SearchableSection[] {
  const cited = new Set(profile.modes.map((m) => m.source).filter((s): s is string => s !== null));
  const query = `${recipe.steps.join(" ")} livelli di potenza contenitori ${profile.modes.map((m) => m.name).join(" ")}`;
  const hits = searchSections(sections, query, k).map((h) => h.section);
  const extra = sections.filter((s) => cited.has(s.slug) && !hits.includes(s));
  return [...hits, ...extra].slice(0, k + 4);
}

/** Riporta i numeri proposti dal modello ai valori reali del forno. */
export function snapToOven(data: AdaptedRecipeData, profile: OvenProfile): AdaptedRecipeData {
  const levels = profile.powerLevels;
  return {
    ...data,
    steps: data.steps.map((s) => {
      const usesMicrowave = s.mode === "microwave" || s.mode === "defrost" || s.mode?.startsWith("combi");
      let powerWatts = s.powerWatts;
      let powerLabel = s.powerLabel;
      if (usesMicrowave && powerWatts && levels.length) {
        const modeLevels = profile.modes.find((m) => m.id === s.mode)?.microwaveWatts ?? [];
        const allowed = modeLevels.length ? levels.filter((l) => modeLevels.includes(l.watts)) : levels;
        const level = pickLevel(allowed.length ? allowed : levels, powerWatts);
        powerWatts = level.watts;
        powerLabel = level.label;
      }
      if (!usesMicrowave) {
        powerWatts = null;
        powerLabel = null;
      }
      return {
        ...s,
        powerWatts,
        powerLabel,
        durationSeconds: s.durationSeconds ? roundCookingSeconds(s.durationSeconds) : null,
        durationMaxSeconds: s.durationMaxSeconds ? roundCookingSeconds(s.durationMaxSeconds) : null,
      };
    }),
  };
}

export function validateAdaptation(data: AdaptedRecipeData, profile: OvenProfile, sectionIds: Set<string>): string[] {
  const errors: string[] = [];
  const modes = new Set(profile.modes.map((m) => m.id));
  data.steps.forEach((s, i) => {
    if (s.mode && !modes.has(s.mode)) errors.push(`steps[${i}].mode: il forno non ha la modalità "${s.mode}"`);
    s.sources.forEach((src) => {
      if (!sectionIds.has(src)) errors.push(`steps[${i}].sources: la sezione "${src}" non esiste`);
    });
    if (s.coverage === "manuale" && s.sources.length === 0) errors.push(`steps[${i}]: coverage "manuale" richiede almeno una sezione in sources`);
  });
  data.warnings.forEach((w, i) => {
    if (w.source && !sectionIds.has(w.source)) errors.push(`warnings[${i}].source: la sezione "${w.source}" non esiste`);
  });
  return errors;
}

export async function adaptRecipeWithAi(opts: {
  call: LlmCall;
  recipe: ParsedRecipe;
  profile: OvenProfile;
  sections: SearchableSection[];
  servings: number;
}): Promise<AdaptedRecipeData> {
  const chosen = relevantSections(opts.recipe, opts.profile, opts.sections);
  const ids = new Set(chosen.map((s) => s.slug));
  const data = await generateStructured({
    call: opts.call,
    schema: AdaptedRecipeData,
    system: ADAPT_SYSTEM_PROMPT,
    maxTokens: 16000,
    validate: (d) => validateAdaptation(d, opts.profile, ids),
    content: [
      { type: "text", text: `<profilo_forno>\n${JSON.stringify(opts.profile)}\n</profilo_forno>` },
      {
        type: "text",
        text: `<manuale>\n${chosen.map((s) => `<sezione id="${s.slug}" titolo="${s.title.replace(/"/g, "'")}">\n${s.text}\n</sezione>`).join("\n\n")}\n</manuale>`,
      },
      {
        type: "text",
        text: `<ricetta porzioni_originali="${opts.recipe.servings ?? "non indicate"}">\n${recipeToText(opts.recipe)}\n</ricetta>\n\nAdatta la ricetta al forno per ${opts.servings} porzioni.`,
      },
    ],
  });
  return snapToOven(data, opts.profile);
}
