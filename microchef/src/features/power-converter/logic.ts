/**
 * Convertitore di potenza: funzioni pure (nessun LLM), coperte da test.
 *
 * Principio: a parità di cibo, l'energia ceduta deve restare circa la stessa,
 * quindi watt × tempo ≈ costante  →  t₂ = t₁ × P₁ / P₂.
 * È un'approssimazione: con potenze molto basse il calore ha più tempo per distribuirsi
 * e il risultato cambia, per questo restituiamo sempre un avviso di controllare la cottura.
 */

export interface PowerLevelLike {
  label: string;
  watts: number;
}

export interface ConversionResult {
  level: PowerLevelLike;
  /** tempo arrotondato da impostare sul forno */
  seconds: number;
  /** tempo esatto prima dell'arrotondamento */
  rawSeconds: number;
  /** estremo superiore se l'originale era un intervallo (es. "3-4 min") */
  secondsMax: number | null;
  warnings: string[];
}

/**
 * Arrotonda un tempo di cottura a valori facili da impostare:
 * sotto il minuto a 5 s, fino a 5 minuti a 10 s, oltre a 30 s. Mai sotto i 5 s.
 */
export function roundCookingSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  const step = seconds < 60 ? 5 : seconds <= 300 ? 10 : 30;
  return Math.max(5, Math.round(seconds / step) * step);
}

/** Livello del forno con potenza più vicina a quella richiesta (a parità, il più alto). */
export function pickLevel(levels: PowerLevelLike[], targetWatts: number): PowerLevelLike {
  if (levels.length === 0) throw new Error("Il profilo del forno non ha livelli di potenza.");
  return [...levels].sort((a, b) => Math.abs(a.watts - targetWatts) - Math.abs(b.watts - targetWatts) || b.watts - a.watts)[0];
}

/** Tempo equivalente a energia costante. */
export function equivalentSeconds(sourceWatts: number, sourceSeconds: number, targetWatts: number): number {
  if (sourceWatts <= 0 || targetWatts <= 0) throw new Error("Le potenze devono essere maggiori di zero.");
  return (sourceSeconds * sourceWatts) / targetWatts;
}

export function convertPower(
  source: { watts: number; seconds: number; secondsMax?: number | null },
  levels: PowerLevelLike[],
  options: { levelLabel?: string } = {},
): ConversionResult {
  if (!(source.watts > 0) || !(source.seconds > 0)) throw new Error("Indica potenza e tempo originali.");
  if (source.watts > 3000) throw new Error("Una potenza microonde oltre 3000 W non è realistica: controlla il valore.");

  const level = options.levelLabel
    ? (levels.find((l) => l.label === options.levelLabel) ?? pickLevel(levels, source.watts))
    : pickLevel(levels, source.watts);

  const rawSeconds = equivalentSeconds(source.watts, source.seconds, level.watts);
  const seconds = roundCookingSeconds(rawSeconds);
  const secondsMax = source.secondsMax ? roundCookingSeconds(equivalentSeconds(source.watts, source.secondsMax, level.watts)) : null;

  const warnings = ["Il calcolo è indicativo: controlla la cottura e, se serve, prosegui a intervalli di 30 secondi."];
  const ratio = level.watts / source.watts;
  if (ratio < 0.5) warnings.push("Con una potenza molto più bassa dell'originale il risultato può cambiare: mescola o gira il cibo più spesso.");
  if (ratio > 1.5) warnings.push("Con una potenza molto più alta i bordi possono cuocere prima del centro: mescola a metà e lascia riposare.");
  if (seconds >= 120) warnings.push(`Mescola o gira il cibo a metà, dopo circa ${formatDuration(roundCookingSeconds(seconds / 2))}.`);

  return { level, seconds, rawSeconds, secondsMax, warnings };
}

/** "4 min 30 s", "45 s", "1 h 05 min" */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h} h${m ? ` ${String(m).padStart(2, "0")} min` : ""}`;
  return rest ? `${m} min ${rest} s` : `${m} min`;
}

const UNIT_SECONDS: Record<string, number> = { h: 3600, ora: 3600, ore: 3600, min: 60, minuto: 60, minuti: 60, "'": 60, s: 1, sec: 1, secondo: 1, secondi: 1, '"': 1 };

/**
 * Legge potenza e tempo da un testo libero, come un'etichetta:
 * "Riscaldare 3 min a 750 W", "800W 2'30\"", "2:30 a 900 watt", "3-4 minuti a 650 W".
 */
export function parsePowerTime(text: string): { watts: number | null; seconds: number | null; secondsMax: number | null } {
  const t = text.toLowerCase().replace(/,/g, ".");
  const w = /(\d{2,4})\s*(?:w|watt)\b/.exec(t);
  const watts = w ? Number(w[1]) : null;
  const withoutWatts = w ? t.replace(w[0], " ") : t;

  // formato m:ss
  const clock = /\b(\d{1,2}):(\d{2})\b/.exec(withoutWatts);
  if (clock) return { watts, seconds: Number(clock[1]) * 60 + Number(clock[2]), secondsMax: null };

  // intervallo "3-4 min"
  const range = /(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(ore|ora|h|minuti|minuto|min|'|secondi|secondo|sec|s|")(?![a-z])/.exec(withoutWatts);
  if (range) {
    const k = UNIT_SECONDS[range[3]];
    return { watts, seconds: Math.round(Number(range[1]) * k), secondsMax: Math.round(Number(range[2]) * k) };
  }

  // somma di parti: "1 ora e 20 minuti", "2 min 30 s", "2'30\""
  let total = 0;
  let found = false;
  for (const m of withoutWatts.matchAll(/(\d+(?:\.\d+)?)\s*(ore|ora|h|minuti|minuto|min|'|secondi|secondo|sec|s|")(?![a-z])/g)) {
    total += Number(m[1]) * UNIT_SECONDS[m[2]];
    found = true;
  }
  return { watts, seconds: found ? Math.round(total) : null, secondsMax: null };
}
