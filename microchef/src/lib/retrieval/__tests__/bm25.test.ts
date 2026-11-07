import { describe, expect, it } from "vitest";
import { normalize, searchSections } from "../bm25";

const sections = [
  { slug: "p14-livelli", title: "Livelli di potenza e modifiche dei tempi", text: "ALTO 100 % 900 W. Sei livelli di potenza." },
  { slug: "p21-convezione", title: "Convezione", text: "La modalità convezione consente di cucinare gli alimenti come in un forno tradizionale. Preriscaldare." },
  { slug: "p39-errori", title: "Codice errore", text: "Il messaggio E-24 indica un surriscaldamento." },
  { slug: "p10-pulizia", title: "Pulizia", text: "Pulire la cavità del forno con un panno umido." },
];

describe("normalize", () => {
  it("toglie accenti, parole vuote e desinenze", () => {
    expect(normalize("La modalità Convezione")).toEqual(["modalit", "convezion"]);
  });
});

describe("searchSections", () => {
  it("trova la sezione pertinente, premiando il titolo", () => {
    expect(searchSections(sections, "cuocere in forno con la convezione", 2)[0].section.slug).toBe("p21-convezione");
    expect(searchSections(sections, "errore E-24", 1)[0].section.slug).toBe("p39-errori");
    expect(searchSections(sections, "come si pulisce il forno?", 1)[0].section.slug).toBe("p10-pulizia");
  });
  it("non restituisce nulla se non c'è corrispondenza", () => {
    expect(searchSections(sections, "frittura", 3)).toEqual([]);
  });
});
