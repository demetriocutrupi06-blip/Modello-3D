import { describe, expect, it } from "vitest";
import { detectStep, guessDishCategory, parseDuration, parseTemperature } from "../detect";

describe("detectStep", () => {
  it.each([
    ["Inforna a 180 °C per 35 minuti", { method: "forno", temperatureC: 180, seconds: 2100 }],
    ["Cuoci in forno statico a 200 gradi per 20-25 minuti", { method: "forno", temperatureC: 200, seconds: 1200, secondsMax: 1500 }],
    ["Gratina per 5 minuti", { method: "grill", seconds: 300 }],
    ["Rosola la cipolla in padella per 5 minuti", { method: "padella", seconds: 300 }],
    ["Cuoci la pasta in abbondante acqua salata per 10 minuti", { method: "bollitura", food: "pasta", seconds: 600 }],
    ["Lessa le patate per 20 minuti", { method: "bollitura", food: "patate" }],
    ["Lascia sobbollire il sugo a fuoco basso per mezz'ora", { method: "stufato", seconds: 1800 }],
    ["Scalda 2 minuti al microonde a 800 W", { method: "microonde", watts: 800, seconds: 120 }],
    ["Sciogli il burro con il cioccolato", { method: "fusione", seconds: null }],
    ["Friggi le crocchette in olio bollente", { method: "frittura" }],
    ["Lascia riposare in frigo per un'ora", { method: "riposo", seconds: 3600 }],
    ["Scola e condisci con la passata", { method: "preparazione" }],
    ["Taglia le zucchine a rondelle", { method: "preparazione", food: "verdure" }],
    ["Cuoci a vapore i broccoli per 8 minuti", { method: "vapore", food: "verdure" }],
  ])("%s", (text, expected) => expect(detectStep(text)).toMatchObject(expected));
});

describe("parseTemperature e parseDuration", () => {
  it("ignorano valori fuori scala e leggono i tempi a parole", () => {
    expect(parseTemperature("a 1000 gradi")).toBeNull();
    expect(parseTemperature("a 180°")).toBe(180);
    expect(parseDuration("per un quarto d'ora").seconds).toBe(900);
  });
});

describe("guessDishCategory", () => {
  it("usa prima il titolo e poi gli ingredienti", () => {
    expect(guessDishCategory("Torta di mele", ["mele", "farina"])).toBe("dolce");
    expect(guessDishCategory("Pasta al forno", ["mozzarella"])).toBe("pasta");
    expect(guessDishCategory("Cena veloce", ["petto di pollo"])).toBe("carne");
    expect(guessDishCategory("Boh", [])).toBe("altro");
  });
});
