/**
 * Test facoltativo sul PDF reale (non incluso nella repository per motivi di copyright),
 * con la stessa estrazione usata nel browser (pdf.js):
 *   MANUAL_PDF=/percorso/manuale.pdf npm test
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { extractPdfPages } from "../pdf-text";
import { splitIntoSections } from "../sections";

const file = process.env.MANUAL_PDF;

describe.skipIf(!file)("manuale reale (MANUAL_PDF)", () => {
  it("estrae testo leggibile e sezioni citabili", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file!)), useSystemFonts: true }).promise;
    const { pages, looksScanned } = await extractPdfPages(doc);
    expect(looksScanned).toBe(false);
    const sections = splitIntoSections(pages);
    expect(sections.length).toBeGreaterThan(20);
    const power = sections.find((s) => /livelli di potenza/i.test(s.title));
    expect(power?.text).toMatch(/ALTO 100 % 900 W/);
  }, 60_000);
});
