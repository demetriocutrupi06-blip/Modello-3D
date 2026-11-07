/**
 * Pre-compilazione GRATUITA del profilo forno, senza IA: cerca nel testo del manuale
 * i dati che hanno una forma riconoscibile (tabella dei livelli di potenza, volume in litri,
 * consumi, codici di errore, modalità nei titoli). Tutto il resto lo completa l'utente.
 * Funzioni pure, testate in __tests__/heuristics.test.ts.
 */
import type { ManualSectionDraft } from "@/lib/ingest/sections";
import { emptyProfile, normalizeProfile, type ModeId, type OvenProfile } from "./schema";

type Section = Pick<ManualSectionDraft, "id" | "title" | "text">;

const BRANDS = [
  "Samsung", "LG", "Whirlpool", "Panasonic", "Sharp", "Candy", "Hotpoint", "Bosch", "Siemens", "Smeg",
  "De'Longhi", "Electrolux", "AEG", "Beko", "Hisense", "Midea", "Severin", "Ariete", "Daewoo", "Gorenje",
  "Haier", "Indesit", "Neff", "Miele", "Hoover", "Toshiba", "Russell Hobbs", "Princess", "Grundig",
];

const POWER_ROW = /^([A-ZÀ-Ö][A-ZÀ-Ö' ]{1,30}?)\s+(\d{1,3})\s*%\s+(\d{2,4})\s*W$/;
const ERROR_MSG = /messaggio\s*[“"«]([A-Z]{1,3}-?\d{0,3})[”"»]\s*indica/i;

const MODE_KEYWORDS: { id: ModeId; name: string; re: RegExp }[] = [
  { id: "combi_microwave_grill", name: "Microonde + grill", re: /microonde\s*(e|\+)\s*grill/i },
  { id: "combi_microwave_convection", name: "Microonde + convezione", re: /microonde\s*(e|\+)\s*(convezione|ventilato)/i },
  { id: "grill", name: "Grill", re: /\bgrill(iatura)?\b|grigliatura/i },
  { id: "convection", name: "Convezione", re: /convezione|ventilato/i },
  { id: "steam", name: "Cottura a vapore", re: /vapore/i },
  { id: "crisp", name: "Doratura / crisp", re: /doratura|crisp/i },
  { id: "defrost", name: "Scongelamento", re: /scongelament/i },
];

const num = (s: string) => Number(s.replace(",", "."));

export function findPowerLevels(sections: Section[]): { levels: OvenProfile["powerLevels"]; source: string | null } {
  for (const s of sections) {
    const levels = s.text
      .split("\n")
      .map((l) => POWER_ROW.exec(l.trim()))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => ({ label: m[1].trim(), percent: num(m[2]), watts: num(m[3]) }))
      .filter((l) => l.percent > 0 && l.percent <= 100 && l.watts > 0 && l.watts <= 3000);
    if (levels.length >= 2) return { levels, source: s.id };
  }
  return { levels: [], source: null };
}

export function findCapacity(text: string): number | null {
  const m = /(?:volume|capacit[àa])[^\n\d]{0,25}(\d{1,3}(?:[.,]\d)?)\s*(?:litri|l)\b/i.exec(text);
  return m ? num(m[1]) : null;
}

/** Potenza resa massima dalle specifiche ("Potenza generata 100 W / 900 W"). */
export function findMaxOutput(text: string): number | null {
  const line = text.split("\n").find((l) => /potenza\s+(generata|resa|in uscita)/i.test(l) && /\d{3,4}\s*W/.test(l));
  if (!line) return null;
  const watts = [...line.matchAll(/(\d{3,4})\s*W/g)].map((m) => num(m[1]));
  return watts.length ? Math.max(...watts) : null;
}

/** Potenza assorbita: righe che seguono "Consumo elettrico" / "Potenza assorbita". */
export function findAbsorbed(text: string): OvenProfile["absorbedWatts"] {
  const out: OvenProfile["absorbedWatts"] = { total: null, microwave: null, grill: null, convection: null };
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /consumo elettrico|potenza assorbita|assorbimento/i.test(l));
  if (start < 0) return out;
  for (const l of lines.slice(start, start + 10)) {
    const w = /(\d{3,4})\s*W\b/.exec(l);
    if (!w) continue;
    const watts = num(w[1]);
    if (/generata|resa|uscita/i.test(l)) continue;
    if (/massim|totale/i.test(l)) out.total ??= watts;
    else if (/microonde/i.test(l)) out.microwave ??= watts;
    else if (/grill/i.test(l)) out.grill ??= watts;
    else if (/convezione|ventilat/i.test(l)) out.convection ??= watts;
  }
  return out;
}

export function findErrorCodes(sections: Section[]): OvenProfile["errorCodes"] {
  const codes: OvenProfile["errorCodes"] = [];
  for (const s of sections) {
    const lines = s.text.split("\n");
    lines.forEach((l, i) => {
      const m = ERROR_MSG.exec(l);
      if (!m || codes.some((c) => c.code === m[1])) return;
      const after = lines.slice(i + 1, i + 4).join(" ").replace(/^[•\-\s]+/, "").slice(0, 300);
      codes.push({ code: m[1], meaning: after, action: "", source: s.id });
    });
  }
  return codes;
}

/** Sigla della modalità combinata (es. "Cb-2"): quella che compare su una riga che nomina il tipo giusto. */
export function findPanelCode(text: string, id: ModeId): string | null {
  const keyword = id === "combi_microwave_grill" ? /grill/i : id === "combi_microwave_convection" ? /convezione|ventilat/i : null;
  if (!keyword) return null;
  const other = id === "combi_microwave_grill" ? /convezione|ventilat/i : /grill/i;
  const found: { code: string; line: string }[] = [];
  for (const line of text.split("\n")) {
    for (const m of line.matchAll(/\b(Cb-?\d|Combi\s?\d)\b/gi)) found.push({ code: m[1], line });
  }
  // 1) una riga che nomina la sigla e il tipo giusto; 2) una sigla mai associata all'altro tipo
  const direct = found.find((f) => keyword.test(f.line) && !other.test(f.line));
  if (direct) return direct.code;
  const otherCodes = new Set(found.filter((f) => other.test(f.line)).map((f) => f.code));
  return found.find((f) => !otherCodes.has(f.code))?.code ?? null;
}

export function findModes(sections: Section[], maxOutput: number | null, levels: number[]): OvenProfile["modes"] {
  const modes: OvenProfile["modes"] = [
    {
      id: "microwave",
      name: "Microonde",
      panelCode: null,
      microwaveWatts: levels,
      temperatureC: null,
      preheatRequired: false,
      notes: null,
      source: null,
    },
  ];
  for (const k of MODE_KEYWORDS) {
    const s = sections.find((x) => k.re.test(x.title));
    if (!s || modes.some((m) => m.id === k.id)) continue;
    const isCombi = k.id.startsWith("combi");
    modes.push({
      id: k.id,
      name: k.name,
      panelCode: findPanelCode(s.text, k.id),
      microwaveWatts: isCombi ? levels.filter((w) => maxOutput === null || w < maxOutput) : [],
      temperatureC: null,
      preheatRequired: null,
      notes: "Trovata nei titoli del manuale: completa i dettagli.",
      source: s.id,
    });
  }
  return modes;
}

export function prefillProfile(sections: Section[], modelHint?: string): OvenProfile {
  const all = sections.map((s) => s.text).join("\n");
  const titlesAndText = sections.map((s) => `${s.title}\n${s.text}`).join("\n");
  const { levels, source: powerSource } = findPowerLevels(sections);
  // la tabella dei livelli è il dato più affidabile; le specifiche servono se la tabella manca
  const maxOutput = levels.length ? Math.max(...levels.map((l) => l.watts)) : findMaxOutput(all);
  const watts = [...levels].sort((a, b) => b.watts - a.watts).map((l) => l.watts);
  const modes = findModes(sections, maxOutput, watts);
  modes[0].source = powerSource;

  const model = modelHint?.trim() || /\bModello\s+([A-Z0-9][A-Z0-9*\-/]{4,})/.exec(all)?.[1] || "";
  const brand = BRANDS.find((b) => new RegExp(`\\b${b.replace("'", "'?")}\\b`, "i").test(titlesAndText)) ?? "";

  const profile: OvenProfile = {
    ...emptyProfile(),
    brand,
    model,
    capacityLiters: findCapacity(all),
    maxOutputWatts: maxOutput,
    powerLevels: levels,
    absorbedWatts: findAbsorbed(all),
    modes,
    errorCodes: findErrorCodes(sections),
    notes:
      "Profilo pre-compilato automaticamente SENZA IA, cercando nel testo i dati con una forma riconoscibile. " +
      "Controlla tutto e completa a mano programmi automatici, accessori, contenitori e avvertenze, usando le sezioni del manuale qui sotto.",
  };
  return normalizeProfile(profile);
}
