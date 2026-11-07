import { describe, expect, it } from "vitest";
import { findGutter, itemsToLines, layoutPage, type PositionedText } from "../layout";

const W = 600;
/** riga di testo sintetica: ogni parola è un elemento separato */
function line(text: string, x: number, y: number): PositionedText[] {
  let cx = x;
  return text.split(" ").map((w) => {
    const item = { str: w, x: cx, y, width: w.length * 5, height: 10 };
    cx += w.length * 5 + 3;
    return item;
  });
}

describe("layoutPage", () => {
  it("legge prima la colonna sinistra e poi la destra", () => {
    const items: PositionedText[] = [];
    for (let i = 0; i < 8; i++) {
      items.push(...line(`sinistra riga ${i}`, 40, 700 - i * 14));
      items.push(...line(`destra riga ${i}`, 330, 700 - i * 14));
    }
    expect(findGutter(items, W)).not.toBeNull();
    const out = layoutPage(items, W).split("\n");
    expect(out.slice(0, 8)).toEqual(Array.from({ length: 8 }, (_, i) => `sinistra riga ${i}`));
    expect(out.slice(8)).toEqual(Array.from({ length: 8 }, (_, i) => `destra riga ${i}`));
  });

  it("non divide una pagina a colonna singola", () => {
    const items: PositionedText[] = [];
    for (let i = 0; i < 12; i++) items.push(...line(`questa è una riga lunga che attraversa tutta la pagina numero ${i}`, 40, 700 - i * 14));
    expect(findGutter(items, W)).toBeNull();
    expect(layoutPage(items, W).split("\n")).toHaveLength(12);
  });

  it("unisce in una riga gli elementi alla stessa altezza e mette gli spazi", () => {
    const items = [
      { str: "ALTO", x: 300, y: 500, width: 20, height: 10 },
      { str: "100 %", x: 360, y: 500.8, width: 25, height: 10 },
      { str: "900 W", x: 420, y: 499.5, width: 25, height: 10 },
      { str: "MEDIO", x: 300, y: 486, width: 25, height: 10 },
    ];
    expect(itemsToLines(items)).toEqual(["ALTO 100 % 900 W", "MEDIO"]);
  });

  it("non aggiunge spazi dentro una parola spezzata in più elementi", () => {
    const items = [
      { str: "Micro", x: 100, y: 500, width: 25, height: 10 },
      { str: "onde", x: 125.3, y: 500, width: 20, height: 10 },
    ];
    expect(itemsToLines(items)).toEqual(["Microonde"]);
  });
});
