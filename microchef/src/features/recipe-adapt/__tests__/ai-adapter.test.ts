import { describe, expect, it, vi } from "vitest";
import type { LlmCall } from "@/lib/llm/types";
import { samsungProfile } from "@/features/oven-profile/__tests__/fixtures/samsung-profile";
import { adaptRecipeWithAi, snapToOven, validateAdaptation } from "../ai-adapter";
import type { AdaptedRecipeData, AdaptedStep } from "../schema";

const step = (over: Partial<AdaptedStep>): AdaptedStep => ({
  instruction: "x", original: null, mode: "microwave", modeLabel: null, powerWatts: 800, powerLabel: "?", temperatureC: null,
  durationSeconds: 263, durationMaxSeconds: null, accessory: null, container: null, pauses: [], sources: ["p14-livelli-di-potenza"], coverage: "manuale", note: null, ...over,
});
const data = (steps: AdaptedStep[]): AdaptedRecipeData => ({
  title: "T", servings: 2, dishCategory: "altro", feasibility: "si", feasibilityReason: "ok", ingredients: [], steps, warnings: [],
});

describe("snapToOven", () => {
  it("aggancia la potenza a un livello reale e arrotonda i tempi", () => {
    const r = snapToOven(data([step({})]), samsungProfile);
    expect(r.steps[0]).toMatchObject({ powerWatts: 900, powerLabel: "ALTO", durationSeconds: 260 });
  });
  it("nel combinato usa solo le potenze ammesse da quella modalità", () => {
    const r = snapToOven(data([step({ mode: "combi_microwave_grill", powerWatts: 900 })]), samsungProfile);
    expect(r.steps[0].powerWatts).toBe(600);
  });
  it("toglie la potenza ai passaggi senza microonde", () => {
    expect(snapToOven(data([step({ mode: "grill" })]), samsungProfile).steps[0].powerWatts).toBeNull();
  });
});

describe("validateAdaptation", () => {
  const ids = new Set(["p14-livelli-di-potenza"]);
  it("rifiuta modalità che il forno non ha e citazioni inventate", () => {
    const errors = validateAdaptation(data([step({ mode: "steam", sources: ["p99"] })]), samsungProfile, ids);
    expect(errors).toEqual([expect.stringContaining('"steam"'), expect.stringContaining('"p99"')]);
  });
  it("richiede una fonte per le impostazioni dichiarate dal manuale", () => {
    expect(validateAdaptation(data([step({ sources: [] })]), samsungProfile, ids)).toHaveLength(1);
  });
});

describe("adaptRecipeWithAi", () => {
  it("riprova se il modello cita una sezione non fornita, poi riporta i numeri al forno", async () => {
    const bad = JSON.stringify(data([step({ sources: ["p77-inventata"] })]));
    const good = JSON.stringify(data([step({})]));
    const reply = (text: string) => ({ text, stopReason: "end_turn", content: [{ type: "text" as const, text }] });
    const call = vi.fn<LlmCall>().mockResolvedValueOnce(reply(bad)).mockResolvedValueOnce(reply(good));
    const r = await adaptRecipeWithAi({
      call,
      recipe: { title: "Zuppa", servings: 2, ingredients: [], steps: ["Scalda 3 minuti a 800 W"] },
      profile: samsungProfile,
      sections: [{ slug: "p14-livelli-di-potenza", title: "Livelli di potenza", text: "ALTO 900 W" }],
      servings: 2,
    });
    expect(call).toHaveBeenCalledTimes(2);
    expect(r.steps[0].powerWatts).toBe(900);
  });
});
