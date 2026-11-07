import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { anthropicCall } from "@/lib/llm/client";
import { getOven, hasApiKey } from "@/features/oven-profile/server";
import { IngestError } from "@/features/oven-profile/ingest";
import { adaptRecipeFree } from "./free-adapter";
import { adaptRecipeWithAi } from "./ai-adapter";
import { extractRecipeFromHtml, parseRecipeText, recipeToText } from "./parse";
import { StoredAdaptation } from "./schema";

export class RecipeError extends IngestError {}

/** Scarica una pagina di ricette e ne estrae il testo (dati strutturati schema.org se presenti). */
export async function extractFromUrl(url: string): Promise<{ text: string; structured: boolean }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new RecipeError("Indirizzo non valido: deve iniziare con https://");
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new RecipeError("Sono ammessi solo indirizzi http o https.");
  let res: Response;
  try {
    res = await fetch(parsed, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; MicroChef/0.2)", accept: "text/html" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
  } catch {
    throw new RecipeError("Non riesco a raggiungere la pagina. Controlla l'indirizzo o la connessione.");
  }
  if (!res.ok) throw new RecipeError(`La pagina ha risposto con un errore (${res.status}). Prova a copiare e incollare il testo.`);
  const html = (await res.text()).slice(0, 3_000_000);
  const { recipe, structured } = extractRecipeFromHtml(html);
  if (recipe.steps.length === 0 && recipe.ingredients.length === 0) {
    throw new RecipeError("Non ho trovato una ricetta in questa pagina. Copia e incolla il testo della ricetta.");
  }
  return { text: recipeToText(recipe), structured };
}

export async function getActiveOvenId(): Promise<string | null> {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  return s?.activeOvenId ?? null;
}

export async function adaptAndSave(input: {
  text: string;
  sourceType: "text" | "url" | "photo";
  sourceUrl?: string | null;
  servings?: number | null;
  mode: "free" | "ai";
  ovenId?: string | null;
}): Promise<{ id: string }> {
  const ovenId = input.ovenId || (await getActiveOvenId());
  if (!ovenId) throw new RecipeError("Configura prima un forno (I miei forni → Aggiungi).");
  const oven = await getOven(ovenId);
  if (!oven || !oven.profile) throw new RecipeError("Forno non trovato o profilo non valido.");
  if (input.mode === "ai" && !hasApiKey()) throw new RecipeError("Per l'adattamento con Claude serve la chiave API nel file .env.");

  const recipe = parseRecipeText(input.text);
  if (recipe.steps.length === 0) throw new RecipeError("Non trovo i passaggi della ricetta: incolla anche il procedimento.");
  const servings = input.servings && input.servings > 0 ? input.servings : (recipe.servings ?? 2);
  const sections = (oven.manual?.sections ?? []).map((s) => ({ slug: s.slug, title: s.title, text: s.text }));

  const data =
    input.mode === "ai"
      ? await adaptRecipeWithAi({ call: anthropicCall, recipe, profile: oven.profile, sections, servings })
      : adaptRecipeFree(recipe, oven.profile, sections, servings);
  const stored: StoredAdaptation = { ...data, method: input.mode };

  const saved = await db.recipe.create({
    data: {
      title: recipe.title,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      rawText: input.text,
      servings: recipe.servings,
      dishCategory: data.dishCategory,
      adaptations: {
        create: {
          ovenId,
          feasibility: data.feasibility,
          servings,
          data: stored as unknown as Prisma.InputJsonValue,
        },
      },
    },
    select: { adaptations: { select: { id: true } } },
  });
  return { id: saved.adaptations[0].id };
}

export async function getAdaptation(id: string) {
  const a = await db.adaptedRecipe.findUnique({
    where: { id },
    include: { recipe: true, oven: { select: { id: true, nickname: true, brand: true, model: true } } },
  });
  if (!a) return null;
  const parsed = StoredAdaptation.safeParse(a.data);
  if (!parsed.success) return null;
  const sectionTitles = await db.manualSection.findMany({
    where: { manual: { ovenId: a.ovenId }, slug: { in: [...new Set([...parsed.data.steps.flatMap((s) => s.sources), ...parsed.data.warnings.flatMap((w) => (w.source ? [w.source] : []))])] } },
    select: { slug: true, title: true, pageFrom: true },
  });
  return { ...a, data: parsed.data, sectionTitles };
}

export async function listAdaptations() {
  const rows = await db.adaptedRecipe.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, feasibility: true, servings: true, createdAt: true, recipe: { select: { title: true, sourceType: true } }, oven: { select: { nickname: true } } },
  });
  return rows;
}

export async function deleteAdaptation(id: string) {
  const a = await db.adaptedRecipe.delete({ where: { id }, select: { recipeId: true } });
  const remaining = await db.adaptedRecipe.count({ where: { recipeId: a.recipeId } });
  if (remaining === 0) await db.recipe.delete({ where: { id: a.recipeId } });
}
