/**
 * Scalare le porzioni: funzioni pure, coperte da test.
 *
 * INGREDIENTI: proporzionali al numero di porzioni, con arrotondamenti da cucina.
 *
 * TEMPI: NON proporzionali. Al microonde il tempo cresce con la massa, ma meno che in modo lineare
 * (l'energia si distribuisce in un volume maggiore e la superficie esposta cresce meno della massa).
 * Regola empirica usata: t₂ = t₁ × r^0,65, dove r = porzioni nuove / porzioni originali.
 *   r = 2   → × 1,57  (la regola pratica "dose doppia, tempo × 1,5-1,6")
 *   r = 0,5 → × 0,64
 *   r = 3   → × 2,04
 * Oltre ×4 o sotto ×0,25 la regola è poco affidabile: lo segnaliamo.
 */

export const TIME_EXPONENT = 0.65;
export const SAFE_RATIO = { min: 0.25, max: 4 } as const;

export function timeScaleFactor(ratio: number): number {
  if (!(ratio > 0)) throw new Error("Il rapporto tra porzioni deve essere maggiore di zero.");
  return Math.pow(ratio, TIME_EXPONENT);
}

export function portionWarnings(ratio: number): string[] {
  if (ratio === 1) return [];
  const w = ["Controlla la cottura a metà del tempo: con quantità diverse i tempi possono variare."];
  if (ratio > SAFE_RATIO.max) w.push("Per quantità oltre 4 volte l'originale è meglio cuocere in più volte.");
  if (ratio < SAFE_RATIO.min) w.push("Con quantità molto piccole il cibo cuoce in fretta: parti da un tempo ancora più breve.");
  if (ratio > 1) w.push("Usa un contenitore più grande e distribuisci il cibo in uno strato uniforme.");
  return w;
}

// ---------- ingredienti ----------

export interface ParsedIngredient {
  raw: string;
  name: string;
  quantity: number | null;
  quantityMax: number | null;
  unit: string | null;
  /** la quantità era in fondo alla riga ("Farina 00 200 g") */
  trailing: boolean;
}

const UNITS = [
  "kg", "g", "gr", "hg", "mg", "l", "lt", "dl", "cl", "ml",
  "cucchiai", "cucchiaio", "cucchiaini", "cucchiaino", "tazze", "tazza", "tazzine", "tazzina", "bicchieri", "bicchiere",
  "spicchi", "spicchio", "fette", "fetta", "pizzichi", "pizzico", "rametti", "rametto", "foglie", "foglia", "mazzetto",
  "bustine", "bustina", "confezioni", "confezione", "lattine", "lattina", "vasetti", "vasetto", "noci", "noce", "pezzi", "pezzo",
];
const UNIT_RE = UNITS.join("|");
const WORD_NUMBERS: Record<string, number> = { un: 1, uno: 1, una: 1, "un'": 1, mezzo: 0.5, mezza: 0.5, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6 };
const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
const NUMBER = String.raw`(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?\s*[½¼¾⅓⅔]?|[½¼¾⅓⅔])`;

function parseNumber(s: string): number {
  const t = s.trim().replace(",", ".");
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const withGlyph = /^(\d+(?:\.\d+)?)?\s*([½¼¾⅓⅔])$/.exec(t);
  if (withGlyph) return Number(withGlyph[1] ?? 0) + FRACTIONS[withGlyph[2]];
  return Number(t);
}

export function parseIngredient(line: string): ParsedIngredient {
  const raw = line.trim().replace(/^[-•*·–]\s*/, "");
  const base = { raw, name: raw, quantity: null, quantityMax: null, unit: null, trailing: false };
  if (/\bq\.?\s?b\.?\b|quanto basta/i.test(raw) && !/\d/.test(raw)) return base;

  // quantità in testa: "200 g di farina", "1/2 cucchiaino di sale", "2-3 patate", "un cucchiaio d'olio"
  const lead = new RegExp(String.raw`^(${NUMBER}|un'|una|uno|un|mezzo|mezza|due|tre|quattro|cinque|sei)(?:\s*[-–]\s*(${NUMBER}))?\s*(?:(${UNIT_RE})\.?\b)?\s*(?:di\s+|d')?(.*)$`, "i").exec(raw);
  if (lead && lead[4] !== undefined && (lead[3] || /^[\d½¼¾⅓⅔]/.test(lead[1]) || lead[4])) {
    const word = WORD_NUMBERS[lead[1].toLowerCase()];
    const quantity = word ?? parseNumber(lead[1]);
    if (Number.isFinite(quantity) && (word === undefined || lead[3])) {
      return {
        raw,
        name: lead[4].trim() || raw,
        quantity,
        quantityMax: lead[2] ? parseNumber(lead[2]) : null,
        unit: lead[3]?.toLowerCase() ?? null,
        trailing: false,
      };
    }
  }

  // quantità in coda: "Farina 00 200 g", "Uova 2", "Burro 50 g (ammorbidito)"
  const tail = new RegExp(String.raw`^(.*?)\s+(${NUMBER})(?:\s*[-–]\s*(${NUMBER}))?\s*(?:(${UNIT_RE})\.?\b)?\s*(\(.*\))?$`, "i").exec(raw);
  if (tail && /[a-zà-ù]/i.test(tail[1])) {
    const q = parseNumber(tail[2]);
    if (Number.isFinite(q)) {
      return {
        raw,
        name: `${tail[1].trim()}${tail[5] ? ` ${tail[5]}` : ""}`,
        quantity: q,
        quantityMax: tail[3] ? parseNumber(tail[3]) : null,
        unit: tail[4]?.toLowerCase() ?? null,
        trailing: true,
      };
    }
  }
  return base;
}

/** Arrotondamento "da cucina" in base all'unità. */
export function roundQuantity(q: number, unit: string | null): number {
  const u = unit ?? "";
  if (["g", "gr", "ml"].includes(u)) return q < 10 ? Math.round(q) || 1 : q < 100 ? Math.round(q / 5) * 5 : Math.round(q / 10) * 10;
  if (["kg", "l", "lt"].includes(u)) return Math.round(q * 20) / 20;
  if (["cl", "dl", "hg", "mg"].includes(u)) return Math.round(q * 2) / 2;
  if (u === "") return q < 3 ? Math.max(0.5, Math.round(q * 2) / 2) : Math.round(q);
  return Math.max(0.25, Math.round(q * 4) / 4); // cucchiai, tazze, spicchi...
}

export function formatNumber(n: number): string {
  const glyph: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };
  const int = Math.floor(n);
  const frac = Math.round((n - int) * 100) / 100;
  if (glyph[String(frac)]) return int ? `${int} ${glyph[String(frac)]}` : glyph[String(frac)];
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(".", ",");
}

export function scaleIngredient(line: string, ratio: number): { text: string; scaled: boolean } {
  const p = parseIngredient(line);
  if (p.quantity === null || ratio === 1) return { text: p.raw, scaled: false };
  const q = formatNumber(roundQuantity(p.quantity * ratio, p.unit));
  const qMax = p.quantityMax !== null ? `-${formatNumber(roundQuantity(p.quantityMax * ratio, p.unit))}` : "";
  const unit = p.unit ? ` ${p.unit}` : "";
  const text = p.trailing ? `${p.name} ${q}${qMax}${unit}` : `${q}${qMax}${unit} ${p.unit && !/^(di|d')\b/.test(p.name) ? "di " : ""}${p.name}`;
  return { text: text.replace(/\s+/g, " ").trim(), scaled: true };
}

/** Nuovo tempo di cottura (arrotondato come per il convertitore) dopo il cambio di porzioni. */
export function scaleCookingSeconds(seconds: number, ratio: number, round: (s: number) => number): number {
  return round(seconds * timeScaleFactor(ratio));
}
