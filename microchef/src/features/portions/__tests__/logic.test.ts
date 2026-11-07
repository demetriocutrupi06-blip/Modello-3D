import { describe, expect, it } from "vitest";
import { roundCookingSeconds } from "@/features/power-converter/logic";
import { formatNumber, parseIngredient, portionWarnings, roundQuantity, scaleCookingSeconds, scaleIngredient, timeScaleFactor } from "../logic";

describe("timeScaleFactor", () => {
  it("dose doppia → tempo × 1,5-1,6, non × 2", () => {
    expect(timeScaleFactor(2)).toBeGreaterThanOrEqual(1.5);
    expect(timeScaleFactor(2)).toBeLessThanOrEqual(1.6);
  });
  it("metà dose → circa due terzi del tempo; dose uguale → stesso tempo", () => {
    expect(timeScaleFactor(0.5)).toBeCloseTo(0.637, 2);
    expect(timeScaleFactor(1)).toBe(1);
  });
  it("rifiuta rapporti non validi", () => {
    expect(() => timeScaleFactor(0)).toThrow();
  });
});

describe("scaleCookingSeconds", () => {
  it("5 minuti per 2 persone → circa 8 minuti per 4", () => {
    expect(scaleCookingSeconds(300, 2, roundCookingSeconds)).toBe(480);
  });
});

describe("portionWarnings", () => {
  it("chiede di controllare a metà e segnala i casi estremi", () => {
    expect(portionWarnings(1)).toEqual([]);
    expect(portionWarnings(2)[0]).toMatch(/metà/);
    expect(portionWarnings(6).join(" ")).toMatch(/più volte/);
    expect(portionWarnings(0.2).join(" ")).toMatch(/molto piccole/);
  });
});

describe("parseIngredient", () => {
  it.each([
    ["200 g di farina", { quantity: 200, unit: "g", name: "farina", trailing: false }],
    ["Farina 00 200 g", { quantity: 200, unit: "g", name: "Farina 00", trailing: true }],
    ["- 1/2 cucchiaino di sale", { quantity: 0.5, unit: "cucchiaino", name: "sale" }],
    ["2 uova", { quantity: 2, unit: null, name: "uova" }],
    ["Uova 3", { quantity: 3, unit: null, name: "Uova", trailing: true }],
    ["un cucchiaio d'olio", { quantity: 1, unit: "cucchiaio", name: "olio" }],
    ["1 ½ l di latte", { quantity: 1.5, unit: "l", name: "latte" }],
    ["2-3 patate", { quantity: 2, quantityMax: 3, unit: null, name: "patate" }],
    ["Sale q.b.", { quantity: null, unit: null, name: "Sale q.b." }],
  ])("%s", (line, expected) => expect(parseIngredient(line)).toMatchObject(expected));
});

describe("roundQuantity e formatNumber", () => {
  it("arrotonda in modo pratico", () => {
    expect(roundQuantity(333.3, "g")).toBe(330);
    expect(roundQuantity(37, "g")).toBe(35);
    expect(roundQuantity(1.33, null)).toBe(1.5);
    expect(roundQuantity(4.4, null)).toBe(4);
    expect(roundQuantity(0.66, "cucchiaino")).toBe(0.75);
  });
  it("scrive le frazioni comuni", () => {
    expect(formatNumber(1.5)).toBe("1 ½");
    expect(formatNumber(0.25)).toBe("¼");
    expect(formatNumber(1.35)).toBe("1,35");
  });
});

describe("scaleIngredient", () => {
  it("raddoppia mantenendo il formato della riga", () => {
    expect(scaleIngredient("200 g di farina", 2).text).toBe("400 g di farina");
    expect(scaleIngredient("Farina 00 200 g", 1.5).text).toBe("Farina 00 300 g");
    expect(scaleIngredient("2 uova", 0.5).text).toBe("1 uova");
    expect(scaleIngredient("2-3 patate", 2).text).toBe("4-6 patate");
  });
  it("lascia invariate le righe senza quantità", () => {
    expect(scaleIngredient("Sale q.b.", 2)).toEqual({ text: "Sale q.b.", scaled: false });
  });
});
