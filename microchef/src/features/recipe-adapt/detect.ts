/**
 * Riconoscimento del tipo di cottura di un passaggio, con tempi e temperature.
 * Funzioni pure, testate in __tests__/detect.test.ts.
 */
import { parsePowerTime } from "@/features/power-converter/logic";
import { DISH_CATEGORIES } from "./schema";

export type CookingMethod =
  | "forno"
  | "grill"
  | "padella"
  | "stufato"
  | "bollitura"
  | "vapore"
  | "microonde"
  | "frittura"
  | "fusione"
  | "riscaldamento"
  | "scongelamento"
  | "riposo"
  | "preparazione";

export interface DetectedStep {
  method: CookingMethod;
  temperatureC: number | null;
  seconds: number | null;
  secondsMax: number | null;
  watts: number | null;
  /** cosa si sta cuocendo, se riconoscibile (pasta, riso, verdure...) */
  food: "pasta" | "riso" | "verdure" | "patate" | "uova" | "cioccolato" | "burro" | null;
}

const RULES: { method: CookingMethod; re: RegExp }[] = [
  { method: "frittura", re: /\bfrigg|\bfritt[ou]r|olio bollente|friggitrice/i },
  { method: "microonde", re: /microonde|\b\d{3,4}\s*w(att)?\b/i },
  { method: "scongelamento", re: /scongel/i },
  { method: "grill", re: /gratin|\bgrill|grigli/i },
  { method: "forno", re: /\bforno\b|inforn|\bteglia\b|°\s*c\b|\d{3}\s*gradi|preriscald/i },
  { method: "fusione", re: /(sciogli|fond|fus)\w*\b[^.]*\b(burro|cioccolat|miele|gelatina)|(burro|cioccolat)\w*\b[^.]*\b(sciolt|fus)/i },
  { method: "vapore", re: /vapore|vaporiera/i },
  { method: "bollitura", re: /lessa|\bbolli|acqua (bollente|salata)|cuoci(?:ci|la|le|li|lo)? la pasta|cuoci(?:ci|la|le|li|lo)? il riso|in pentola/i },
  { method: "stufato", re: /stufa|sobboll|brasa|coperchio|a fuoco (basso|lento|dolce)|cuocere lentamente|addensare|ragù/i },
  { method: "padella", re: /padella|tegame|soffrigg|rosol|saltare|salta |sfuma|wok|a fuoco (medio|vivace|alto)|scottare/i },
  { method: "riscaldamento", re: /riscalda|scalda/i },
  { method: "riposo", re: /riposa|riposo|lievit|raffredd|frigorifero|in frigo/i },
];

const FOODS: { food: NonNullable<DetectedStep["food"]>; re: RegExp }[] = [
  { food: "pasta", re: /\bpasta\b|spaghett|penne|fusilli|rigatoni|maccheron|tagliatell|linguin|farfall/i },
  { food: "riso", re: /\briso\b|risott/i },
  { food: "patate", re: /patat/i },
  { food: "verdure", re: /verdur|zucchin|carot|broccol|spinac|fagiolin|piselli|cavol|melanzan|peperon|asparag/i },
  { food: "uova", re: /\buov[ao]\b/i },
  { food: "cioccolato", re: /cioccolat/i },
  { food: "burro", re: /\bburro\b/i },
];

export function parseTemperature(text: string): number | null {
  const m = /(\d{2,3})\s*(?:°\s*c?|gradi)/i.exec(text);
  if (!m) return null;
  const t = Number(m[1]);
  return t >= 30 && t <= 300 ? t : null;
}

const WORD_DURATIONS: [RegExp, number][] = [
  [/mezz'?\s?ora/i, 1800],
  [/un quarto d'?\s?ora/i, 900],
  [/un'?\s?ora e mezza/i, 5400],
  [/un'?\s?ora/i, 3600],
  [/un minuto/i, 60],
];

export function parseDuration(text: string): { seconds: number | null; secondsMax: number | null } {
  const p = parsePowerTime(text);
  if (p.seconds !== null) return { seconds: p.seconds, secondsMax: p.secondsMax };
  for (const [re, s] of WORD_DURATIONS) if (re.test(text)) return { seconds: s, secondsMax: null };
  return { seconds: null, secondsMax: null };
}

export function detectStep(text: string): DetectedStep {
  const temperatureC = parseTemperature(text);
  const { seconds, secondsMax } = parseDuration(text.replace(/(\d{2,3})\s*(?:°\s*c?|gradi)/gi, " "));
  const watts = parsePowerTime(text).watts;
  let method: CookingMethod = RULES.find((r) => r.re.test(text))?.method ?? "preparazione";
  // "in forno ... gratinare" → grill solo se non c'è una temperatura di cottura lunga
  if (method === "grill" && temperatureC !== null && (seconds ?? 0) > 900) method = "forno";
  // un passaggio di riposo con tempo ma senza cottura resta riposo; senza tempo e senza calore è preparazione
  if (method === "riposo" && /cuoc|cottur/i.test(text) && temperatureC !== null) method = "forno";
  const food = FOODS.find((f) => f.re.test(text))?.food ?? null;
  return { method, temperatureC, seconds, secondsMax, watts, food };
}

/** Categoria del piatto, usata dal diario di cottura per raggruppare i feedback. */
export function guessDishCategory(title: string, ingredients: string[]): (typeof DISH_CATEGORIES)[number] {
  const t = `${title} ${ingredients.join(" ")}`.toLowerCase();
  const titleOnly = title.toLowerCase();
  const rules: [(typeof DISH_CATEGORIES)[number], RegExp][] = [
    ["dolce", /torta|biscott|muffin|plumcake|crostata|budino|dolce|tiramis|cheesecake|brownie|ciambell/],
    ["pizza", /pizza|focaccia/],
    ["pane", /\bpane\b|panini/],
    ["zuppa", /zuppa|minestr|vellutat|brodo|passato di/],
    ["riso", /risott|\briso\b/],
    ["pasta", /pasta|spaghett|penne|lasagn|gnocch|fusilli|rigatoni|tagliatell|cannellon/],
    ["pesce", /pesce|salmone|tonno|merluzz|orata|branzino|gamber|calamar|cozze/],
    ["carne", /pollo|manzo|maiale|vitello|tacchino|salsicc|polpett|arrosto|carne|bistecc/],
    ["uova", /frittat|uova strapazzate|omelette|\buovo\b/],
    ["verdure", /verdur|zucchin|melanzan|patat|broccol|spinac|peperon|carot|cavol|funghi/],
  ];
  return rules.find(([, re]) => re.test(titleOnly))?.[0] ?? rules.find(([, re]) => re.test(t))?.[0] ?? "altro";
}
