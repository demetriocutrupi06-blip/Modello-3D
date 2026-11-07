/**
 * Dal testo grezzo (incollato, da OCR o da una pagina web) a titolo, porzioni, ingredienti e passaggi.
 * Funzioni pure, testate.
 */
import { parseIngredient } from "@/features/portions/logic";

export interface ParsedRecipe {
  title: string;
  servings: number | null;
  ingredients: string[];
  steps: string[];
}

const ING_HEADING = /^(ingredienti|occorrente|cosa serve)\b.*$/i;
const STEP_HEADING = /^(procedimento|preparazione|istruzioni|metodo|come si prepara|esecuzione)\b.*$/i;
const SERVINGS = /(?:(?:dosi |dose )?per\s*(\d{1,2})\s*(?:persone|porzioni|pers\b))|(?:(?:porzioni|persone|dosi)\s*:\s*(\d{1,2}))|(?:serve\s*(\d{1,2}))/i;

export function parseServings(text: string): number | null {
  const m = SERVINGS.exec(text);
  const n = m ? Number(m[1] ?? m[2] ?? m[3]) : NaN;
  return n >= 1 && n <= 50 ? n : null;
}

function cleanStep(line: string): string {
  return line.replace(/^\s*(?:passo\s*)?\d{1,2}\s*[.)\-:]\s*/i, "").replace(/^[-•*·–]\s*/, "").trim();
}

function looksLikeIngredient(line: string): boolean {
  if (line.length > 70) return false;
  const p = parseIngredient(line);
  return p.quantity !== null || /\bq\.?\s?b\.?$/i.test(line) || /^[-•*·]/.test(line.trim());
}

/** Divide un paragrafo lungo in passaggi di 1-2 frasi. */
export function splitSentences(paragraph: string, maxLen = 240): string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ö])/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    const last = out[out.length - 1];
    if (last && last.length + s.length + 1 <= maxLen && last.length < 80) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  return out;
}

export function parseRecipeText(text: string): ParsedRecipe {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const servings = parseServings(text);
  let title = "";
  if (lines[0] && lines[0].length <= 80 && !ING_HEADING.test(lines[0]) && !STEP_HEADING.test(lines[0]) && !looksLikeIngredient(lines[0])) {
    title = lines.shift()!;
  }

  const ingredients: string[] = [];
  const stepLines: string[] = [];
  const iIng = lines.findIndex((l) => ING_HEADING.test(l));
  const iStep = lines.findIndex((l) => STEP_HEADING.test(l));

  if (iIng >= 0 || iStep >= 0) {
    let mode: "none" | "ing" | "step" = "none";
    for (const l of lines) {
      if (ING_HEADING.test(l)) { mode = "ing"; continue; }
      if (STEP_HEADING.test(l)) { mode = "step"; continue; }
      if (SERVINGS.test(l) && l.length < 40) continue;
      if (mode === "ing") (looksLikeIngredient(l) || l.length < 50 ? ingredients : stepLines).push(l);
      else if (mode === "step") stepLines.push(l);
      else (looksLikeIngredient(l) ? ingredients : stepLines).push(l);
    }
  } else {
    for (const l of lines) {
      if (SERVINGS.test(l) && l.length < 40) continue;
      (looksLikeIngredient(l) ? ingredients : stepLines).push(l);
    }
  }

  const steps = stepLines.flatMap((l) => (l.length > 280 ? splitSentences(l) : [l])).map(cleanStep).filter((s) => s.length > 2);
  return {
    title: title || "Ricetta senza titolo",
    servings,
    ingredients: ingredients.map((l) => l.replace(/^[-•*·–]\s*/, "")),
    steps,
  };
}

// ---------- pagine web ----------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z])grave;/gi, (_, c) => `${c}̀`.normalize("NFC"))
    .replace(/&([a-z])acute;/gi, (_, c) => `${c}́`.normalize("NFC"));
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h\d|div)>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function findRecipeNode(node: Json): { [k: string]: Json } | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipeNode(n);
      if (r) return r;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const t = node["@type"];
    if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return node;
    if (node["@graph"]) return findRecipeNode(node["@graph"]);
  }
  return null;
}

function instructionsToSteps(ins: Json): string[] {
  if (typeof ins === "string") return splitSentences(stripTags(ins).replace(/\n+/g, " "));
  if (Array.isArray(ins)) return ins.flatMap(instructionsToSteps);
  if (ins && typeof ins === "object") {
    if (ins.itemListElement) return instructionsToSteps(ins.itemListElement);
    if (typeof ins.text === "string") return [stripTags(ins.text)];
  }
  return [];
}

/** Estrae la ricetta da una pagina HTML: prima i dati strutturati schema.org, poi il testo visibile. */
export function extractRecipeFromHtml(html: string): { recipe: ParsedRecipe; structured: boolean } {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const node = findRecipeNode(JSON.parse(m[1].trim()) as Json);
      if (!node) continue;
      const yieldRaw = Array.isArray(node.recipeYield) ? node.recipeYield.join(" ") : String(node.recipeYield ?? "");
      const ingredients = (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : []).map((x) => stripTags(String(x)));
      const steps = instructionsToSteps(node.recipeInstructions ?? []).filter(Boolean);
      if (ingredients.length || steps.length) {
        const n = /(\d{1,2})/.exec(yieldRaw);
        return {
          recipe: { title: stripTags(String(node.name ?? "Ricetta")), servings: n ? Number(n[1]) : null, ingredients, steps },
          structured: true,
        };
      }
    } catch {
      // JSON-LD malformato: proviamo il prossimo blocco
    }
  }
  const main = /<article[\s\S]*?<\/article>/i.exec(html)?.[0] ?? /<body[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;
  const text = stripTags(main.replace(/<(script|style|nav|footer|header|aside)[\s\S]*?<\/\1>/gi, " "));
  const title = stripTags(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const parsed = parseRecipeText(text);
  return { recipe: { ...parsed, title: title || parsed.title }, structured: false };
}

export function recipeToText(r: ParsedRecipe): string {
  return [
    r.title,
    r.servings ? `Per ${r.servings} persone` : "",
    "",
    "Ingredienti",
    ...r.ingredients.map((i) => `- ${i}`),
    "",
    "Procedimento",
    ...r.steps.map((s, i) => `${i + 1}. ${s}`),
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n")
    .trim();
}
