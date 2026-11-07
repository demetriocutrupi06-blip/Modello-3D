import { describe, expect, it } from "vitest";
import { convertPower, equivalentSeconds, formatDuration, parsePowerTime, pickLevel, roundCookingSeconds } from "../logic";

// livelli del Samsung MC28H5015AW
const levels = [
  { label: "ALTO", watts: 900 },
  { label: "MEDIO ALTO", watts: 600 },
  { label: "MEDIO", watts: 450 },
  { label: "MEDIO BASSO", watts: 300 },
  { label: "SCONGELAMENTO", watts: 180 },
  { label: "BASSO", watts: 100 },
];

describe("equivalentSeconds", () => {
  it("mantiene costante watt × tempo", () => {
    expect(equivalentSeconds(800, 300, 900)).toBeCloseTo(266.67, 1);
    expect(equivalentSeconds(900, 60, 450)).toBe(120);
  });
  it("rifiuta potenze nulle", () => {
    expect(() => equivalentSeconds(0, 60, 900)).toThrow();
  });
});

describe("roundCookingSeconds", () => {
  it.each([
    [2, 5],
    [43, 45],
    [266.7, 270],
    [301, 300],
    [316, 330],
    [0, 0],
  ])("%s s → %s s", (input, out) => expect(roundCookingSeconds(input)).toBe(out));
});

describe("pickLevel", () => {
  it("sceglie il livello più vicino, e il più alto a parità", () => {
    expect(pickLevel(levels, 800).label).toBe("ALTO");
    expect(pickLevel(levels, 650).label).toBe("MEDIO ALTO");
    expect(pickLevel(levels, 525).label).toBe("MEDIO ALTO");
    expect(pickLevel(levels, 1000).label).toBe("ALTO");
  });
});

describe("convertPower", () => {
  it("800 W per 5 min → ALTO 900 W per 4 min 30 s", () => {
    const r = convertPower({ watts: 800, seconds: 300 }, levels);
    expect(r.level).toEqual({ label: "ALTO", watts: 900 });
    expect(r.seconds).toBe(270);
    expect(r.warnings[0]).toMatch(/indicativo/);
  });

  it("rispetta il livello scelto dall'utente", () => {
    const r = convertPower({ watts: 750, seconds: 180 }, levels, { levelLabel: "MEDIO" });
    expect(r.level.watts).toBe(450);
    expect(r.seconds).toBe(300);
    expect(r.warnings.join(" ")).toMatch(/mescola o gira/i);
  });

  it("converte anche l'estremo di un intervallo", () => {
    const r = convertPower({ watts: 650, seconds: 180, secondsMax: 240 }, levels);
    expect(r.level.label).toBe("MEDIO ALTO");
    expect([r.seconds, r.secondsMax]).toEqual([200, 260]);
  });

  it("avvisa quando la potenza scelta è molto più bassa", () => {
    const r = convertPower({ watts: 900, seconds: 60 }, levels, { levelLabel: "SCONGELAMENTO" });
    expect(r.seconds).toBe(300);
    expect(r.warnings.join(" ")).toMatch(/molto più bassa/);
  });

  it("rifiuta valori non validi", () => {
    expect(() => convertPower({ watts: 0, seconds: 60 }, levels)).toThrow();
    expect(() => convertPower({ watts: 5000, seconds: 60 }, levels)).toThrow(/realistica/);
    expect(() => convertPower({ watts: 800, seconds: 60 }, [])).toThrow(/livelli/);
  });
});

describe("parsePowerTime", () => {
  it.each([
    ["Riscaldare 3 min a 750 W", { watts: 750, seconds: 180, secondsMax: null }],
    ["800W 2'30\"", { watts: 800, seconds: 150, secondsMax: null }],
    ["2:30 a 900 watt", { watts: 900, seconds: 150, secondsMax: null }],
    ["3-4 minuti a 650 W", { watts: 650, seconds: 180, secondsMax: 240 }],
    ["1 ora e 20 minuti", { watts: null, seconds: 4800, secondsMax: null }],
    ["90 secondi", { watts: null, seconds: 90, secondsMax: null }],
    ["2,5 min a 1000 W", { watts: 1000, seconds: 150, secondsMax: null }],
    ["senza numeri", { watts: null, seconds: null, secondsMax: null }],
  ])("%s", (text, expected) => expect(parsePowerTime(text)).toEqual(expected));
});

describe("formatDuration", () => {
  it.each([
    [45, "45 s"],
    [270, "4 min 30 s"],
    [600, "10 min"],
    [3900, "1 h 05 min"],
  ])("%s → %s", (s, out) => expect(formatDuration(s)).toBe(out));
});
