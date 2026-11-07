import type { OvenProfile } from "../../schema";

/** Profilo di esempio con i dati tecnici del Samsung MC28H5015AW (non il testo del manuale). */
export const samsungProfile: OvenProfile = {
  brand: "Samsung",
  model: "MC28H5015AW",
  capacityLiters: 28,
  maxOutputWatts: 900,
  powerLevels: [
    { label: "BASSO", percent: 11, watts: 100 },
    { label: "ALTO", percent: 100, watts: 900 },
    { label: "MEDIO ALTO", percent: 67, watts: 600 },
    { label: "MEDIO", percent: 50, watts: 450 },
    { label: "MEDIO BASSO", percent: 33, watts: 300 },
    { label: "SCONGELAMENTO", percent: 20, watts: 180 },
  ],
  absorbedWatts: { total: 2900, microwave: 1400, grill: 1500, convection: 2100 },
  turntable: true,
  modes: [
    { id: "microwave", name: "Microonde", panelCode: null, microwaveWatts: [900, 600, 450, 300, 180, 100], temperatureC: null, preheatRequired: false, notes: null, source: "p14-livelli-di-potenza" },
    { id: "grill", name: "Grill", panelCode: null, microwaveWatts: [], temperatureC: null, preheatRequired: null, notes: "Temperatura non regolabile", source: null },
    { id: "combi_microwave_grill", name: "Microonde + grill", panelCode: "Cb-1", microwaveWatts: [600, 450, 300, 180, 100], temperatureC: null, preheatRequired: false, notes: null, source: null },
  ],
  autoPrograms: [],
  accessories: [
    { name: "Recipiente per cottura a vapore", description: null, allowedModes: ["microwave"], forbiddenModes: ["grill", "convection", "combi_microwave_grill", "combi_microwave_convection"], source: null },
  ],
  containerRules: [],
  safetyWarnings: [{ text: "Non accendere il forno vuoto.", category: "uso", source: "p3-istruzioni-di-sicurezza" }],
  troubleshooting: [],
  errorCodes: [{ code: "E-24", meaning: "Surriscaldamento", action: "Premere Stop/Eco e attendere il raffreddamento.", source: "p39-codice-errore" }],
  notes: null,
};

export const samsungSectionIds = new Set(["p3-istruzioni-di-sicurezza", "p14-livelli-di-potenza", "p39-codice-errore"]);
