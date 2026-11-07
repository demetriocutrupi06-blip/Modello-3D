import { describe, expect, it } from "vitest";
import { scaleStep } from "../scale";
import type { AdaptedStep } from "../schema";

const step = (over: Partial<AdaptedStep>): AdaptedStep => ({
  instruction: "Microonde a ALTO (900 W) per 10 min.", original: null, mode: "microwave", modeLabel: null, powerWatts: 900, powerLabel: "ALTO", temperatureC: null,
  durationSeconds: 600, durationMaxSeconds: null, accessory: null, container: null,
  pauses: ["Mescola o gira a metà cottura (dopo circa 5 min)"], sources: [], coverage: "manuale", note: null, ...over,
});

describe("scaleStep", () => {
  it("scala i tempi al microonde e aggiorna la pausa a metà", () => {
    const r = scaleStep(step({}), 2);
    expect(r).toMatchObject({ scaled: true, durationSeconds: 930 });
    expect(r.pauses[0]).toBe("Mescola o gira a metà cottura (dopo circa 8 min)");
    expect(r.instruction).toBe("Microonde a ALTO (900 W) per 15 min 30 s.");
  });
  it("non scala convezione e grill, né il rapporto 1", () => {
    expect(scaleStep(step({ mode: "convection" }), 2)).toMatchObject({ scaled: false, durationSeconds: 600 });
    expect(scaleStep(step({}), 1).scaled).toBe(false);
  });
});
