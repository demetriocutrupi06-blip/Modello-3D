import { describe, expect, it } from "vitest";
import type { OvenProfile } from "@/features/oven-profile/schema";
import { samsungProfile } from "@/features/oven-profile/__tests__/fixtures/samsung-profile";
import { adaptRecipeFree } from "../free-adapter";
import { parseRecipeText } from "../parse";
import { AdaptedRecipeData } from "../schema";

const profile: OvenProfile = {
  ...samsungProfile,
  modes: [
    ...samsungProfile.modes,
    { id: "convection", name: "Convezione", panelCode: null, microwaveWatts: [], temperatureC: { min: 40, max: 200, step: 10 }, preheatRequired: true, notes: null, source: "p21-convezione" },
    { id: "combi_microwave_convection", name: "Microonde + convezione", panelCode: "Cb-2", microwaveWatts: [600, 450, 300, 180, 100], temperatureC: { min: 40, max: 200, step: 10 }, preheatRequired: false, notes: null, source: "p22-combi" },
  ],
  accessories: [
    ...samsungProfile.accessories,
    { name: "Ripiano inferiore", description: null, allowedModes: ["grill", "convection", "combi_microwave_grill", "combi_microwave_convection"], forbiddenModes: ["microwave"], source: null },
  ],
  containerRules: [{ material: "Metallo", allowedModes: ["convection", "grill"], forbiddenModes: ["microwave", "combi_microwave_grill", "combi_microwave_convection"], note: null, source: "p7-precauzioni" }],
};

const sections = [
  { slug: "p14-livelli-di-potenza", title: "Livelli di potenza e modifiche dei tempi", text: "ALTO 100 % 900 W" },
  { slug: "p21-convezione", title: "Convezione", text: "Preriscaldare il forno alla temperatura desiderata." },
  { slug: "p22-combi", title: "Combinazione di microonde e convezione", text: "Cb-2" },
  { slug: "p24-doratura", title: "Uso della funzione doratura", text: "Piatto doratore crisp." },
];

const adapt = (text: string, p = profile, servings = 4) => adaptRecipeFree(parseRecipeText(text), p, sections, servings);

describe("adaptRecipeFree", () => {
  const pasta = adapt(`Pasta al forno
Per 4 persone
Ingredienti
- 320 g di pasta
- 400 g di passata
Procedimento
1. Cuoci la pasta in acqua salata per 8 minuti.
2. Condisci con la passata.
3. Inforna a 220 °C per 20 minuti.`);

  it("produce un risultato conforme allo schema", () => {
    expect(AdaptedRecipeData.safeParse(pasta).success).toBe(true);
    expect(pasta.dishCategory).toBe("pasta");
  });

  it("lessa la pasta al microonde a potenza massima con tempo × 1,25", () => {
    const s = pasta.steps[0];
    expect(s).toMatchObject({ mode: "microwave", powerWatts: 900, powerLabel: "ALTO", durationSeconds: 600, coverage: "regola_generale" });
    expect(s.sources).toContain("p14-livelli-di-potenza");
    expect(s.pauses[0]).toMatch(/metà/);
  });

  it("lascia senza forno i passaggi di preparazione", () => {
    expect(pasta.steps[1].mode).toBeNull();
  });

  it("passa il forno tradizionale alla convezione, rispettando la temperatura massima e citando il manuale", () => {
    const s = pasta.steps[2];
    expect(s).toMatchObject({ mode: "convection", temperatureC: 200, durationSeconds: 1200, coverage: "manuale", accessory: "Ripiano inferiore" });
    expect(s.note).toMatch(/220 °C/);
    expect(s.sources[0]).toBe("p21-convezione");
    expect(s.instruction).toMatch(/preriscaldato/);
  });

  it("segnala la fattibilità parziale quando usa regole generiche", () => {
    expect(pasta.feasibility).toBe("parziale");
  });

  it("aggiunge le avvertenze sui materiali per le modalità usate", () => {
    expect(pasta.warnings[0]).toEqual({ text: "Non usare metallo in modalità microonde.", source: "p7-precauzioni" });
    expect(pasta.warnings.some((w) => /Recipiente per cottura a vapore/.test(w.text))).toBe(true);
  });

  it("converte le istruzioni già pensate per il microonde", () => {
    const r = adapt("Zuppa pronta\nScalda 3 minuti a 750 W");
    expect(r.steps[0]).toMatchObject({ mode: "microwave", powerWatts: 900, durationSeconds: 150, coverage: "manuale" });
    expect(r.feasibility).toBe("si");
  });

  it("riduce i liquidi quando stufato o padella passano al microonde", () => {
    const r = adapt("Spezzatino\n500 g di manzo\n200 ml di brodo\nProcedimento\nLascia sobbollire con il coperchio a fuoco basso per 40 minuti.");
    expect(r.steps[0]).toMatchObject({ mode: "microwave", powerWatts: 600, durationSeconds: 1680 });
    expect(r.ingredients[1].note).toMatch(/1\/5/);
    expect(r.ingredients[0].note).toBeNull();
  });

  it("usa il crisp al posto della padella se il forno lo ha", () => {
    const withCrisp: OvenProfile = { ...profile, modes: [...profile.modes, { id: "crisp", name: "Doratura", panelCode: null, microwaveWatts: [], temperatureC: null, preheatRequired: null, notes: null, source: "p24-doratura" }] };
    const r = adapt("Zucchine\nSalta le zucchine in padella per 6 minuti", withCrisp);
    expect(r.steps[0]).toMatchObject({ mode: "crisp", durationSeconds: 360, coverage: "manuale" });
  });

  it("dichiara non coperta la frittura e sconsiglia la ricetta", () => {
    const r = adapt("Patatine\nFriggi le patate in olio bollente per 5 minuti");
    expect(r.steps[0].coverage).toBe("non_coperto");
    expect(r.feasibility).toBe("sconsigliato");
  });

  it("non inventa la convezione su un forno che non ce l'ha", () => {
    const r = adapt("Torta\nInforna a 180 °C per 40 minuti", samsungProfile);
    expect(r.steps[0]).toMatchObject({ mode: null, coverage: "non_coperto" });
    expect(r.feasibility).toBe("sconsigliato");
  });

  it("dice quando non trova passaggi di cottura", () => {
    const r = adapt("Insalata\nTaglia i pomodori e condisci");
    expect(r.feasibility).toBe("parziale");
    expect(r.feasibilityReason).toMatch(/Non ho riconosciuto/);
  });
});
