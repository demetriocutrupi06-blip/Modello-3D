import { describe, expect, it } from "vitest";
import { parseVoiceCommand, remainingSpeech, spokenDuration, stepSpeech, toSpeakable } from "../speech";

describe("parseVoiceCommand", () => {
  it.each([
    ["prossimo passaggio", "next"],
    ["Avanti!", "next"],
    ["vai al successivo", "next"],
    ["torna indietro", "previous"],
    ["ripeti", "repeat"],
    ["Quanto manca?", "remaining"],
    ["quanto ci vuole ancora", "remaining"],
    ["avvia timer", "startTimer"],
    ["fai partire il timer", "startTimer"],
    ["metti in pausa il timer", "pauseTimer"],
    ["ferma il timer", "pauseTimer"],
    ["quali sono gli ingredienti", "ingredients"],
    ["che bella giornata", null],
    ["", null],
  ])("%s → %s", (t, cmd) => expect(parseVoiceCommand(t)).toBe(cmd));
});

describe("spokenDuration", () => {
  it.each([
    [270, "4 minuti e 30 secondi"],
    [60, "un minuto"],
    [45, "45 secondi"],
    [3720, "un'ora e 2 minuti"],
    [0, "0 secondi"],
  ])("%s → %s", (s, out) => expect(spokenDuration(s)).toBe(out));
});

describe("testi per la sintesi vocale", () => {
  it("rende pronunciabili simboli e sigle", () => {
    expect(toSpeakable("Microonde + convezione (Cb-2) a 200 °C, 600 W per 4 min 30 s")).toBe(
      "Microonde più convezione (C B 2) a 200 gradi, 600 watt per 4 minuti e 30 secondi",
    );
  });
  it("compone la lettura del passaggio con il timer", () => {
    expect(stepSpeech(2, 5, "Grill per 5 min.", ["Gira a metà"], 300)).toBe(
      'Passaggio 2 di 5. Grill per 5 minuti. Gira a metà. Quando sei pronto, di\' "avvia timer" per 5 minuti.',
    );
  });
  it("risponde a 'quanto manca'", () => {
    expect(remainingSpeech(null, false)).toMatch(/non ha un timer/);
    expect(remainingSpeech(90, true)).toBe("Mancano un minuto e 30 secondi.");
    expect(remainingSpeech(90, false)).toMatch(/in pausa/);
    expect(remainingSpeech(0, false)).toBe("Il tempo è finito.");
  });
});
