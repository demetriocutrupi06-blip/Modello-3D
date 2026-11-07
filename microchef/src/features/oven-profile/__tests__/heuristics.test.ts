import { describe, expect, it } from "vitest";
import { findAbsorbed, findCapacity, findErrorCodes, findMaxOutput, findPowerLevels, prefillProfile } from "../heuristics";

// testo sintetico con la stessa forma del manuale Samsung MC28H5015AW
const sections = [
  { id: "p9-accessori", title: "Accessori", text: "Piastra girevole e recipiente per la cottura a vapore Samsung." },
  {
    id: "p14-livelli-di-potenza",
    title: "Livelli di potenza e modifiche dei tempi",
    text: "Livello di potenza Percentuale Uscita\nALTO 100 % 900 W\nMEDIO ALTO 67 % 600 W\nMEDIO 50 % 450 W\nMEDIO BASSO 33 % 300 W\nSCONGELAMENTO 20 % 180 W\nBASSO 11 % 100 W",
  },
  { id: "p21-grigliatura", title: "Grigliatura", text: "Il grill consente di dorare." },
  { id: "p22-combinazione-di-microonde-e-grill", title: "Combinazione di microonde e grill", text: "Sul display compare Cb-1 (Microonde + Grill) 600 W" },
  { id: "p39-codice-errore", title: "Codice errore", text: 'Il messaggio "E-24" indica\n• un surriscaldamento del forno.\nPremere Stop.' },
  {
    id: "p39-specifiche",
    title: "Specifiche tecniche",
    text: "Modello MC28H5015**\nConsumo elettrico\nPotenza massima 2900 W\nMicroonde 1400 W\nGrill (elemento riscaldante) 1500 W\nConvezione (elemento riscaldante) Max. 2100 W\nPotenza generata 100 W / 900 W - 6 livelli (IEC-705)\nVolume 28 litri",
  },
];
const all = sections.map((s) => s.text).join("\n");

describe("pre-compilazione senza IA", () => {
  it("legge la tabella dei livelli di potenza e ne cita la sezione", () => {
    const { levels, source } = findPowerLevels(sections);
    expect(levels).toHaveLength(6);
    expect(levels[1]).toEqual({ label: "MEDIO ALTO", percent: 67, watts: 600 });
    expect(source).toBe("p14-livelli-di-potenza");
  });

  it("legge capacità, potenza resa e potenza assorbita", () => {
    expect(findCapacity(all)).toBe(28);
    expect(findMaxOutput(all)).toBe(900);
    expect(findAbsorbed(all)).toEqual({ total: 2900, microwave: 1400, grill: 1500, convection: 2100 });
  });

  it("trova i codici di errore", () => {
    expect(findErrorCodes(sections)).toEqual([
      { code: "E-24", meaning: "un surriscaldamento del forno. Premere Stop.", action: "", source: "p39-codice-errore" },
    ]);
  });

  it("compone un profilo valido con marca, modello e modalità", () => {
    const p = prefillProfile(sections);
    expect(p.brand).toBe("Samsung");
    expect(p.model).toBe("MC28H5015**");
    expect(p.modes.map((m) => m.id)).toEqual(["microwave", "combi_microwave_grill", "grill"]);
    expect(p.modes.find((m) => m.id === "combi_microwave_grill")?.panelCode).toBe("Cb-1");
    expect(p.modes[0].microwaveWatts).toEqual([900, 600, 450, 300, 180, 100]);
  });

  it("prende la potenza massima dalla tabella, non da righe che citano altre potenze", () => {
    const extra = [{ id: "p5-x", title: "Uso", text: "Potenza microonde 600 W consigliata per i liquidi." }, ...sections];
    expect(prefillProfile(extra).maxOutputWatts).toBe(900);
    expect(findMaxOutput("Potenza microonde 600 W")).toBeNull();
  });

  it("usa il modello indicato dall'utente e non inventa dati assenti", () => {
    const p = prefillProfile([{ id: "a", title: "Introduzione", text: "Testo senza dati tecnici." }], "XYZ-123");
    expect(p.model).toBe("XYZ-123");
    expect(p.powerLevels).toEqual([]);
    expect(p.capacityLiters).toBeNull();
    expect(p.maxOutputWatts).toBeNull();
  });
});
