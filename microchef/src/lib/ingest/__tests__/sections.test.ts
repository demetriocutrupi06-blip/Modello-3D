import { describe, expect, it } from "vitest";
import { isHeading, slugify, splitIntoSections } from "../sections";

describe("isHeading", () => {
  it.each([
    ["LIVELLI DI POTENZA E MODIFICHE DEI TEMPI", true],
    ["COMBINAZIONE DI MICROONDE E GRILL", true],
    ["CODICE ERRORE", true],
    ["ALTO 100 % 900 W", false],
    ["Premere il tasto Start.", false],
    ["E-24", false],
    ["8. TASTO COMBI", false],
    ["Italiano - 14", false],
    ["NOTA:", false],
  ])("%s → %s", (line, expected) => {
    expect(isHeading(line)).toBe(expected);
  });
});

describe("slugify", () => {
  it("toglie accenti e simboli", () => {
    expect(slugify("Modalità di risparmio energetico / ECO")).toBe("modalita-di-risparmio-energetico-eco");
  });
});

describe("splitIntoSections", () => {
  const pages = [
    "ISTRUZIONI DI SICUREZZA\nNon usare recipienti metallici in modalità microonde.\nNon accendere il forno vuoto, potrebbe danneggiarsi.\nItaliano - 1",
    "LIVELLI DI POTENZA\nÈ possibile scegliere tra sei livelli di potenza diversi per la cottura.\nALTO 100 % 900 W\nMEDIO 50 % 450 W\nCODICE ERRORE\nIl messaggio E-24 indica un surriscaldamento: premere Stop e attendere che il forno si raffreddi.",
  ];
  const sections = splitIntoSections(pages);

  it("crea una sezione per ogni titolo, con le pagine giuste", () => {
    expect(sections.map((s) => s.title)).toEqual(["Istruzioni di sicurezza", "Livelli di potenza", "Codice errore"]);
    expect(sections.map((s) => s.pageFrom)).toEqual([1, 2, 2]);
  });

  it("genera id citabili e unici con il numero di pagina", () => {
    expect(sections.map((s) => s.id)).toEqual(["p1-istruzioni-di-sicurezza", "p2-livelli-di-potenza", "p2-codice-errore"]);
  });

  it("toglie i piè di pagina e tiene le righe di tabella nel testo", () => {
    expect(sections[0].text).not.toMatch(/Italiano - 1/);
    expect(sections[1].text).toMatch(/ALTO 100 % 900 W/);
  });

  it("accorpa le sezioni troppo piccole alla precedente", () => {
    const s = splitIntoSections(["GRILL\nIl grill consente di dorare gli alimenti rapidamente senza microonde.\nFORNO\nok"]);
    expect(s).toHaveLength(1);
    expect(s[0].text).toMatch(/FORNO\nok/);
  });

  it("divide le sezioni molto lunghe in parti numerate", () => {
    const long = Array.from({ length: 400 }, (_, i) => `Riga di testo numero ${i} con qualche parola in più.`).join("\n");
    const s = splitIntoSections([`PROGRAMMI AUTOMATICI\n${long}`]);
    expect(s.length).toBeGreaterThan(1);
    expect(s[0].title).toBe("Programmi automatici (parte 1)");
    expect(new Set(s.map((x) => x.id)).size).toBe(s.length);
  });
});
