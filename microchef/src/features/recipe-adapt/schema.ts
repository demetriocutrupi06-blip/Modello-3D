import { z } from "zod";
import { ModeId } from "@/features/oven-profile/schema";

/**
 * Ricetta adattata a un forno: lo stesso formato per la versione gratuita (regole)
 * e per quella con Claude, così la pagina di visualizzazione è unica.
 */

export const Coverage = z
  .enum(["manuale", "regola_generale", "non_coperto"])
  .describe("manuale = impostazione presa dal manuale; regola_generale = regola di cucina generica; non_coperto = il manuale non copre il caso");

export const AdaptedStep = z.object({
  instruction: z.string().describe("istruzione completa in italiano, con modalità, potenza e tempo"),
  original: z.string().nullable().describe("passaggio originale della ricetta"),
  mode: ModeId.nullable().describe("modalità del forno; null per i passaggi senza forno (preparazione, riposo)"),
  modeLabel: z.string().nullable().describe("nome o sigla della modalità come sul forno, es. 'Cb-2'"),
  powerWatts: z.number().nullable().describe("potenza microonde in watt (uno dei livelli del forno)"),
  powerLabel: z.string().nullable().describe("nome del livello di potenza sul forno, es. 'MEDIO ALTO'"),
  temperatureC: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  durationMaxSeconds: z.number().nullable(),
  accessory: z.string().nullable(),
  container: z.string().nullable(),
  pauses: z.array(z.string()).describe("pause per mescolare, girare o riposare"),
  sources: z.array(z.string()).describe("id delle sezioni del manuale da cui derivano le impostazioni"),
  coverage: Coverage,
  note: z.string().nullable(),
});
export type AdaptedStep = z.infer<typeof AdaptedStep>;

export const AdaptedIngredient = z.object({
  text: z.string(),
  note: z.string().nullable().describe("modifica rispetto all'originale, es. 'ridotto del 20%: al microonde evapora meno'"),
});

export const Warning = z.object({ text: z.string(), source: z.string().nullable() });

export const Feasibility = z.enum(["si", "parziale", "sconsigliato"]);

export const DISH_CATEGORIES = ["pasta", "riso", "carne", "pesce", "verdure", "zuppa", "uova", "dolce", "pizza", "pane", "altro"] as const;

export const AdaptedRecipeData = z.object({
  title: z.string(),
  servings: z.number().describe("porzioni della ricetta adattata"),
  dishCategory: z.enum(DISH_CATEGORIES),
  feasibility: Feasibility,
  feasibilityReason: z.string(),
  ingredients: z.array(AdaptedIngredient),
  steps: z.array(AdaptedStep),
  warnings: z.array(Warning),
});
export type AdaptedRecipeData = z.infer<typeof AdaptedRecipeData>;

export const StoredAdaptation = AdaptedRecipeData.extend({
  method: z.enum(["free", "ai"]),
});
export type StoredAdaptation = z.infer<typeof StoredAdaptation>;

export const FEASIBILITY_LABELS: Record<z.infer<typeof Feasibility>, string> = {
  si: "Si può fare",
  parziale: "Si può fare in parte",
  sconsigliato: "Sconsigliato",
};
