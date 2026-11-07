import { z } from "zod";

/**
 * Profilo strutturato di un forno, estratto dal manuale e verificato dall'utente.
 * Tutti i campi sono obbligatori (eventualmente null o lista vuota): così lo schema è
 * compatibile con gli output strutturati dell'API e l'assenza di un dato è sempre esplicita.
 */

export const MODE_IDS = [
  "microwave",
  "grill",
  "combi_microwave_grill",
  "combi_microwave_convection",
  "convection",
  "steam",
  "crisp",
  "defrost",
  "other",
] as const;
export const ModeId = z.enum(MODE_IDS);
export type ModeId = z.infer<typeof ModeId>;

export const MODE_LABELS: Record<ModeId, string> = {
  microwave: "Microonde",
  grill: "Grill",
  combi_microwave_grill: "Combinato microonde + grill",
  combi_microwave_convection: "Combinato microonde + ventilato",
  convection: "Ventilato / convezione",
  steam: "Vapore",
  crisp: "Crisp / doratura",
  defrost: "Scongelamento",
  other: "Altro",
};

const SourceRef = z
  .string()
  .nullable()
  .describe("id della sezione del manuale da cui proviene il dato (uno degli id forniti), oppure null");

export const PowerLevel = z.object({
  label: z.string().describe("nome del livello come appare sul forno, es. 'MEDIO ALTO'"),
  percent: z.number().nullable(),
  watts: z.number().describe("potenza resa (output) in watt"),
});

export const OvenMode = z.object({
  id: ModeId,
  name: z.string().describe("nome della modalità nel manuale"),
  panelCode: z.string().nullable().describe("sigla o tasto sul pannello, es. 'Cb-1'"),
  microwaveWatts: z.array(z.number()).describe("potenze microonde selezionabili in questa modalità (vuoto se non usa microonde)"),
  temperatureC: z.object({ min: z.number(), max: z.number(), step: z.number().nullable() }).nullable(),
  preheatRequired: z.boolean().nullable(),
  notes: z.string().nullable(),
  source: SourceRef,
});

export const AutoProgramItem = z.object({
  code: z.string().describe("codice o numero del programma, es. '1-3'"),
  food: z.string(),
  portion: z.string().nullable().describe("dimensione della porzione, es. '200-250 g'"),
  instructions: z.string().nullable(),
});

export const AutoProgram = z.object({
  name: z.string().describe("nome della funzione, es. 'Cottura salutare'"),
  button: z.string().nullable(),
  items: z.array(AutoProgramItem),
  source: SourceRef,
});

export const Accessory = z.object({
  name: z.string(),
  description: z.string().nullable(),
  allowedModes: z.array(ModeId).describe("modalità in cui è consentito; vuoto se il manuale non lo dice"),
  forbiddenModes: z.array(ModeId),
  source: SourceRef,
});

export const ContainerRule = z.object({
  material: z.string().describe("es. 'metallo', 'plastica', 'vetro termoresistente', 'carta stagnola'"),
  allowedModes: z.array(ModeId),
  forbiddenModes: z.array(ModeId),
  note: z.string().nullable(),
  source: SourceRef,
});

export const SafetyWarning = z.object({
  text: z.string(),
  category: z.enum(["materiali", "uso", "alimenti", "pulizia", "bambini", "installazione", "altro"]),
  source: SourceRef,
});

export const TroubleshootingItem = z.object({
  problem: z.string(),
  solution: z.string(),
  source: SourceRef,
});

export const ErrorCode = z.object({
  code: z.string(),
  meaning: z.string(),
  action: z.string(),
  source: SourceRef,
});

export const OvenProfile = z.object({
  brand: z.string(),
  model: z.string(),
  capacityLiters: z.number().nullable(),
  maxOutputWatts: z.number().nullable().describe("potenza microonde massima resa, es. 900"),
  powerLevels: z.array(PowerLevel),
  absorbedWatts: z
    .object({
      total: z.number().nullable(),
      microwave: z.number().nullable(),
      grill: z.number().nullable(),
      convection: z.number().nullable(),
    })
    .describe("potenza assorbita dalla rete (consumo elettrico), dalle specifiche tecniche"),
  turntable: z.boolean().nullable(),
  modes: z.array(OvenMode),
  autoPrograms: z.array(AutoProgram),
  accessories: z.array(Accessory),
  containerRules: z.array(ContainerRule),
  safetyWarnings: z.array(SafetyWarning),
  troubleshooting: z.array(TroubleshootingItem),
  errorCodes: z.array(ErrorCode),
  notes: z.string().nullable().describe("dubbi o dati non trovati nel manuale"),
});
export type OvenProfile = z.infer<typeof OvenProfile>;

/** Controlli di coerenza oltre allo schema: citazioni esistenti e numeri plausibili. */
export function validateProfile(p: OvenProfile, sectionIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const checkSource = (path: string, s: string | null) => {
    if (s !== null && !sectionIds.has(s)) errors.push(`${path}.source: la sezione "${s}" non esiste; usa uno degli id forniti oppure null`);
  };
  p.modes.forEach((m, i) => checkSource(`modes[${i}]`, m.source));
  p.autoPrograms.forEach((m, i) => checkSource(`autoPrograms[${i}]`, m.source));
  p.accessories.forEach((m, i) => checkSource(`accessories[${i}]`, m.source));
  p.containerRules.forEach((m, i) => checkSource(`containerRules[${i}]`, m.source));
  p.safetyWarnings.forEach((m, i) => checkSource(`safetyWarnings[${i}]`, m.source));
  p.troubleshooting.forEach((m, i) => checkSource(`troubleshooting[${i}]`, m.source));
  p.errorCodes.forEach((m, i) => checkSource(`errorCodes[${i}]`, m.source));

  p.powerLevels.forEach((l, i) => {
    if (!(l.watts > 0 && l.watts <= 3000)) errors.push(`powerLevels[${i}].watts: valore non plausibile (${l.watts})`);
    if (l.percent !== null && !(l.percent > 0 && l.percent <= 100)) errors.push(`powerLevels[${i}].percent: deve essere tra 1 e 100`);
  });
  if (p.maxOutputWatts !== null && p.powerLevels.length > 0) {
    const max = Math.max(...p.powerLevels.map((l) => l.watts));
    if (max > p.maxOutputWatts) errors.push(`maxOutputWatts (${p.maxOutputWatts}) è inferiore al livello più alto (${max} W)`);
  }
  p.modes.forEach((m, i) => {
    if (m.temperatureC && m.temperatureC.min > m.temperatureC.max) errors.push(`modes[${i}].temperatureC: min maggiore di max`);
  });
  return errors;
}

/** Ordina i livelli di potenza dal più alto al più basso (utile anche per il convertitore). */
export function normalizeProfile(p: OvenProfile): OvenProfile {
  const powerLevels = [...p.powerLevels].sort((a, b) => b.watts - a.watts);
  const maxOutputWatts = p.maxOutputWatts ?? (powerLevels[0]?.watts ?? null);
  return { ...p, powerLevels, maxOutputWatts };
}

export function emptyProfile(): OvenProfile {
  return {
    brand: "",
    model: "",
    capacityLiters: null,
    maxOutputWatts: null,
    powerLevels: [],
    absorbedWatts: { total: null, microwave: null, grill: null, convection: null },
    turntable: null,
    modes: [],
    autoPrograms: [],
    accessories: [],
    containerRules: [],
    safetyWarnings: [],
    troubleshooting: [],
    errorCodes: [],
    notes: null,
  };
}
